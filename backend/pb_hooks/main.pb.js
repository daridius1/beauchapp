// Beauchapp PocketBase Hooks
// Lógica de negocio del lado del servidor

// 1. Filtro de exclusividad universitaria
// Interceptar el registro de usuarios para validar el correo institucional @ing.uchile.cl
onRecordBeforeCreateRequest((e) => {
    const email = e.record.getString("email");
    
    if (!email) {
        throw new BadRequestError("El correo electrónico es requerido.");
    }
    
    if (!email.endsWith("@ing.uchile.cl")) {
        throw new BadRequestError("Acceso denegado. Solo se permiten correos con el dominio @ing.uchile.cl");
    }
}, "users");

// 2. Recálculo automático de puntuación para predicciones
// Cuando un administrador actualiza un partido y define su resultado oficial
onRecordAfterUpdateRequest((e) => {
    const played = e.record.getBool("played");
    const matchId = e.record.getId();
    const homeScore = e.record.getInt("homeScore");
    const awayScore = e.record.getInt("awayScore");
    
    console.log("Match updated: " + matchId + ", played: " + played + " (" + homeScore + "-" + awayScore + ")");
    
    // Obtener todas las predicciones asociadas a este partido
    const predictions = $app.dao().findRecordsByFilter(
        "predictions",
        "match = {:matchId}",
        "",
        5000,
        0,
        { matchId: matchId }
    );
    
    console.log("Calculando puntos para " + predictions.length + " predicciones...");
    
    for (let i = 0; i < predictions.length; i++) {
        const pred = predictions[i];
        let points = 0;
        
        if (played) {
            const predHome = pred.getInt("homeScore");
            const predAway = pred.getInt("awayScore");
            
            if (predHome === homeScore && predAway === awayScore) {
                // 1. Marcador exacto
                points = 3;
            } else {
                const predDiff = predHome - predAway;
                const matchDiff = homeScore - awayScore;
                
                const predOutcome = predDiff > 0 ? 1 : (predDiff < 0 ? -1 : 0);
                const matchOutcome = matchDiff > 0 ? 1 : (matchDiff < 0 ? -1 : 0);
                
                if (predOutcome === matchOutcome) {
                    // 2. Ganador o empate correcto pero marcador incorrecto
                    points = 1;
                }
            }
        }
        
        // Guardar puntos en la predicción de forma explícita
        pred.set("points", points);
        $app.dao().saveRecord(pred);
    }
    
    console.log("Recálculo completado.");
}, "matches");

// 3. Validar seguridad: No permitir apuestas de partidos bloqueados o jugados
onRecordBeforeCreateRequest((e) => {
    const matchId = e.record.getString("match");
    if (!matchId) return;

    try {
        const match = $app.dao().findRecordById("matches", matchId);
        if (match.getBool("played")) {
            throw new BadRequestError("No puedes predecir un partido que ya finalizó.");
        }
        const matchDateStr = match.getString("date");
        if (matchDateStr) {
            const matchTime = new Date(matchDateStr.replace(" ", "T")).getTime();
            if (Date.now() >= matchTime - 600000) {
                throw new BadRequestError("El tiempo para predecir este partido se ha agotado (se bloquea 10 mins antes).");
            }
        }
    } catch (err) {
        if (err.message && err.message.includes("predecir")) {
            throw err;
        }
    }
}, "predictions");

onRecordBeforeUpdateRequest((e) => {
    // Si los goles no cambiaron, es un recálculo interno del servidor (actualizando puntos), se permite
    try {
        const oldPred = $app.dao().findRecordById("predictions", e.record.getId());
        if (oldPred.getInt("homeScore") === e.record.getInt("homeScore") && 
            oldPred.getInt("awayScore") === e.record.getInt("awayScore")) {
            return;
        }
    } catch(err) {}

    const matchId = e.record.getString("match");
    if (!matchId) return;

    try {
        const match = $app.dao().findRecordById("matches", matchId);
        if (match.getBool("played")) {
            throw new BadRequestError("No puedes predecir un partido que ya finalizó.");
        }
        const matchDateStr = match.getString("date");
        if (matchDateStr) {
            const matchTime = new Date(matchDateStr.replace(" ", "T")).getTime();
            if (Date.now() >= matchTime - 600000) {
                throw new BadRequestError("El tiempo para predecir este partido se ha agotado (se bloquea 10 mins antes).");
            }
        }
    } catch (err) {
        if (err.message && err.message.includes("predecir")) {
            throw err;
        }
    }
}, "predictions");

// 4. Anti-Espionaje: Ocultar marcadores de otros usuarios en partidos no jugados/bloqueados
onRecordsListRequest((e) => {
    const authId = e.httpContext ? e.httpContext.get("authRecord")?.id : null;
    const now = Date.now();
    const records = e.records || [];
    const matchIds = [];
    
    for (let i = 0; i < records.length; i++) {
        const mid = records[i].get("match");
        if (mid && !matchIds.includes(mid)) matchIds.push(mid);
    }
    if (matchIds.length === 0) return;
    
    const matchMap = {};
    const matches = $app.dao().findRecordsByIds("matches", matchIds);
    for (let i = 0; i < matches.length; i++) {
        matchMap[matches[i].getId()] = matches[i];
    }
    
    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (r.get("user") === authId) continue;
        const match = matchMap[r.get("match")];
        if (!match || match.getBool("played")) continue;
        
        const dateStr = match.getString("date");
        if (dateStr) {
            const matchTime = new Date(dateStr.replace(" ", "T")).getTime();
            if (now < matchTime - 600000) {
                r.set("homeScore", -1);
                r.set("awayScore", -1);
            }
        }
    }
}, "predictions");

onRecordViewRequest((e) => {
    const authId = e.httpContext ? e.httpContext.get("authRecord")?.id : null;
    const now = Date.now();
    if (!e.record) return;
    
    if (e.record.get("user") === authId) return;
    const matchId = e.record.get("match");
    if (!matchId) return;
    
    try {
        const match = $app.dao().findRecordById("matches", matchId);
        if (match.getBool("played")) return;
        
        const dateStr = match.getString("date");
        if (dateStr) {
            const matchTime = new Date(dateStr.replace(" ", "T")).getTime();
            if (now < matchTime - 600000) {
                e.record.set("homeScore", -1);
                e.record.set("awayScore", -1);
            }
        }
    } catch (err) {}
}, "predictions");
