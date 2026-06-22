// Beauchapp PocketBase Hooks
// Lógica de negocio del lado del servidor

// 1. Filtro de exclusividad universitaria
// Interceptar el registro de usuarios para validar el correo institucional @ug.uchile.cl
onRecordBeforeCreateRequest((e) => {
    const email = e.record.getString("email");
    
    if (!email) {
        throw new BadRequestError("El correo electrónico es requerido.");
    }
    
    if (!email.endsWith("@ug.uchile.cl")) {
        throw new BadRequestError("Acceso denegado. Solo se permiten correos con el dominio @ug.uchile.cl");
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
