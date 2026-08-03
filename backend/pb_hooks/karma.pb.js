/// <reference path="../pb_data/types.d.ts" />

// Hook v0.25+ para cálculo automático de Karma en el módulo de Problemas y Pautas

onRecordCreate((e) => {
    const res = e.next();
    try {
        const problemId = e.record.getString("problem");
        if (problemId) {
            const prob = $app.findRecordById("problems", problemId);
            const authorId = prob.getString("author");
            if (authorId) {
                const authorProblems = $app.findRecordsByFilter("problems", "author = {:author}", "-created", 5000, 0, { author: authorId });
                let totalKarma = 0;
                if (authorProblems && authorProblems.length > 0) {
                    for (let i = 0; i < authorProblems.length; i++) {
                        const p = authorProblems[i];
                        if (p.getBool("deleted")) continue;
                        const isPauta = Boolean(p.getString("parent"));
                        let ratings = [];
                        try {
                            ratings = $app.findRecordsByFilter("problem_ratings", "problem = {:probId}", "-created", 5000, 0, { probId: p.id });
                        } catch (rErr) {}
                        for (let j = 0; j < ratings.length; j++) {
                            const r = ratings[j];
                            const rVal = r.getInt("rating") || 0;
                            const dVal = r.getInt("difficulty") || 0;
                            if (!isPauta) {
                                if (rVal > 0) totalKarma += 2 * (rVal - 3);
                            } else {
                                if (rVal > 0) totalKarma += 1 * (rVal - 3);
                                if (dVal > 0) totalKarma += 1 * (dVal - 3);
                            }
                        }
                    }
                }
                $app.db().newQuery("UPDATE users SET karma = {:karma} WHERE id = {:id}").bind({ karma: totalKarma, id: authorId }).execute();
                console.log(`[karma.pb.js] onRecordCreate: Recalculado karma para ${authorId}: ${totalKarma}`);
            }
        }
    } catch (err) {
        console.log("[karma.pb.js] Error en onRecordCreate:", err);
    }
    return res;
}, "problem_ratings");

onRecordUpdate((e) => {
    const res = e.next();
    try {
        const problemId = e.record.getString("problem");
        if (problemId) {
            const prob = $app.findRecordById("problems", problemId);
            const authorId = prob.getString("author");
            if (authorId) {
                const authorProblems = $app.findRecordsByFilter("problems", "author = {:author}", "-created", 5000, 0, { author: authorId });
                let totalKarma = 0;
                if (authorProblems && authorProblems.length > 0) {
                    for (let i = 0; i < authorProblems.length; i++) {
                        const p = authorProblems[i];
                        if (p.getBool("deleted")) continue;
                        const isPauta = Boolean(p.getString("parent"));
                        let ratings = [];
                        try {
                            ratings = $app.findRecordsByFilter("problem_ratings", "problem = {:probId}", "-created", 5000, 0, { probId: p.id });
                        } catch (rErr) {}
                        for (let j = 0; j < ratings.length; j++) {
                            const r = ratings[j];
                            const rVal = r.getInt("rating") || 0;
                            const dVal = r.getInt("difficulty") || 0;
                            if (!isPauta) {
                                if (rVal > 0) totalKarma += 2 * (rVal - 3);
                            } else {
                                if (rVal > 0) totalKarma += 1 * (rVal - 3);
                                if (dVal > 0) totalKarma += 1 * (dVal - 3);
                            }
                        }
                    }
                }
                $app.db().newQuery("UPDATE users SET karma = {:karma} WHERE id = {:id}").bind({ karma: totalKarma, id: authorId }).execute();
                console.log(`[karma.pb.js] onRecordUpdate: Recalculado karma para ${authorId}: ${totalKarma}`);
            }
        }
    } catch (err) {
        console.log("[karma.pb.js] Error en onRecordUpdate:", err);
    }
    return res;
}, "problem_ratings");

onRecordDelete((e) => {
    const problemId = e.record.getString("problem");
    const res = e.next();
    try {
        if (problemId) {
            const prob = $app.findRecordById("problems", problemId);
            const authorId = prob.getString("author");
            if (authorId) {
                const authorProblems = $app.findRecordsByFilter("problems", "author = {:author}", "-created", 5000, 0, { author: authorId });
                let totalKarma = 0;
                if (authorProblems && authorProblems.length > 0) {
                    for (let i = 0; i < authorProblems.length; i++) {
                        const p = authorProblems[i];
                        if (p.getBool("deleted")) continue;
                        const isPauta = Boolean(p.getString("parent"));
                        let ratings = [];
                        try {
                            ratings = $app.findRecordsByFilter("problem_ratings", "problem = {:probId}", "-created", 5000, 0, { probId: p.id });
                        } catch (rErr) {}
                        for (let j = 0; j < ratings.length; j++) {
                            const r = ratings[j];
                            const rVal = r.getInt("rating") || 0;
                            const dVal = r.getInt("difficulty") || 0;
                            if (!isPauta) {
                                if (rVal > 0) totalKarma += 2 * (rVal - 3);
                            } else {
                                if (rVal > 0) totalKarma += 1 * (rVal - 3);
                                if (dVal > 0) totalKarma += 1 * (dVal - 3);
                            }
                        }
                    }
                }
                $app.db().newQuery("UPDATE users SET karma = {:karma} WHERE id = {:id}").bind({ karma: totalKarma, id: authorId }).execute();
                console.log(`[karma.pb.js] onRecordDelete: Recalculado karma para ${authorId}: ${totalKarma}`);
            }
        }
    } catch (err) {
        console.log("[karma.pb.js] Error en onRecordDelete:", err);
    }
    return res;
}, "problem_ratings");

cronAdd("recalculate_all_user_karma", "*/5 * * * *", () => {
    try {
        const allUsers = $app.findRecordsByFilter("users", "id != ''", "-created", 5000, 0);
        for (let uIdx = 0; uIdx < allUsers.length; uIdx++) {
            const authorId = allUsers[uIdx].id;
            if (authorId) {
                const authorProblems = $app.findRecordsByFilter("problems", "author = {:author}", "-created", 5000, 0, { author: authorId });
                let totalKarma = 0;
                if (authorProblems && authorProblems.length > 0) {
                    for (let i = 0; i < authorProblems.length; i++) {
                        const p = authorProblems[i];
                        if (p.getBool("deleted")) continue;
                        const isPauta = Boolean(p.getString("parent"));
                        let ratings = [];
                        try {
                            ratings = $app.findRecordsByFilter("problem_ratings", "problem = {:probId}", "-created", 5000, 0, { probId: p.id });
                        } catch (rErr) {}
                        for (let j = 0; j < ratings.length; j++) {
                            const r = ratings[j];
                            const rVal = r.getInt("rating") || 0;
                            const dVal = r.getInt("difficulty") || 0;
                            if (!isPauta) {
                                if (rVal > 0) totalKarma += 2 * (rVal - 3);
                            } else {
                                if (rVal > 0) totalKarma += 1 * (rVal - 3);
                                if (dVal > 0) totalKarma += 1 * (dVal - 3);
                            }
                        }
                    }
                }
                $app.db().newQuery("UPDATE users SET karma = {:karma} WHERE id = {:id}").bind({ karma: totalKarma, id: authorId }).execute();
            }
        }
    } catch (cErr) {
        console.log("[karma.pb.js] Error en cron recalculate_all_user_karma:", cErr);
    }
});
