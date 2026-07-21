/// <reference path="../pb_data/types.d.ts" />
console.log("[LOAD] ladders.pb.js hook file has been read and loaded by PocketBase!");

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
                        console.log("[Ladders Hook] Error sending notification to", userId, nErr.message || nErr);
                    }
                }
            });
        }
    } catch (err) {
        console.log("[Ladders Hook] Error onRecordAfterCreateSuccess:", err.message || err);
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

        let confirmationsRaw = match.getString("confirmations");
        let confirmations = {};
        try {
            confirmations = JSON.parse(confirmationsRaw || "{}");
        } catch (pErr) {}

        const hasRejection = Object.values(confirmations).includes("rejected");
        if (hasRejection) {
            match.set("status", "disputed");
            console.log("[Ladders Hook] Match", match.id, "moved to DISPUTED due to rejection.");
            return e.next();
        }

        const allAccepted = requiredPlayers.every(userId => confirmations[userId] === "accepted");
        if (allAccepted) {
            match.set("status", "confirmed");
            console.log("[Ladders Hook] Match", match.id, "CONFIRMED! Applying OpenSkill...");

            // CÁLCULO OPENSKILL INLINE
            (function applyOpenSkillInline(matchRecord) {
                function standardPdf(x) {
                    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
                }

                function standardCdf(x) {
                    const t = 1 / (1 + 0.2316419 * Math.abs(x));
                    const d = 0.3989423 * Math.exp(-x * x / 2);
                    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
                    if (x > 0) prob = 1 - prob;
                    return prob;
                }

                function vMatch(t) {
                    const cdf = standardCdf(t);
                    if (cdf < 1e-10) return -t;
                    return standardPdf(t) / cdf;
                }

                function wMatch(t) {
                    const v = vMatch(t);
                    return v * (v + t);
                }

                function calculateOpenSkillUpdate(redPlayers, bluePlayers, winner) {
                    const BETA = 4.166666666666667;
                    const BETA_SQ = BETA * BETA;

                    let muRed = 0, sigmaSqRed = 0;
                    redPlayers.forEach(p => {
                        muRed += p.mu;
                        sigmaSqRed += p.sigma * p.sigma;
                    });

                    let muBlue = 0, sigmaSqBlue = 0;
                    bluePlayers.forEach(p => {
                        muBlue += p.mu;
                        sigmaSqBlue += p.sigma * p.sigma;
                    });

                    const cSq = 2 * BETA_SQ + sigmaSqRed + sigmaSqBlue;
                    const c = Math.sqrt(cSq);

                    let diff = 0;
                    if (winner === 'red') {
                        diff = (muRed - muBlue) / c;
                    } else if (winner === 'blue') {
                        diff = (muBlue - muRed) / c;
                    } else {
                        diff = Math.abs(muRed - muBlue) / c;
                    }

                    const v = vMatch(diff);
                    const w = wMatch(diff);

                    const updatedRed = redPlayers.map(p => {
                        const sigSq = p.sigma * p.sigma;
                        let newMu = p.mu;
                        if (winner === 'red') {
                            newMu += (sigSq / c) * v;
                        } else if (winner === 'blue') {
                            newMu -= (sigSq / c) * v;
                        }
                        const newSigSq = sigSq * (1 - (sigSq / cSq) * w);
                        const newSigma = Math.max(0.0001, Math.sqrt(Math.max(0.0001, newSigSq)));
                        const newOrdinal = Math.max(0, Math.round((newMu - 3 * newSigma) * 100) / 100);

                        return {
                            userId: p.userId,
                            mu: newMu,
                            sigma: newSigma,
                            ordinal_rating: newOrdinal,
                            delta: newOrdinal - (p.mu - 3 * p.sigma)
                        };
                    });

                    const updatedBlue = bluePlayers.map(p => {
                        const sigSq = p.sigma * p.sigma;
                        let newMu = p.mu;
                        if (winner === 'blue') {
                            newMu += (sigSq / c) * v;
                        } else if (winner === 'red') {
                            newMu -= (sigSq / c) * v;
                        }
                        const newSigSq = sigSq * (1 - (sigSq / cSq) * w);
                        const newSigma = Math.max(0.0001, Math.sqrt(Math.max(0.0001, newSigSq)));
                        const newOrdinal = Math.max(0, Math.round((newMu - 3 * newSigma) * 100) / 100);

                        return {
                            userId: p.userId,
                            mu: newMu,
                            sigma: newSigma,
                            ordinal_rating: newOrdinal,
                            delta: newOrdinal - (p.mu - 3 * p.sigma)
                        };
                    });

                    return { red: updatedRed, blue: updatedBlue };
                }

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
                    console.log("[Ladders Hook] OpenSkill updated successfully for match", matchRecord.id);
                } catch (err) {
                    console.log("[Ladders Hook] Error applyOpenSkillInline:", err.message || err);
                }
            })(match);
        }

        return e.next();
    } catch (err) {
        console.log("[Ladders Hook] Error in onRecordUpdate ladder_matches:", err.message || err);
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
                console.log("[Ladders Cron] Match", match.id, "auto-disputed after 24h.");
            } catch (mErr) {
                console.log("[Ladders Cron] Error auto-disputing match", match.id, mErr.message || mErr);
            }
        });
    } catch (cErr) {
        console.log("[Ladders Cron] Error in auto_dispute_matches cron:", cErr.message || cErr);
    }
});
