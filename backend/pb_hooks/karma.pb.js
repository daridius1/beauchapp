/// <reference path="../pb_data/types.d.ts" />

// Hook para cálculo automático de Karma en el módulo de Problemas y Pautas

function recalculateUserKarma(userId) {
    if (!userId) return;
    try {
        // Consulta directa usando dbx.hashExp para 100% de confiabilidad
        const authorProblems = $app.findAllRecords(
            "problems",
            $dbx.hashExp({ "author": userId })
        );

        if (!authorProblems || authorProblems.length === 0) {
            try {
                const u = $app.findRecordById("users", userId);
                u.set("karma", 0);
                $app.save(u);
            } catch (e) {}
            return;
        }

        let totalKarma = 0;

        for (let i = 0; i < authorProblems.length; i++) {
            const prob = authorProblems[i];
            // Omitir si la publicación fue eliminada
            if (prob.getBool("deleted")) continue;

            const isPauta = Boolean(prob.getString("parent"));

            let ratings = [];
            try {
                ratings = $app.findAllRecords(
                    "problem_ratings",
                    $dbx.hashExp({ "problem": prob.id })
                );
            } catch (rErr) {}

            for (let j = 0; j < ratings.length; j++) {
                const r = ratings[j];
                const ratingVal = r.getInt("rating") || 0;
                const diffVal = r.getInt("difficulty") || 0;

                if (!isPauta) {
                    // Problema (Enunciado): 2x de peso en rating (Enunciado), la dificultad no cuenta
                    if (ratingVal > 0) {
                        totalKarma += 2 * (ratingVal - 3);
                    }
                } else {
                    // Pauta (Solución): 1x de peso en rating (Solución) + 1x de peso en difficulty (Explicación)
                    if (ratingVal > 0) {
                        totalKarma += 1 * (ratingVal - 3);
                    }
                    if (diffVal > 0) {
                        totalKarma += 1 * (diffVal - 3);
                    }
                }
            }
        }

        const userRec = $app.findRecordById("users", userId);
        userRec.set("karma", totalKarma);
        $app.save(userRec);
        console.log(`[karma.pb.js] Recalculado karma para usuario ${userId}: ${totalKarma}`);
    } catch (err) {
        console.log(`[karma.pb.js] Error recalculando karma para ${userId}:`, err);
    }
}

// Hook al crear una calificación en problem_ratings
onRecordAfterCreateSuccess((e) => {
    try {
        const problemId = e.record.getString("problem");
        if (problemId) {
            const prob = $app.findRecordById("problems", problemId);
            const authorId = prob.getString("author");
            recalculateUserKarma(authorId);
        }
    } catch (err) {
        console.log("[karma.pb.js] Error en onRecordAfterCreateSuccess:", err);
    }
}, "problem_ratings");

// Hook al actualizar una calificación en problem_ratings
onRecordAfterUpdateSuccess((e) => {
    try {
        const problemId = e.record.getString("problem");
        if (problemId) {
            const prob = $app.findRecordById("problems", problemId);
            const authorId = prob.getString("author");
            recalculateUserKarma(authorId);
        }
    } catch (err) {
        console.log("[karma.pb.js] Error en onRecordAfterUpdateSuccess:", err);
    }
}, "problem_ratings");

// Hook al borrar una calificación en problem_ratings
onRecordAfterDeleteSuccess((e) => {
    try {
        const problemId = e.record.getString("problem");
        if (problemId) {
            const prob = $app.findRecordById("problems", problemId);
            const authorId = prob.getString("author");
            recalculateUserKarma(authorId);
        }
    } catch (err) {
        console.log("[karma.pb.js] Error en onRecordAfterDeleteSuccess:", err);
    }
}, "problem_ratings");

// Hook si se marca como borrado o restaura un problema o pauta
onRecordAfterUpdateSuccess((e) => {
    try {
        const authorId = e.record.getString("author");
        if (authorId) {
            recalculateUserKarma(authorId);
        }
    } catch (err) {}
}, "problems");

// Recálculo inicial de todos los usuarios al iniciar servidor
try {
    const allUsers = $app.findAllRecords("users");
    for (let uIdx = 0; uIdx < allUsers.length; uIdx++) {
        recalculateUserKarma(allUsers[uIdx].id);
    }
} catch (bootErr) {
    console.log("[karma.pb.js] Error en recálculo inicial:", bootErr);
}
