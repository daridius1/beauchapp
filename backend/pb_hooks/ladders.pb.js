/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// HOOK: Al crear un partido (ladder_matches)
// ----------------------------------------------------
onRecordAfterCreateSuccess((e) => {
    try {
        const match = e.record;
        const ladderId = match.getString("ladder");
        const arbiterId = match.getString("arbiter");
        const status = match.getString("status");
        const scoreRed = match.getInt("score_red");
        const scoreBlue = match.getInt("score_blue");

        const teamRed = match.get("team_red") || [];
        const teamBlue = match.get("team_blue") || [];

        let ladderName = "Ladder";
        try {
            const ladderRec = $app.findRecordById("ladders", ladderId);
            ladderName = ladderRec.getString("name");
        } catch (lErr) {}

        let arbiterUsername = "Árbitro";
        try {
            const arbiterRec = $app.findRecordById("users", arbiterId);
            arbiterUsername = arbiterRec.getString("username") || "Árbitro";
        } catch (uErr) {}

        const notifColl = $app.findCollectionByNameOrId("notifications");

        if (status === "pending_confirmation") {
            const allPlayers = Array.from(new Set([...teamRed, ...teamBlue]));
            allPlayers.forEach(userId => {
                if (userId !== arbiterId) {
                    try {
                        const notif = new Record(notifColl);
                        notif.set("user", userId);
                        notif.set("sender", arbiterId);
                        notif.set("type", "ladder_confirmation");
                        notif.set("title", "Confirma tu partido de " + ladderName);
                        notif.set("body", "@" + arbiterUsername + " registró: Rojo " + scoreRed + " - " + scoreBlue + " Azul.");
                        notif.set("read", false);
                        notif.set("relatedId", match.id);
                        $app.save(notif);
                    } catch (nErr) {
                        console.error("[Ladders Hook] Error sending notification to", userId, nErr.message || nErr);
                    }
                }
            });
        }
    } catch (err) {
        console.error("[Ladders Hook] Error onRecordAfterCreateSuccess:", err.message || err);
    }
}, "ladder_matches");

// ----------------------------------------------------
// HOOK: Al actualizar confirmaciones de un partido
// ----------------------------------------------------
onRecordUpdate((e) => {
    try {
        const match = e.record;
        const currentStatus = match.getString("status");

        if (currentStatus !== "pending_confirmation") {
            return e.next();
        }

        const teamRed = match.get("team_red") || [];
        const teamBlue = match.get("team_blue") || [];
        const arbiterId = match.getString("arbiter");
        const requiredPlayers = Array.from(new Set([...teamRed, ...teamBlue])).filter(id => id !== arbiterId);

        // Merge atómico de confirmations: el cliente arma su PATCH a partir de una lectura que
        // puede estar desactualizada si otro jugador confirmó casi al mismo tiempo (lost update).
        // En vez de confiar en el blob completo enviado, solo aplicamos las claves que
        // realmente cambiaron respecto a lo que el cliente tenía, sobre el estado más
        // reciente persistido (original), para que ninguna confirmación se pierda.
        let originalConfirmations = {};
        try {
            originalConfirmations = JSON.parse(match.original().getString("confirmations") || "{}");
        } catch (pErr) {}

        let incomingConfirmations = {};
        try {
            incomingConfirmations = JSON.parse(match.getString("confirmations") || "{}");
        } catch (pErr) {}

        const confirmations = { ...originalConfirmations };
        for (const userId in incomingConfirmations) {
            if (incomingConfirmations[userId] !== originalConfirmations[userId]) {
                confirmations[userId] = incomingConfirmations[userId];
            }
        }
        match.set("confirmations", JSON.stringify(confirmations));

        const hasRejection = Object.values(confirmations).includes("rejected");
        if (hasRejection) {
            match.set("status", "disputed");
            return e.next();
        }

        const allAccepted = requiredPlayers.every(userId => confirmations[userId] === "accepted");
        if (allAccepted) {
            match.set("status", "confirmed");

            // CÁLCULO OPENSKILL (lógica pura en lib/openskill.js, testeada en lib/__tests__)
            (function applyOpenSkillInline(matchRecord) {
                const { calculateOpenSkillUpdate } = require(`${__hooks}/lib/openskill.js`);

                try {
                    const ladderId = matchRecord.getString("ladder");
                    const scoreRed = matchRecord.getInt("score_red");
                    const scoreBlue = matchRecord.getInt("score_blue");
                    const teamRedIds = matchRecord.get("team_red") || [];
                    const teamBlueIds = matchRecord.get("team_blue") || [];

                    const ranksColl = $app.findCollectionByNameOrId("ladder_ranks");

                    function getOrCreateRank(userId) {
                        try {
                            return $app.findFirstRecordByFilter("ladder_ranks", "ladder = {:ladder} && user = {:user}", { ladder: ladderId, user: userId });
                        } catch (rErr) {
                            const newRank = new Record(ranksColl);
                            newRank.set("ladder", ladderId);
                            newRank.set("user", userId);
                            newRank.set("mu", 25.0);
                            newRank.set("sigma", 8.333333333333334);
                            newRank.set("ordinal_rating", 0.0);
                            newRank.set("matches_played", 0);
                            newRank.set("wins", 0);
                            newRank.set("losses", 0);
                            newRank.set("draws", 0);
                            $app.save(newRank);
                            return newRank;
                        }
                    }

                    const redPlayerRecs = teamRedIds.map(id => getOrCreateRank(id));
                    const bluePlayerRecs = teamBlueIds.map(id => getOrCreateRank(id));

                    const redPlayerData = redPlayerRecs.map(rec => ({
                        userId: rec.getString("user"),
                        mu: rec.getFloat("mu") || 25.0,
                        sigma: rec.getFloat("sigma") || 8.333333333333334
                    }));

                    const bluePlayerData = bluePlayerRecs.map(rec => ({
                        userId: rec.getString("user"),
                        mu: rec.getFloat("mu") || 25.0,
                        sigma: rec.getFloat("sigma") || 8.333333333333334
                    }));

                    let winner = 'draw';
                    if (scoreRed > scoreBlue) winner = 'red';
                    else if (scoreBlue > scoreRed) winner = 'blue';

                    const updateResult = calculateOpenSkillUpdate(redPlayerData, bluePlayerData, winner);

                    redPlayerRecs.forEach((rec, idx) => {
                        const data = updateResult.red[idx];
                        rec.set("mu", data.mu);
                        rec.set("sigma", data.sigma);
                        rec.set("ordinal_rating", data.ordinal_rating);
                        rec.set("matches_played", rec.getInt("matches_played") + 1);
                        if (winner === 'red') rec.set("wins", rec.getInt("wins") + 1);
                        else if (winner === 'blue') rec.set("losses", rec.getInt("losses") + 1);
                        else rec.set("draws", rec.getInt("draws") + 1);
                        $app.save(rec);
                    });

                    bluePlayerRecs.forEach((rec, idx) => {
                        const data = updateResult.blue[idx];
                        rec.set("mu", data.mu);
                        rec.set("sigma", data.sigma);
                        rec.set("ordinal_rating", data.ordinal_rating);
                        rec.set("matches_played", rec.getInt("matches_played") + 1);
                        if (winner === 'blue') rec.set("wins", rec.getInt("wins") + 1);
                        else if (winner === 'red') rec.set("losses", rec.getInt("losses") + 1);
                        else rec.set("draws", rec.getInt("draws") + 1);
                        $app.save(rec);
                    });

                    matchRecord.set("openskill_changes", JSON.stringify(updateResult));
                } catch (err) {
                    console.error("[Ladders Hook] Error applyOpenSkillInline:", err.message || err);
                }
            })(match);
        }

        return e.next();
    } catch (err) {
        console.error("[Ladders Hook] Error in onRecordUpdate ladder_matches:", err.message || err);
        return e.next();
    }
}, "ladder_matches");

// ----------------------------------------------------
// CRON: Auto-Disputar partidos sin responder en 24 horas
// ----------------------------------------------------
cronAdd("auto_dispute_matches", "0 * * * *", () => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const pendingMatches = $app.findRecordsByFilter("ladder_matches", "status = 'pending_confirmation' && created < {:limit}", "-created", 100, 0, { limit: twentyFourHoursAgo });

        pendingMatches.forEach(match => {
            try {
                match.set("status", "disputed");
                $app.save(match);
            } catch (mErr) {
                console.error("[Ladders Cron] Error auto-disputing match", match.id, mErr.message || mErr);
            }
        });
    } catch (cErr) {
        console.error("[Ladders Cron] Error in auto_dispute_matches cron:", cErr.message || cErr);
    }
});
