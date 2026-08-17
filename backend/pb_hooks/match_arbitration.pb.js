/// <reference path="../pb_data/types.d.ts" />

// ---------------------------------------------------------------------------------
// Arbitraje de partidos de liga. La relación entre "arbitrar" y "partido" es muchos a
// muchos: cualquier cantidad de personas distintas puede arbitrar el mismo partido en
// paralelo, cada una con su propio informe independiente (match_reports, uno por
// combinación partido+árbitro — se actualiza en el lugar, no se duplica). No hay
// ningún "candado" que le impida a alguien más arbitrar el mismo partido. La
// restricción real está a la hora de validar: el organizador de la liga aprueba UN
// solo informe por partido y ese es el que se hace oficial; el resto queda sin efecto.
// Cada acción del árbitro reescribe `events` completo en su propio informe — esto ES
// el backup del lado del servidor.
// ---------------------------------------------------------------------------------

routerAdd("POST", "/api/league-matches/events", (e) => {
    try {
        const { isValidEvent, summarizeEvents } = require(`${__hooks}/lib/matchEvents.js`);

        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        const events = Array.isArray(body.events) ? body.events : null;
        if (!matchId) throw new BadRequestError("Falta matchId.");
        if (!events) throw new BadRequestError("Falta events.");
        if (!events.every((ev) => isValidEvent(ev))) {
            throw new BadRequestError("Hay un evento con formato inválido.");
        }

        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("El partido indicado no existe.");
        }
        if (match.getString("status") !== "confirmed") {
            throw new BadRequestError("Este partido ya no se puede arbitrar (no está en estado 'confirmed').");
        }

        let report;
        try {
            report = $app.findFirstRecordByFilter(
                "match_reports",
                "match = {:match} && referee = {:referee}",
                { match: matchId, referee: e.auth.id }
            );
        } catch (err) {
            report = null;
        }

        if (report && (report.getString("status") === "submitted" || report.getString("status") === "approved")) {
            throw new BadRequestError("Ya enviaste tu arbitraje para este partido, no se puede seguir editando.");
        }

        if (!report) {
            const coll = $app.findCollectionByNameOrId("match_reports");
            report = new Record(coll);
            report.set("match", matchId);
            report.set("referee", e.auth.id);
        }
        // Si el informe había sido rechazado, volver a escribir eventos lo reabre —
        // el mismo árbitro puede corregir y volver a enviarlo.
        report.set("status", "in_progress");
        report.set("events", events);
        $app.save(report);

        return e.json(200, { success: true, reportId: report.id, summary: summarizeEvents(events) });
    } catch (err) {
        console.error("[match_arbitration.pb.js] Error en POST /api/league-matches/events:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo guardar el evento." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/league-matches/submit", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        if (!matchId) throw new BadRequestError("Falta matchId.");

        let report;
        try {
            report = $app.findFirstRecordByFilter(
                "match_reports",
                "match = {:match} && referee = {:referee}",
                { match: matchId, referee: e.auth.id }
            );
        } catch (err) {
            throw new BadRequestError("Todavía no empezaste a arbitrar este partido.");
        }
        if (report.getString("status") !== "in_progress") {
            throw new BadRequestError("Este informe ya fue enviado.");
        }

        report.set("status", "submitted");
        $app.save(report);

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[match_arbitration.pb.js] Error en POST /api/league-matches/submit:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo enviar el arbitraje." });
    }
}, $apis.requireAuth("users"));

// ---------------------------------------------------------------------------------
// Aprobación/rechazo de un informe puntual — solo la propia liga (misma cuenta, mismo
// criterio que league.pb.js: type=organization && subtype=league, y ser dueña del
// partido al que pertenece el informe).
// ---------------------------------------------------------------------------------

routerAdd("POST", "/api/liga/matches/approve", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const { summarizeEvents } = require(`${__hooks}/lib/matchEvents.js`);

        const body = e.requestInfo().body || {};
        const reportId = String(body.reportId || "");
        if (!reportId) throw new BadRequestError("Falta reportId.");

        let report;
        try {
            report = $app.findRecordById("match_reports", reportId);
        } catch (err) {
            throw new BadRequestError("El informe indicado no existe.");
        }
        if (report.getString("status") !== "submitted") {
            throw new BadRequestError("Este informe no está esperando aprobación.");
        }

        const matchId = report.getString("match");
        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("El partido de este informe ya no existe.");
        }
        if (match.getString("league") !== e.auth.id) {
            throw new BadRequestError("Ese partido no pertenece a tu liga.");
        }
        if (match.getString("status") !== "confirmed") {
            throw new BadRequestError("Este partido ya tiene un resultado oficial.");
        }

        // .get() sobre un campo JSON dentro de un hook de registro NO devuelve el valor
        // parseado — hay que pasar por getString()+JSON.parse() explícito.
        const events = JSON.parse(report.getString("events") || "[]");
        const summary = summarizeEvents(events);

        $app.runInTransaction((txApp) => {
            const txMatch = txApp.findRecordById("league_matches", matchId);
            txMatch.set("scoreA", summary.scoreA);
            txMatch.set("scoreB", summary.scoreB);
            txMatch.set("status", "played");
            txApp.save(txMatch);

            const txReport = txApp.findRecordById("match_reports", reportId);
            txReport.set("status", "approved");
            txApp.save(txReport);

            // El resto de informes que ya se habían enviado para el mismo partido quedan
            // sin efecto — el organizador valida uno solo y ese es el oficial.
            const otherSubmitted = txApp.findRecordsByFilter(
                "match_reports",
                "match = {:match} && status = 'submitted' && id != {:id}",
                "",
                0,
                0,
                { match: matchId, id: reportId }
            );
            for (const other of otherSubmitted) {
                other.set("status", "rejected");
                txApp.save(other);
            }
        });

        return e.json(200, { success: true, scoreA: summary.scoreA, scoreB: summary.scoreB });
    } catch (err) {
        console.error("[match_arbitration.pb.js] Error en POST /api/liga/matches/approve:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo aprobar el informe." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/liga/matches/reject", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }

        const body = e.requestInfo().body || {};
        const reportId = String(body.reportId || "");
        if (!reportId) throw new BadRequestError("Falta reportId.");

        let report;
        try {
            report = $app.findRecordById("match_reports", reportId);
        } catch (err) {
            throw new BadRequestError("El informe indicado no existe.");
        }
        if (report.getString("status") !== "submitted") {
            throw new BadRequestError("Este informe no está esperando aprobación.");
        }

        let match;
        try {
            match = $app.findRecordById("league_matches", report.getString("match"));
        } catch (err) {
            throw new BadRequestError("El partido de este informe ya no existe.");
        }
        if (match.getString("league") !== e.auth.id) {
            throw new BadRequestError("Ese partido no pertenece a tu liga.");
        }

        // Rechazar UN informe no afecta al partido ni a los demás informes — sigue
        // "confirmed" y abierto para que cualquiera (incluyendo este mismo árbitro,
        // desde cero) lo arbitre.
        report.set("status", "rejected");
        $app.save(report);

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[match_arbitration.pb.js] Error en POST /api/liga/matches/reject:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo rechazar el informe." });
    }
}, $apis.requireAuth("users"));
