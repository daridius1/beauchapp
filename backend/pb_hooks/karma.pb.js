/// <reference path="../pb_data/types.d.ts" />

// Hook v0.25+ para cálculo automático de Karma en el módulo de Problemas y Pautas
//
// El karma se mantiene con un contador incremental (delta aplicado en cada
// create/update/delete de una calificación) en vez de recalcularse completo en cada
// escritura. El recálculo completo solo corre en el cron diario de reconciliación, como
// corrección de deriva ante posibles bugs futuros.
//
// IMPORTANTE: el runtime JSVM de PocketBase NO conserva referencias a `const`/`function`
// declarados a nivel de archivo dentro de los callbacks registrados vía onRecordCreate/
// onRecordUpdate/onRecordDelete/cronAdd (cada callback se ejecuta de forma aislada; solo
// los globals reales como $app/require/__hooks siguen disponibles). Por eso cada callback
// de abajo es autocontenido: llama a require() y declara sus propios helpers localmente
// en vez de compartir funciones de nivel de archivo (eso causaba
// "ReferenceError: ... is not defined" en tiempo de ejecución real, aunque el archivo
// cargara sin error). La lógica pura sigue centralizada y testeada en lib/karma.js /
// lib/__tests__/karma.test.js — solo la orquestación con $app se duplica por callback.

onRecordCreate((e) => {
    const res = e.next();
    try {
        const problemId = e.record.getString("problem");
        if (problemId) {
            const prob = $app.findRecordById("problems", problemId);
            const authorId = prob.getString("author");
            if (authorId && !prob.getBool("deleted")) {
                const isPauta = Boolean(prob.getString("parent"));
                const { karmaDeltaForRating } = require(`${__hooks}/lib/karma.js`);
                const delta = karmaDeltaForRating(isPauta, e.record.getInt("rating") || 0, e.record.getInt("difficulty") || 0);
                if (delta) {
                    $app.db().newQuery("UPDATE users SET karma = karma + {:delta} WHERE id = {:id}").bind({ delta: delta, id: authorId }).execute();
                }
            }
        }
    } catch (err) {
        console.error("[karma.pb.js] Error en onRecordCreate:", err);
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
            if (authorId && !prob.getBool("deleted")) {
                const isPauta = Boolean(prob.getString("parent"));
                const { karmaDeltaForRating } = require(`${__hooks}/lib/karma.js`);
                const original = e.record.original();
                const oldDelta = karmaDeltaForRating(isPauta, original.getInt("rating") || 0, original.getInt("difficulty") || 0);
                const newDelta = karmaDeltaForRating(isPauta, e.record.getInt("rating") || 0, e.record.getInt("difficulty") || 0);
                const delta = newDelta - oldDelta;
                if (delta) {
                    $app.db().newQuery("UPDATE users SET karma = karma + {:delta} WHERE id = {:id}").bind({ delta: delta, id: authorId }).execute();
                }
            }
        }
    } catch (err) {
        console.error("[karma.pb.js] Error en onRecordUpdate:", err);
    }
    return res;
}, "problem_ratings");

onRecordDelete((e) => {
    const problemId = e.record.getString("problem");
    const rVal = e.record.getInt("rating") || 0;
    const dVal = e.record.getInt("difficulty") || 0;
    const res = e.next();
    try {
        if (problemId) {
            const prob = $app.findRecordById("problems", problemId);
            const authorId = prob.getString("author");
            if (authorId && !prob.getBool("deleted")) {
                const isPauta = Boolean(prob.getString("parent"));
                const { karmaDeltaForRating } = require(`${__hooks}/lib/karma.js`);
                const delta = karmaDeltaForRating(isPauta, rVal, dVal);
                if (delta) {
                    $app.db().newQuery("UPDATE users SET karma = karma - {:delta} WHERE id = {:id}").bind({ delta: delta, id: authorId }).execute();
                }
            }
        }
    } catch (err) {
        console.error("[karma.pb.js] Error en onRecordDelete:", err);
    }
    return res;
}, "problem_ratings");

// Reconciliación completa una vez al día (no cada 5 min): corrige cualquier deriva del
// contador incremental sin recorrer usuarios/problemas/calificaciones en cada escritura.
// Pagina de a PAGE_SIZE usuarios en vez de truncar silenciosamente a un límite fijo.
cronAdd("recalculate_all_user_karma", "17 4 * * *", () => {
    try {
        const { karmaDeltaForRating } = require(`${__hooks}/lib/karma.js`);

        function recalculateFullKarmaForAuthor(authorId) {
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
                        totalKarma += karmaDeltaForRating(isPauta, r.getInt("rating") || 0, r.getInt("difficulty") || 0);
                    }
                }
            }
            $app.db().newQuery("UPDATE users SET karma = {:karma} WHERE id = {:id}").bind({ karma: totalKarma, id: authorId }).execute();
        }

        const PAGE_SIZE = 200;
        let offset = 0;
        while (true) {
            const usersPage = $app.findRecordsByFilter("users", "id != ''", "-created", PAGE_SIZE, offset);
            if (!usersPage || usersPage.length === 0) break;
            for (let uIdx = 0; uIdx < usersPage.length; uIdx++) {
                const authorId = usersPage[uIdx].id;
                if (authorId) {
                    recalculateFullKarmaForAuthor(authorId);
                }
            }
            if (usersPage.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }
    } catch (cErr) {
        console.error("[karma.pb.js] Error en cron recalculate_all_user_karma:", cErr);
    }
});
