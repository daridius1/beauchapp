// Beauchapp PocketBase Hooks
// Lógica de negocio del lado del servidor - Compatible con PocketBase v0.23+

// 1. Filtro de exclusividad universitaria
// Interceptar el registro de usuarios para validar el correo institucional @ing.uchile.cl
onRecordCreateRequest((e) => {
    const email = e.record.getString("email");
    
    if (!email) {
        throw new BadRequestError("El correo electrónico es requerido.");
    }
    
    if (!email.endsWith("@ing.uchile.cl")) {
        throw new BadRequestError("Acceso denegado. Solo se permiten correos con el dominio @ing.uchile.cl");
    }
    
    e.next();
}, "users");

// 1.5. Proteger campo isSuperadmin (solo admins reales pueden modificarlo)
onRecordUpdateRequest((e) => {
    const original = e.record.originalCopy();
    if (e.record.get("isSuperadmin") !== original.get("isSuperadmin")) {
        if (!e.requestInfo?.auth?.isSuperuser()) {
            e.record.set("isSuperadmin", original.get("isSuperadmin"));
        }
    }
    e.next();
}, "users");

// 2. Recálculo automático de puntuación para predicciones
onRecordUpdateRequest((e) => {
    // Primero, ejecutar la actualizacion
    e.next();

    const played = e.record.getBool("played");
    if (!played) return; // solo recalcular si el partido ya se jugo

    const matchId = e.record.getId();
    const homeScore = e.record.getInt("homeScore");
    const awayScore = e.record.getInt("awayScore");
    
    // Obtener predicciones
    const predictions = $app.findRecordsByFilter(
        "predictions",
        "match = {:matchId}",
        "",
        5000,
        0,
        { matchId: matchId }
    );
    
    for (let i = 0; i < predictions.length; i++) {
        const pred = predictions[i];
        let points = 0;
        
        const predHome = pred.getInt("homeScore");
        const predAway = pred.getInt("awayScore");
        
        const predDiff = predHome - predAway;
        const matchDiff = homeScore - awayScore;
        
        const predOutcome = predDiff > 0 ? 1 : (predDiff < 0 ? -1 : 0);
        const matchOutcome = matchDiff > 0 ? 1 : (matchDiff < 0 ? -1 : 0);
        
        if (predHome === homeScore && predAway === awayScore) {
            points = 6;
        } else if (predOutcome === matchOutcome && predDiff === matchDiff) {
            points = 4;
        } else if (predOutcome === matchOutcome) {
            points = 3;
        } else {
            const isFlipped = (predOutcome * matchOutcome) === -1;
            if (!isFlipped && (predHome === homeScore || predAway === awayScore)) {
                points = 1;
            } else {
                points = 0;
            }
        }
        
        pred.set("points", points);
        $app.save(pred);
    }
}, "matches");




// 3. Validar seguridad de Predicciones
onRecordCreateRequest((e) => {
    const matchId = e.record.getString("match");
    if (matchId) {
        try {
            const match = $app.findRecordById("matches", matchId);
            if (match.getBool("played")) {
                throw new BadRequestError("No puedes predecir un partido que ya finalizó.");
            }
            const dateStr = match.getString("date");
            if (dateStr) {
                const matchTime = new Date(dateStr.replace(" ", "T")).getTime();
                if (Date.now() >= matchTime - 600000) {
                    throw new BadRequestError("El tiempo para predecir este partido se ha agotado (se bloquea 10 mins antes).");
                }
            }
        } catch (err) {
            if (err.message && err.message.includes("predecir")) {
                throw err;
            }
        }
    }
    // Evitar trampa: forzar a 0 en la creación
    e.record.set("points", 0);
    e.next();
}, "predictions");

onRecordUpdateRequest((e) => {
    const original = e.record.originalCopy();
    
    // Evitar trampa: restaurar los puntos originales si el cliente intento editarlos
    e.record.set("points", original.getInt("points"));
    
    // Si los goles no cambiaron, es un save interno (p. ej. calculo de puntos)
    if (original.getInt("homeScore") === e.record.getInt("homeScore") && 
        original.getInt("awayScore") === e.record.getInt("awayScore")) {
        e.next();
        return;
    }

    const matchId = e.record.getString("match");
    if (matchId) {
        try {
            const match = $app.findRecordById("matches", matchId);
            if (match.getBool("played")) {
                throw new BadRequestError("No puedes predecir un partido que ya finalizó.");
            }
            const dateStr = match.getString("date");
            if (dateStr) {
                const matchTime = new Date(dateStr.replace(" ", "T")).getTime();
                if (Date.now() >= matchTime - 600000) {
                    throw new BadRequestError("El tiempo para predecir este partido se ha agotado (se bloquea 10 mins antes).");
                }
            }
        } catch (err) {
            if (err.message && err.message.includes("predecir")) {
                throw err;
            }
        }
    }
    e.next();
}, "predictions");


// 4. Anti-Espionaje: Ocultar marcadores de otros usuarios en partidos no jugados
onRecordEnrich((e) => {
    // Esto se ejecuta en TODAS las lecturas (List, View, Realtime)
    const authRecord = e.requestInfo?.auth;
    const authId = authRecord ? authRecord.getId() : null;
    const userId = e.record.getString("user");
    
    // Si no es el dueño de la prediccion
    if (userId !== authId) {
        const matchId = e.record.getString("match");
        if (matchId) {
            try {
                // Recuperar estado del partido
                const match = $app.findRecordById("matches", matchId);
                if (!match.getBool("played")) {
                    const dateStr = match.getString("date");
                    if (dateStr) {
                        const matchTime = new Date(dateStr.replace(" ", "T")).getTime();
                        if (Date.now() < matchTime - 600000) {
                            // Partido aun no arranca -> ocultar score
                            e.record.set("homeScore", -1);
                            e.record.set("awayScore", -1);
                        }
                    }
                }
            } catch (err) {}
        }
    }
    
    e.next();
}, "predictions");


// 5. Sanitización de tags: siempre minúsculas y alfanuméricos
onRecordCreateRequest((e) => {
    const tag = e.record.getString("tag");
    if (tag) {
        const clean = typeof tag === "string" ? tag.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
        e.record.set("tag", clean);
    }
    e.next();
}, "matches");

onRecordUpdateRequest((e) => {
    const tag = e.record.getString("tag");
    if (tag) {
        const clean = typeof tag === "string" ? tag.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
        e.record.set("tag", clean);
    }
    e.next();
}, "matches");

onRecordCreateRequest((e) => {
    const tag = e.record.getString("tag");
    if (tag) {
        const clean = typeof tag === "string" ? tag.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
        e.record.set("tag", clean);
    }
    e.next();
}, "contests");

onRecordUpdateRequest((e) => {
    const tag = e.record.getString("tag");
    if (tag) {
        const clean = typeof tag === "string" ? tag.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
        e.record.set("tag", clean);
    }
    e.next();
}, "contests");
