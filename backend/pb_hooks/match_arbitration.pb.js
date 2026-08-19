/// <reference path="../pb_data/types.d.ts" />

// ---------------------------------------------------------------------------------
// Arbitraje de partidos de liga. El código de 6 caracteres es una propiedad del
// PARTIDO (league_matches.code, generado por la liga al agendarlo en
// /api/liga/matches/accept) — existe desde antes de que nadie lo arbitre, y hace
// falta desde el primer intento, sin excepción para quien empieza. La sesión de
// arbitraje en sí (match_reports) es COMPARTIDA: cualquier cantidad de gente con el
// código puede agregar eventos a la misma, sin candado — se asume que coordinan en la
// vida real. Leer el estado en vivo (events, notes, status) SÍ es público para
// cualquier autenticado — el código solo protege ESCRIBIR, no mirar.
//
// Cada acción reescribe `events` completo — esto ES el backup del servidor. También
// se valida server-side que ningún evento de jugada (gol/tarjeta/penal) caiga en un
// momento en que el reloj no estaba corriendo (pausado/entretiempo/antes-después),
// además de la validación estructural de cada evento.
// ---------------------------------------------------------------------------------

routerAdd("POST", "/api/league-matches/join", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        const code = String(body.code || "").toUpperCase().trim();
        if (!matchId || !code) throw new BadRequestError("Falta matchId o código.");

        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("El partido indicado no existe.");
        }
        if (match.getString("code") !== code) {
            throw new BadRequestError("Código incorrecto.");
        }
        const joinStatus = match.getString("status");
        if (joinStatus !== "confirmed" && joinStatus !== "played") {
            throw new BadRequestError("Este partido ya no se puede arbitrar.");
        }

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[match_arbitration.pb.js] Error en POST /api/league-matches/join:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo verificar el código." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/league-matches/events", (e) => {
    try {
        const { isValidEvent, isClockGatedSequenceValid, summarizeEvents } = require(`${__hooks}/lib/matchEvents.js`);

        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        const code = String(body.code || "").toUpperCase().trim();
        const events = Array.isArray(body.events) ? body.events : null;
        if (!matchId || !code) throw new BadRequestError("Falta matchId o código.");
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
        if (match.getString("code") !== code) {
            throw new BadRequestError("Código incorrecto.");
        }
        const matchStatus = match.getString("status");
        if (matchStatus !== "confirmed" && matchStatus !== "played") {
            throw new BadRequestError("Este partido ya no se puede arbitrar.");
        }
        // Un partido ya jugado se puede seguir modificando (corregir el informe arbitral
        // oficial) — ahí ya no hay un reloj en vivo que validar contra la secuencia de
        // eventos, así que esa validación solo aplica mientras el partido sigue 'confirmed'.
        const isAmend = matchStatus === "played";
        if (!isAmend && !isClockGatedSequenceValid(events)) {
            throw new BadRequestError(
                "Hay un gol, tarjeta o penal registrado mientras el reloj no estaba corriendo (pausado, entretiempo, o antes/después del partido)."
            );
        }

        // No hay "fundador": el primer push de cualquiera crea la sesión compartida
        // igual que cualquier push posterior de cualquier otra persona.
        let report;
        try {
            report = $app.findFirstRecordByFilter("match_reports", "match = {:match} && deleted = false", { match: matchId });
        } catch (err) {
            report = null;
        }
        if (report && !isAmend) {
            const status = report.getString("status");
            if (status === "submitted" || status === "approved") {
                throw new BadRequestError("El arbitraje ya se envió, no se puede seguir editando.");
            }
        } else if (!report) {
            const coll = $app.findCollectionByNameOrId("match_reports");
            report = new Record(coll);
            report.set("match", matchId);
            report.set("referee", e.auth.id);
        }

        const summary = summarizeEvents(events);

        // En modo enmienda el informe ya está 'approved' (es el resultado oficial) y
        // se mantiene así — solo se corrige su contenido, nunca se vuelve a poner
        // 'in_progress' (eso lo sacaría de la vista del partido, que solo muestra el
        // informe cuando está aprobado).
        report.set("status", isAmend ? "approved" : "in_progress");
        report.set("events", events);
        $app.save(report);

        if (isAmend) {
            match.set("scoreA", summary.scoreA);
            match.set("scoreB", summary.scoreB);
            $app.save(match);
        }

        return e.json(200, { success: true, summary });
    } catch (err) {
        console.error("[match_arbitration.pb.js] Error en POST /api/league-matches/events:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo guardar el evento." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/league-matches/notes", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        const code = String(body.code || "").toUpperCase().trim();
        const notes = String(body.notes || "");
        if (!matchId || !code) throw new BadRequestError("Falta matchId o código.");

        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("El partido indicado no existe.");
        }
        if (match.getString("code") !== code) {
            throw new BadRequestError("Código incorrecto.");
        }
        const isAmend = match.getString("status") === "played";

        let report;
        try {
            report = $app.findFirstRecordByFilter("match_reports", "match = {:match} && deleted = false", { match: matchId });
        } catch (err) {
            const coll = $app.findCollectionByNameOrId("match_reports");
            report = new Record(coll);
            report.set("match", matchId);
            report.set("referee", e.auth.id);
            report.set("status", "in_progress");
            report.set("events", []);
        }
        if (!isAmend) {
            const status = report.getString("status");
            if (status === "submitted" || status === "approved") {
                throw new BadRequestError("El arbitraje ya se envió, no se puede seguir editando.");
            }
        }

        report.set("notes", notes);
        $app.save(report);

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[match_arbitration.pb.js] Error en POST /api/league-matches/notes:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo guardar el informe." });
    }
}, $apis.requireAuth("users"));

// Enviar/finalizar es lo mismo: el código ya es la garantía de que quien lo hace
// tiene derecho a arbitrar este partido, así que el resultado se hace oficial de
// inmediato — no hay una validación aparte de la liga. Solo se puede finalizar
// habiendo terminado el 2do tiempo (si no, el partido quedaría oficial a medias).
routerAdd("POST", "/api/league-matches/submit", (e) => {
    try {
        const { summarizeEvents } = require(`${__hooks}/lib/matchEvents.js`);

        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        const code = String(body.code || "").toUpperCase().trim();
        if (!matchId || !code) throw new BadRequestError("Falta matchId o código.");

        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("El partido indicado no existe.");
        }
        if (match.getString("code") !== code) {
            throw new BadRequestError("Código incorrecto.");
        }
        if (match.getString("status") !== "confirmed") {
            throw new BadRequestError("Este partido ya no se puede arbitrar.");
        }

        let report;
        try {
            report = $app.findFirstRecordByFilter("match_reports", "match = {:match} && deleted = false", { match: matchId });
        } catch (err) {
            throw new BadRequestError("Todavía no se registró ningún evento en este partido.");
        }
        const status = report.getString("status");
        if (status !== "in_progress" && status !== "rejected") {
            throw new BadRequestError("Este informe ya fue enviado.");
        }

        // .get() sobre un campo JSON dentro de un hook de registro NO devuelve el valor
        // parseado — hay que pasar por getString()+JSON.parse() explícito.
        const events = JSON.parse(report.getString("events") || "[]");
        const summary = summarizeEvents(events);
        if (!summary.halfEnded[2]) {
            throw new BadRequestError("El partido tiene que terminar el 2do tiempo antes de poder finalizarse.");
        }

        $app.runInTransaction((txApp) => {
            const txMatch = txApp.findRecordById("league_matches", matchId);
            txMatch.set("scoreA", summary.scoreA);
            txMatch.set("scoreB", summary.scoreB);
            txMatch.set("status", "played");
            txApp.save(txMatch);

            const txReport = txApp.findRecordById("match_reports", report.id);
            txReport.set("status", "approved");
            txApp.save(txReport);
        });

        return e.json(200, { success: true, scoreA: summary.scoreA, scoreB: summary.scoreB });
    } catch (err) {
        console.error("[match_arbitration.pb.js] Error en POST /api/league-matches/submit:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo finalizar el partido." });
    }
}, $apis.requireAuth("users"));
