/// <reference path="../pb_data/types.d.ts" />

// Hook v0.25+ para cálculo automático de Karma en el módulo de Problemas y Pautas

function recalculateUserKarma(userId) {
    if (!userId) return;
    try {
        const authorProblems = $app.findRecordsByFilter(
            "problems",
            "author = {:author}",
            "-created",
            5000,
            0,
            { author: userId }
        );

        let totalKarma = 0;

        if (authorProblems && authorProblems.length > 0) {
            for (let i = 0; i < authorProblems.length; i++) {
                const prob = authorProblems[i];
                // Omitir si la publicación fue eliminada
                if (prob.getBool("deleted")) continue;

                const isPauta = Boolean(prob.getString("parent"));

                let ratings = [];
                try {
                    ratings = $app.findRecordsByFilter(
                        "problem_ratings",
                        "problem = {:probId}",
                        "-created",
                        5000,
                        0,
                        { probId: prob.id }
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
        }

        // Actualización directa atómica vía SQL DBQuery para evitar fallos de validación de AuthCollection
        $app.db()
            .newQuery("UPDATE users SET karma = {:karma} WHERE id = {:id}")
            .bind({ karma: totalKarma, id: userId })
            .execute();

        console.log(`[karma.pb.js] Recalculado karma para usuario ${userId}: ${totalKarma}`);
    } catch (err) {
        console.log(`[karma.pb.js] Error recalculando karma para ${userId}:`, err);
    }
}

// 1. HTTP API Hooks (PocketBase v0.25+):
onRecordCreateRequest((e) => {
    const res = e.next();
    try {
        const problemId = e.record.getString("problem");
        if (problemId) {
            const prob = $app.findRecordById("problems", problemId);
            const authorId = prob.getString("author");
            recalculateUserKarma(authorId);
        }
    } catch (err) {
        console.log("[karma.pb.js] Error en onRecordCreateRequest:", err);
    }
    return res;
}, "problem_ratings");

onRecordUpdateRequest((e) => {
    const res = e.next();
    try {
        const problemId = e.record.getString("problem");
        if (problemId) {
            const prob = $app.findRecordById("problems", problemId);
            const authorId = prob.getString("author");
            recalculateUserKarma(authorId);
        }
    } catch (err) {
        console.log("[karma.pb.js] Error en onRecordUpdateRequest:", err);
    }
}, "problem_ratings");

onRecordDeleteRequest((e) => {
    const problemId = e.record.getString("problem");
    const res = e.next();
    try {
        if (problemId) {
            const prob = $app.findRecordById("problems", problemId);
            const authorId = prob.getString("author");
            recalculateUserKarma(authorId);
        }
    } catch (err) {
        console.log("[karma.pb.js] Error en onRecordDeleteRequest:", err);
    }
}, "problem_ratings");

onRecordUpdateRequest((e) => {
    const res = e.next();
    try {
        const authorId = e.record.getString("author");
        if (authorId) {
            recalculateUserKarma(authorId);
        }
    } catch (err) {}
    return res;
}, "problems");

// 2. Cron de fondo para sincronización periódica de todo el Karma
cronAdd("recalculate_all_user_karma", "*/5 * * * *", () => {
    try {
        const allUsers = $app.findRecordsByFilter("users", "id != ''", "-created", 5000, 0);
        for (let uIdx = 0; uIdx < allUsers.length; uIdx++) {
            recalculateUserKarma(allUsers[uIdx].id);
        }
    } catch (cErr) {
        console.log("[karma.pb.js] Error en cron recalculate_all_user_karma:", cErr);
    }
});
