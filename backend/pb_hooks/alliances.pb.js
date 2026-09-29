/// <reference path="../pb_data/types.d.ts" />

// Nikita Jump. La colección no expone reglas directas: la alianza solo se cambia por
// esta API. Cada partida verificada suma al aporte total y el récord solo puede subir.

routerAdd("GET", "/api/alliances/nikita", (e) => {
    try {
        const { buildAllianceScoreboard } = require(`${__hooks}/lib/alliances.js`);
        const { NIKITA_SKIN_PRICE } = require(`${__hooks}/lib/nikitaSkins.js`);
        const aggregateRows = arrayOf(new DynamicModel({ alliance: "", points: 0, players: 0 }));
        $app.db().newQuery(
            "SELECT alliance, COALESCE(SUM(total_score), 0) AS points, COUNT(*) AS players " +
            "FROM alliance_nikita_scores GROUP BY alliance"
        ).all(aggregateRows);

        let myAlliance = null;
        let myHighScore = 0;
        let myTotalScore = 0;
        let selectedSkin = "";
        try {
            const mine = $app.findFirstRecordByFilter(
                "alliance_nikita_scores", "user = {:user}", { user: e.auth.id }
            );
            myAlliance = mine.getString("alliance") || null;
            myHighScore = mine.getInt("high_score") || 0;
            myTotalScore = mine.getInt("total_score") || 0;
            selectedSkin = mine.getString("selected_skin") || "";
        } catch (notFound) { /* todavía no elige alianza */ }

        const ownedSkins = $app.findRecordsByFilter(
            "alliance_nikita_skins", "user = {:user}", "created", 100, 0, { user: e.auth.id }
        ).map((record) => record.getString("skin"));

        return e.json(200, {
            myAlliance,
            myHighScore,
            myTotalScore,
            beautokens: e.auth.getInt("beautokens") || 0,
            ownedSkins,
            selectedSkin,
            skinPrice: NIKITA_SKIN_PRICE,
            scoreboard: buildAllianceScoreboard(aggregateRows),
        });
    } catch (err) {
        console.error("[alliances.pb.js] Error al cargar Nikita Jump:", err);
        return e.json(500, { error: "No se pudo cargar Nikita Jump." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/alliances/alliance", (e) => {
    try {
        const { isAllianceId } = require(`${__hooks}/lib/alliances.js`);
        if (e.auth.getString("type") !== "student") {
            return e.json(403, { error: "Solo las cuentas de estudiante pueden competir por una alianza." });
        }
        const alliance = String((e.requestInfo().body || {}).alliance || "");
        if (!isAllianceId(alliance)) {
            return e.json(400, { error: "Alianza inválida." });
        }

        let existing = null;
        try {
            existing = $app.findFirstRecordByFilter(
                "alliance_nikita_scores", "user = {:user}", { user: e.auth.id }
            );
        } catch (notFound) { /* primera elección */ }

        if (existing) {
            const highScore = existing.getInt("high_score") || 0;
            if (existing.getString("alliance") === alliance) {
                return e.json(200, { alliance, highScore });
            }

            // La alianza representa al jugador, no a una acción aislada. Al cambiarla,
            // sus aportes anteriores se mueven juntos para impedir repartir puntos.
            $app.runInTransaction((txApp) => {
                const membership = txApp.findFirstRecordByFilter(
                    "alliance_nikita_scores", "user = {:user}", { user: e.auth.id }
                );
                membership.set("alliance", alliance);
                txApp.save(membership);

                const claims = txApp.findRecordsByFilter(
                    "alliance_professor_claims", "user = {:user} && deleted = false", "", 1000, 0,
                    { user: e.auth.id }
                );
                claims.forEach((claim) => {
                    claim.set("alliance", alliance);
                    txApp.save(claim);
                });
            });
            return e.json(200, { alliance, highScore });
        }

        const collection = $app.findCollectionByNameOrId("alliance_nikita_scores");
        const score = new Record(collection);
        score.set("user", e.auth.id);
        score.set("alliance", alliance);
        score.set("high_score", 0);
        score.set("total_score", 0);
        $app.save(score);
        return e.json(200, { alliance, highScore: 0 });
    } catch (err) {
        console.error("[alliances.pb.js] Error al elegir alianza:", err);
        return e.json(500, { error: "No se pudo guardar tu alianza." });
    }
}, $apis.requireAuth("users"));

// Cazaprofes: la lista se pagina y filtra en SQLite. Las colecciones quedan cerradas
// a la API directa para que la alianza y la autoría de cada captura siempre las fije
// el servidor, y no lo que mande el cliente.
routerAdd("GET", "/api/alliances/professors", (e) => {
    try {
        const { buildProfessorScoreboard, normalizeProfessorSearch } = require(`${__hooks}/lib/alliances.js`);
        const query = e.request.url.query();
        const page = Math.max(1, Math.floor(Number(query.get("page")) || 1));
        const perPage = Math.min(40, Math.max(10, Math.floor(Number(query.get("perPage")) || 30)));
        const status = ["available", "claimed", "all"].includes(query.get("status"))
            ? query.get("status")
            : "available";
        const search = normalizeProfessorSearch(query.get("q"));
        const conditions = ["p.semester = {:semester}"];
        const params = { semester: "20262", limit: perPage, offset: (page - 1) * perPage };

        if (search) {
            conditions.push("p.search_name LIKE {:search}");
            params.search = `%${search}%`;
        }
        if (status === "available") conditions.push("c.id IS NULL");
        if (status === "claimed") conditions.push("c.id IS NOT NULL");
        const where = conditions.join(" AND ");

        const rows = arrayOf(new DynamicModel({
            id: "", name: "", departments: "", claim_id: "", alliance: "", photo: "", claimed_at: "",
        }));
        $app.db().newQuery(
            "SELECT p.id, p.name, p.departments, COALESCE(c.id, '') AS claim_id, " +
            "COALESCE(c.alliance, '') AS alliance, COALESCE(c.photo, '') AS photo, " +
            "COALESCE(c.created, '') AS claimed_at " +
            "FROM alliance_professors p " +
            "LEFT JOIN alliance_professor_claims c ON c.professor = p.id AND c.deleted = false " +
            `WHERE ${where} ORDER BY p.name COLLATE NOCASE LIMIT {:limit} OFFSET {:offset}`
        ).bind(params).all(rows);

        const totals = arrayOf(new DynamicModel({ total: 0 }));
        $app.db().newQuery(
            "SELECT COUNT(*) AS total FROM alliance_professors p " +
            "LEFT JOIN alliance_professor_claims c ON c.professor = p.id AND c.deleted = false " +
            `WHERE ${where}`
        ).bind(params).all(totals);

        const aggregateRows = arrayOf(new DynamicModel({ alliance: "", professors: 0 }));
        $app.db().newQuery(
            "SELECT alliance, COUNT(*) AS professors FROM alliance_professor_claims " +
            "WHERE deleted = false GROUP BY alliance"
        ).all(aggregateRows);

        // Una muestra acotada alimenta el carrusel sin obligar al cliente a hacer otra
        // petición ni a descargar el catálogo completo de adjudicados.
        const galleryRows = arrayOf(new DynamicModel({
            professor_id: "", name: "", claim_id: "", alliance: "", photo: "", claimed_at: "",
        }));
        $app.db().newQuery(
            "SELECT p.id AS professor_id, p.name, c.id AS claim_id, c.alliance, c.photo, " +
            "c.created AS claimed_at FROM alliance_professor_claims c " +
            "INNER JOIN alliance_professors p ON p.id = c.professor " +
            "WHERE c.deleted = false AND p.semester = {:semester} " +
            "ORDER BY c.created DESC LIMIT 12"
        ).bind({ semester: "20262" }).all(galleryRows);

        let myAlliance = null;
        try {
            myAlliance = $app.findFirstRecordByFilter(
                "alliance_nikita_scores", "user = {:user}", { user: e.auth.id }
            ).getString("alliance") || null;
        } catch (notFound) { /* todavía no elige alianza competitiva */ }

        const total = totals.length ? Number(totals[0].total) || 0 : 0;
        return e.json(200, {
            semester: "2026 Primavera",
            myAlliance,
            scoreboard: buildProfessorScoreboard(aggregateRows),
            claimCollectionId: $app.findCollectionByNameOrId("alliance_professor_claims").id,
            page,
            perPage,
            total,
            totalPages: Math.max(1, Math.ceil(total / perPage)),
            gallery: galleryRows.map((row) => ({
                professorId: row.professor_id,
                name: row.name,
                claim: {
                    id: row.claim_id,
                    alliance: row.alliance,
                    photo: row.photo,
                    created: row.claimed_at,
                },
            })),
            items: rows.map((row) => {
                let departments = [];
                try { departments = JSON.parse(String(row.departments || "[]")); } catch (err) {}
                return {
                    id: row.id,
                    name: row.name,
                    departments,
                    claim: row.claim_id ? {
                        id: row.claim_id,
                        alliance: row.alliance,
                        photo: row.photo,
                        created: row.claimed_at,
                    } : null,
                };
            }),
        });
    } catch (err) {
        console.error("[alliances.pb.js] Error al cargar Cazaprofes:", err);
        return e.json(500, { error: "No se pudo cargar la lista de profesores." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/alliances/professors/{professorId}/claim", (e) => {
    try {
        if (e.auth.getString("type") !== "student") {
            return e.json(403, { error: "Solo las cuentas de estudiante pueden subir fotos." });
        }

        let membership;
        try {
            membership = $app.findFirstRecordByFilter(
                "alliance_nikita_scores", "user = {:user}", { user: e.auth.id }
            );
        } catch (notFound) {
            return e.json(400, { error: "Primero elige la alianza a la que quieres aportar." });
        }

        const files = e.findUploadedFiles("photo");
        if (files.length !== 1) {
            return e.json(400, { error: "Debes adjuntar exactamente una foto." });
        }

        const professorId = String(e.request.pathValue("professorId") || "");
        const collection = $app.findCollectionByNameOrId("alliance_professor_claims");
        let savedId = "";
        try {
            $app.runInTransaction((txApp) => {
                const professor = txApp.findRecordById("alliance_professors", professorId);
                if (professor.getString("semester") !== "20262") {
                    throw new Error("PROFESSOR_NOT_CURRENT");
                }
                const existing = txApp.findRecordsByFilter(
                    "alliance_professor_claims", "professor = {:professor} && deleted = false", "", 1, 0,
                    { professor: professorId }
                );
                if (existing.length > 0) throw new Error("PROFESSOR_ALREADY_CLAIMED");

                const claim = new Record(collection);
                claim.set("professor", professorId);
                claim.set("user", e.auth.id);
                claim.set("alliance", membership.getString("alliance"));
                claim.set("photo", files[0]);
                claim.set("deleted", false);
                txApp.save(claim);
                savedId = claim.id;
            });
        } catch (err) {
            const message = String(err && (err.message || err));
            if (message.includes("PROFESSOR_ALREADY_CLAIMED") || message.includes("idx_alliance_professor_claim")) {
                return e.json(409, { error: "Otra alianza ya se adjudicó a este profesor." });
            }
            if (message.includes("PROFESSOR_NOT_CURRENT")) {
                return e.json(400, { error: "Este profesor no pertenece al catálogo vigente." });
            }
            throw err;
        }

        const saved = $app.findRecordById("alliance_professor_claims", savedId);
        return e.json(201, {
            id: saved.id,
            alliance: saved.getString("alliance"),
            photo: saved.getString("photo"),
            created: saved.getString("created"),
        });
    } catch (err) {
        console.error("[alliances.pb.js] Error al adjudicar profesor:", err);
        return e.json(500, { error: "No se pudo guardar la foto." });
    }
}, $apis.requireAuth("users"), $apis.bodyLimit(2500000));

routerAdd("POST", "/api/alliances/nikita/start", (e) => {
    try {
        const { nikitaRunPayload } = require(`${__hooks}/lib/alliances.js`);
        const { TICK_RATE, MAX_TICKS } = require(`${__hooks}/lib/nikitaJump.js`);

        try {
            $app.findFirstRecordByFilter(
                "alliance_nikita_scores", "user = {:user}", { user: e.auth.id }
            );
        } catch (notFound) {
            return e.json(400, { error: "Primero elige la alianza a la que quieres aportar." });
        }

        const secretRecord = $app.findFirstRecordByFilter(
            "alliance_game_secrets", "game = 'nikita-jump'"
        );
        const runId = $security.randomString(24);
        const startedAt = Date.now();
        const seed = parseInt($security.sha256(`${runId}|${startedAt}`).slice(0, 8), 16) >>> 0;
        const payload = nikitaRunPayload(e.auth.id, runId, seed, startedAt);
        const signature = $security.hs256(payload, secretRecord.getString("secret"));
        return e.json(200, { runId, seed, startedAt, signature, tickRate: TICK_RATE, maxTicks: MAX_TICKS });
    } catch (err) {
        console.error("[alliances.pb.js] Error al iniciar partida:", err);
        return e.json(500, { error: "No se pudo iniciar la partida." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/alliances/nikita/score", (e) => {
    try {
        const { sanitizeNikitaScore, nikitaRunPayload } = require(`${__hooks}/lib/alliances.js`);
        const { TICK_RATE, simulateNikitaReplay } = require(`${__hooks}/lib/nikitaJump.js`);
        const { nikitaRewardForScore } = require(`${__hooks}/lib/nikitaSkins.js`);
        const body = e.requestInfo().body || {};
        const runId = String(body.runId || "");
        const seed = Number(body.seed);
        const startedAt = Number(body.startedAt);
        const signature = String(body.signature || "");
        const claimedScore = sanitizeNikitaScore(body.claimedScore);

        if (!/^[A-Za-z0-9]{24}$/.test(runId) || !Number.isInteger(seed) || seed < 0 || seed > 4294967295
            || !Number.isInteger(startedAt) || !signature || claimedScore === null) {
            return e.json(400, { error: "Partida inválida." });
        }

        let mine;
        try {
            mine = $app.findFirstRecordByFilter(
                "alliance_nikita_scores", "user = {:user}", { user: e.auth.id }
            );
        } catch (notFound) {
            return e.json(400, { error: "Primero elige la alianza a la que quieres aportar." });
        }

        const previous = mine.getInt("high_score") || 0;
        const redeemed = $app.findRecordsByFilter(
            "alliance_nikita_runs", "run_id = {:run}", "", 1, 0, { run: runId }
        );
        if (redeemed.length > 0) {
            if (redeemed[0].getString("user") !== e.auth.id) {
                return e.json(400, { error: "Partida inválida." });
            }
            const currentUser = $app.findRecordById("users", e.auth.id);
            const currentScore = $app.findRecordById("alliance_nikita_scores", mine.id);
            return e.json(200, {
                highScore: currentScore.getInt("high_score") || 0,
                totalScore: currentScore.getInt("total_score") || 0,
                improved: false,
                verifiedScore: redeemed[0].getInt("score") || 0,
                reward: 0,
                beautokens: currentUser.getInt("beautokens") || 0,
                alreadyRewarded: true,
            });
        }

        const now = Date.now();
        const ageMs = now - startedAt;
        if (ageMs < -5000 || ageMs > 20 * 60 * 1000) {
            return e.json(400, { error: "La partida venció. Inicia una nueva." });
        }
        const ticks = Number(body.ticks);
        // Tres segundos de tolerancia cubren latencia, suspensión breve y diferencias
        // de temporizador, pero impiden simular diez minutos de juego instantáneamente.
        const maxTicksForAge = Math.floor(Math.max(0, ageMs) * TICK_RATE / 1000) + TICK_RATE * 3;
        if (!Number.isInteger(ticks) || ticks > maxTicksForAge) {
            return e.json(400, { error: "La duración de la partida no es válida." });
        }

        const secretRecord = $app.findFirstRecordByFilter(
            "alliance_game_secrets", "game = 'nikita-jump'"
        );
        const expected = $security.hs256(
            nikitaRunPayload(e.auth.id, runId, seed, startedAt),
            secretRecord.getString("secret")
        );
        if (!$security.equal(expected, signature)) {
            return e.json(400, { error: "La firma de la partida no es válida." });
        }

        const simulated = simulateNikitaReplay(seed, ticks, body.replay);
        if (!simulated || !simulated.finished || simulated.tick !== ticks || simulated.score !== claimedScore) {
            return e.json(400, { error: "El replay no coincide con el puntaje enviado." });
        }

        const reward = nikitaRewardForScore(simulated.score);
        let newBalance = 0;
        let newHighScore = previous;
        let newTotalScore = mine.getInt("total_score") || 0;
        try {
            $app.runInTransaction((txApp) => {
                const duplicates = txApp.findRecordsByFilter(
                    "alliance_nikita_runs", "run_id = {:run}", "", 1, 0, { run: runId }
                );
                if (duplicates.length > 0) throw new Error("NIKITA_RUN_ALREADY_REDEEMED");

                const run = new Record(txApp.findCollectionByNameOrId("alliance_nikita_runs"));
                run.set("run_id", runId);
                run.set("user", e.auth.id);
                run.set("score", simulated.score);
                run.set("reward", reward);
                txApp.save(run);

                // La partida suma exactamente una vez porque el runId se inserta en la
                // misma transacción. MAX conserva el récord ante envíos simultáneos.
                txApp.db().newQuery(
                    "UPDATE alliance_nikita_scores SET " +
                    "high_score = MAX(high_score, {:score}), " +
                    "total_score = COALESCE(total_score, 0) + {:score}, updated = {:updated} " +
                    "WHERE id = {:id}"
                ).bind({ score: simulated.score, updated: new DateTime().string(), id: mine.id }).execute();
                if (reward > 0) {
                    txApp.db().newQuery(
                        "UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:reward} WHERE id = {:user}"
                    ).bind({ reward, user: e.auth.id }).execute();
                }
                newBalance = txApp.findRecordById("users", e.auth.id).getInt("beautokens") || 0;
                const updatedScore = txApp.findRecordById("alliance_nikita_scores", mine.id);
                newHighScore = updatedScore.getInt("high_score") || 0;
                newTotalScore = updatedScore.getInt("total_score") || 0;
            });
        } catch (transactionError) {
            if (String(transactionError && (transactionError.message || transactionError)).includes("NIKITA_RUN_ALREADY_REDEEMED")) {
                return e.json(409, { error: "Esta partida ya entregó su recompensa." });
            }
            throw transactionError;
        }
        return e.json(200, {
            highScore: newHighScore,
            totalScore: newTotalScore,
            improved: simulated.score > previous,
            verifiedScore: simulated.score,
            reward,
            beautokens: newBalance,
            alreadyRewarded: false,
        });
    } catch (err) {
        console.error("[alliances.pb.js] Error al verificar puntaje:", err);
        return e.json(500, { error: "No se pudo verificar tu puntaje." });
    }
}, $apis.requireAuth("users"), $apis.bodyLimit(131072));

routerAdd("POST", "/api/alliances/nikita/skins/{skinId}/purchase", (e) => {
    try {
        const { NIKITA_SKIN_PRICE, isNikitaSkinId } = require(`${__hooks}/lib/nikitaSkins.js`);
        const skinId = String(e.request.pathValue("skinId") || "");
        if (!isNikitaSkinId(skinId)) return e.json(404, { error: "Skin inválida." });

        let score;
        try {
            score = $app.findFirstRecordByFilter(
                "alliance_nikita_scores", "user = {:user}", { user: e.auth.id }
            );
        } catch (notFound) {
            return e.json(400, { error: "Primero elige la alianza a la que quieres aportar." });
        }

        let newBalance = 0;
        let alreadyOwned = false;
        try {
            $app.runInTransaction((txApp) => {
                const owned = txApp.findRecordsByFilter(
                    "alliance_nikita_skins", "user = {:user} && skin = {:skin}", "", 1, 0,
                    { user: e.auth.id, skin: skinId }
                );
                if (owned.length > 0) {
                    alreadyOwned = true;
                } else {
                    const result = txApp.db().newQuery(
                        "UPDATE users SET beautokens = beautokens - {:price} " +
                        "WHERE id = {:user} AND beautokens >= {:price}"
                    ).bind({ price: NIKITA_SKIN_PRICE, user: e.auth.id }).execute();
                    if (result.rowsAffected() === 0) throw new Error("NIKITA_INSUFFICIENT_TOKENS");

                    const ownership = new Record(txApp.findCollectionByNameOrId("alliance_nikita_skins"));
                    ownership.set("user", e.auth.id);
                    ownership.set("skin", skinId);
                    txApp.save(ownership);
                }
                const currentScore = txApp.findRecordById("alliance_nikita_scores", score.id);
                currentScore.set("selected_skin", skinId);
                txApp.save(currentScore);
                newBalance = txApp.findRecordById("users", e.auth.id).getInt("beautokens") || 0;
            });
        } catch (transactionError) {
            if (String(transactionError && (transactionError.message || transactionError)).includes("NIKITA_INSUFFICIENT_TOKENS")) {
                return e.json(400, { error: "No tienes suficientes Beautokens." });
            }
            throw transactionError;
        }
        return e.json(200, { skin: skinId, selectedSkin: skinId, beautokens: newBalance, alreadyOwned });
    } catch (err) {
        console.error("[alliances.pb.js] Error al comprar skin de Nikita:", err);
        return e.json(500, { error: "No se pudo comprar la skin." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/alliances/nikita/skins/equip", (e) => {
    try {
        const { isNikitaSkinId } = require(`${__hooks}/lib/nikitaSkins.js`);
        const skinId = String((e.requestInfo().body || {}).skin || "");
        if (skinId && !isNikitaSkinId(skinId)) return e.json(400, { error: "Skin inválida." });

        const score = $app.findFirstRecordByFilter(
            "alliance_nikita_scores", "user = {:user}", { user: e.auth.id }
        );
        if (skinId) {
            const owned = $app.findRecordsByFilter(
                "alliance_nikita_skins", "user = {:user} && skin = {:skin}", "", 1, 0,
                { user: e.auth.id, skin: skinId }
            );
            if (owned.length === 0) return e.json(403, { error: "Todavía no tienes esta skin." });
        }
        score.set("selected_skin", skinId);
        $app.save(score);
        return e.json(200, { selectedSkin: skinId });
    } catch (err) {
        console.error("[alliances.pb.js] Error al equipar skin de Nikita:", err);
        return e.json(500, { error: "No se pudo equipar la skin." });
    }
}, $apis.requireAuth("users"));
