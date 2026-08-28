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
// Cada acción manda la bitácora completa del cliente, pero el servidor NO la guarda
// tal cual: la FUSIONA contra lo persistido con mergeEvents() (fusión de tres vías,
// ver lib/matchEvents.js). Guardarla tal cual era un lost update — dos árbitros
// simultáneos se borraban eventos entre sí en silencio. También se valida server-side
// que ningún evento de jugada (gol/tarjeta/penal) caiga en un momento en que el reloj
// no estaba corriendo (pausado/entretiempo/antes-después), además de la validación
// estructural de cada evento.
//
// El código deja de servir cuando el partido se finaliza: a partir de ahí el marcador
// es oficial y solo la cuenta de la liga dueña del partido puede corregir el informe.
// Antes el código seguía valiendo para siempre, así que cualquiera que lo hubiera
// tenido alguna vez podía reescribir un resultado cerrado semanas después, y sin
// dejar rastro. Toda enmienda queda registrada en amendedBy/amendedAt.
// Ver auditoria-2026-08-19.md §4.1 y §4.4.
// ---------------------------------------------------------------------------------

// ARBITRAR NO REQUIERE SESIÓN. El código del partido siempre fue la autorización real
// —se reparte en cancha a quien va a arbitrar—, y exigir además una cuenta solo
// estorbaba a quien está ahí con el teléfono de otra persona. Sin sesión, e.auth es
// nulo y la identidad pasa a ser "": eso cierra por sí solo la vía de ENMIENDA de un
// partido ya finalizado, porque esa requiere ser la cuenta de la liga dueña y ""
// nunca coincide. Un anónimo con el código puede arbitrar un partido en curso; nada más.
//
// NOTA DE RUNTIME (verificada a mano, cuesta cara si se olvida): PocketBase ejecuta
// CADA routerAdd en una VM de Goja aislada. Una función declarada acá, en el scope del
// módulo, NO existe dentro de los handlers — el endpoint responde
// "assertMatchWritable is not defined" en tiempo de ejecución, no al cargar el hook, así
// que el error aparece recién al llamar la ruta. Lo único que cruza esa frontera es un
// require() hecho DENTRO del handler. Por eso la regla de autorización vive en
// lib/matchEvents.js como función pura (matchWriteDecision) y cada handler la importa.
// Es el mismo motivo por el que league.pb.js define loadValidBlocks dentro de cada ruta.

routerAdd("POST", "/api/league-matches/join", (e) => {
    try {
        const { matchWriteDecision } = require(`${__hooks}/lib/matchEvents.js`);

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
        const authId = (e.auth && e.auth.id) || "";
        const decision = matchWriteDecision(
            match.getString("status"), match.getString("league"), match.getString("code"), authId, code
        );
        // Respuesta directa, no BadRequestError: el segundo argumento de BadRequestError
        // no es un data bag libre — PocketBase lo trata como errores de validación por
        // campo y normaliza cualquier valor que no reconozca a un genérico
        // {code:"validation_invalid_value"}, perdiendo el `reason` real (verificado a
        // mano contra el servidor). `return e.json(...)` es además el patrón que ya usa
        // el resto del proyecto para errores con datos extra (ver auth.pb.js, beaudle.pb.js).
        if (!decision.ok) return e.json(400, { error: decision.error, reason: decision.reason });

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[match_arbitration.pb.js] Error en POST /api/league-matches/join:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo verificar el código." });
    }
});

routerAdd("POST", "/api/league-matches/events", (e) => {
    try {
        const { isValidEvent, isClockGatedSequenceValid, summarizeEvents, mergeEvents, matchWriteDecision } = require(`${__hooks}/lib/matchEvents.js`);
        const { isBettingClosed } = require(`${__hooks}/lib/polla.js`);

        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        const code = String(body.code || "").toUpperCase().trim();
        const events = Array.isArray(body.events) ? body.events : null;
        // Las claves que este cliente tenía cuando empezó a editar. Es lo que permite
        // distinguir "borré este evento a propósito" de "todavía no lo conozco".
        // Opcional: un cliente que no lo mande obtiene unión pura, sin borrados.
        const baseKeys = Array.isArray(body.baseKeys) ? body.baseKeys.map(String) : null;
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
        // Un partido ya jugado se puede seguir modificando (corregir el informe arbitral
        // oficial) — pero solo la liga dueña, y ahí ya no hay un reloj en vivo que
        // validar, así que esa validación solo aplica mientras sigue 'confirmed'.
        const authId = (e.auth && e.auth.id) || "";
        const decision = matchWriteDecision(
            match.getString("status"), match.getString("league"), match.getString("code"), authId, code
        );
        // Ver comentario en /join: respuesta directa, no BadRequestError, para que
        // `reason` llegue tal cual al cliente.
        if (!decision.ok) return e.json(400, { error: decision.error, reason: decision.reason });
        const isAmend = decision.isAmend;
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
            if (authId) report.set("referee", authId);
        }

        // Fusión contra lo persistido en vez de sobrescribir: si otra persona subió un
        // evento entre la última sincronización de este cliente y este push, se conserva.
        // .get() sobre un campo JSON no devuelve el valor parseado — hay que pasar por
        // getString() + JSON.parse().
        // Un informe recién creado devuelve "" acá, que cae en el "[]" — no hace falta
        // distinguir el caso nuevo. (Ojo: isNew es un MÉTODO en el JSVM, `!report.isNew`
        // siempre sería false y habría anulado la fusión en silencio.)
        let storedEvents = [];
        try {
            storedEvents = JSON.parse(report.getString("events") || "[]");
        } catch (pErr) {
            storedEvents = [];
        }
        const mergedEvents = mergeEvents(storedEvents, events, baseKeys);

        const summary = summarizeEvents(mergedEvents);

        // En modo enmienda el informe ya está 'approved' (es el resultado oficial) y
        // se mantiene así — solo se corrige su contenido, nunca se vuelve a poner
        // 'in_progress' (eso lo sacaría de la vista del partido, que solo muestra el
        // informe cuando está aprobado).
        report.set("status", isAmend ? "approved" : "in_progress");
        report.set("events", mergedEvents);
        if (isAmend) {
            report.set("amendedBy", authId);
            report.set("amendedAt", new Date().toISOString());
        }
        $app.save(report);

        // Segundo motivo de cierre de la polla: el partido arrancó de verdad. Si el
        // 1er tiempo ya comenzó y la fecha de cierre todavía es futura (el partido
        // empezó antes de su horario), se adelanta a ahora. Un solo campo resuelve las
        // dos condiciones, así que la regla de secreto sigue siendo una comparación
        // contra @now. Ver lib/polla.js y la migración 1787400100.
        let matchDirty = false;
        if (isAmend) {
            match.set("scoreA", summary.scoreA);
            match.set("scoreB", summary.scoreB);
            matchDirty = true;
        }
        if (summary.halfStarted[1] && !isBettingClosed(match.getString("bettingClosesAt"))) {
            match.set("bettingClosesAt", new Date().toISOString());
            matchDirty = true;
        }
        if (matchDirty) $app.save(match);

        // Se devuelve la bitácora fusionada, no la que mandó el cliente: es la forma en
        // que quien escribe se entera en el acto de lo que subió otra persona.
        return e.json(200, { success: true, summary, events: mergedEvents });
    } catch (err) {
        console.error("[match_arbitration.pb.js] Error en POST /api/league-matches/events:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo guardar el evento." });
    }
});

routerAdd("POST", "/api/league-matches/notes", (e) => {
    try {
        const { matchWriteDecision } = require(`${__hooks}/lib/matchEvents.js`);

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
        const authId = (e.auth && e.auth.id) || "";
        const decision = matchWriteDecision(
            match.getString("status"), match.getString("league"), match.getString("code"), authId, code
        );
        // Ver comentario en /join: respuesta directa, no BadRequestError, para que
        // `reason` llegue tal cual al cliente.
        if (!decision.ok) return e.json(400, { error: decision.error, reason: decision.reason });
        const isAmend = decision.isAmend;

        let report;
        try {
            report = $app.findFirstRecordByFilter("match_reports", "match = {:match} && deleted = false", { match: matchId });
        } catch (err) {
            const coll = $app.findCollectionByNameOrId("match_reports");
            report = new Record(coll);
            report.set("match", matchId);
            if (authId) report.set("referee", authId);
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
        if (isAmend) {
            report.set("amendedBy", authId);
            report.set("amendedAt", new Date().toISOString());
        }
        $app.save(report);

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[match_arbitration.pb.js] Error en POST /api/league-matches/notes:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo guardar el informe." });
    }
});

// Enviar/finalizar es lo mismo: el código ya es la garantía de que quien lo hace
// tiene derecho a arbitrar este partido, así que el resultado se hace oficial de
// inmediato — no hay una validación aparte de la liga. Solo se puede finalizar
// habiendo terminado el 2do tiempo (si no, el partido quedaría oficial a medias).
//
// Exige 'confirmed' (no 'played'), así que este endpoint es exclusivamente para el
// cierre en vivo con el código. Corregir un partido ya cerrado va por /events y
// /notes, que a esa altura solo aceptan a la liga dueña. El marcador se deriva
// siempre de los eventos GUARDADOS, nunca de lo que mande el cliente en esta llamada.
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
            // "already_played" es el caso "alguien más ya cerró este partido mientras yo
            // reintentaba" (mismo código, otro dispositivo) — el cliente lo trata como
            // éxito de facto, no como error, porque es justo lo que este botón buscaba
            // lograr. Respuesta directa, no BadRequestError: ver comentario en /join.
            const reason = match.getString("status") === "played" ? "already_played" : "not_confirmed";
            return e.json(400, { error: "Este partido ya no se puede arbitrar.", reason });
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
});
