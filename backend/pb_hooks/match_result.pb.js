/// <reference path="../pb_data/types.d.ts" />

// ---------------------------------------------------------------------------------
// Registro de resultado post-partido — reemplaza al arbitraje en vivo
// (match_arbitration.pb.js, que queda ARCHIVADO tal cual, sin ningún cambio: sigue
// funcionando si alguien todavía tiene un link viejo, y el botón "Editar eventos" de
// /admin/liga lo sigue usando para corregir informes como cuenta de liga) como forma
// normal de cerrar un partido. Ya no se arbitra EN VIVO con reloj: el árbitro registra
// lo que pasó DESPUÉS del partido, con un link de un solo uso que la liga le manda.
//
// La liga genera el link desde /admin/liga (POST .../generate-result-link). El árbitro
// lo abre SIN sesión (GET /registrar-resultado?token=...) — el token en la URL ES la
// autorización, no hay cuenta de por medio, igual que /register-org en auth.pb.js.
// Carga goles y tarjetas UNA vez (POST /api/public/match-result) y el link queda
// muerto: el token se limpia al usarse (mismo patrón exacto que
// registrationToken/tokenExpiresAt en auth.pb.js, ver POST /api/register-organization).
//
// Para corregir un resultado ya cargado, la liga genera un link NUEVO (invalida el
// anterior) — nunca se edita el informe sin pasar por un link. Ese caso (match ya
// 'played') reutiliza el mismo endpoint de envío, que entonces revierte y reaplica el
// pago de Beaumarket si el ganador cambió, igual que ya hacía el modo "enmienda" del
// arbitraje en vivo (ver match_arbitration.pb.js).
//
// Sin sesión concurrente compartida (a diferencia del arbitraje en vivo, acá es un solo
// envío autoritativo por link), así que no hacen falta mergeEvents ni
// isClockGatedSequenceValid de lib/matchEvents.js — se reutilizan isValidEvent y
// summarizeEvents, igual que ya hace POST /api/liga/matches/retroactive en league.pb.js
// (que resuelve el mismo problema — cargar un resultado sin reloj — para un partido que
// ni siquiera existía todavía).
//
// Formulario deliberadamente simple (decisión de producto, no limitación técnica): sin
// convocatoria (ya no se distingue quién "estuvo citado" — cualquier jugador del plantel
// puede anotarse un gol o una tarjeta), sin penales, sin minuto, y sin la casilla de
// "autogol": un gol se agrega directo en la sección del equipo que lo anotó, con o sin
// jugador — un autogol es exactamente eso, un gol sin jugador en la sección del equipo
// que se benefició. `ownGoal` sigue viajando en el evento (siempre `false`, lib/matchEvents.js
// lo sigue exigiendo) pero ya no es una opción visible.
//
// SEGUNDA VÍA, la misma pantalla: POST /api/league-matches/team-result, al final de este
// archivo. La liga sigue pudiendo generar el link de arriba, pero un equipo de los
// asignados a arbitrar (league_matches.refereeTeams, hasta 2 por partido — nunca los que
// juegan el partido) puede cargar el mismo formulario directo desde la app, con su propia
// sesión, sin token ni código: la cuenta autenticada ES la autorización (ver
// teamRefereeDecision en lib/matchResult.js). Mismo formato de datos (goles/tarjetas,
// sin autogol ni minuto) y mismo criterio de sobrescritura total que el link — la
// diferencia es solo CÓMO se autoriza, no qué se guarda. Como acá sí hay una identidad
// real (a diferencia del link, anónimo), cada envío queda anotado en
// match_reports.refereeTeamLog — un historial completo (no solo el último, a diferencia
// de amendedBy/amendedAt) para poder responder "¿qué equipo cargó este dato?" si alguno
// de los dos se equivoca.
// ---------------------------------------------------------------------------------

// La liga pide el link desde /admin/liga, autenticada como cuenta de liga.
routerAdd("POST", "/api/liga/matches/generate-result-link", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const { TOKEN_LENGTH, TOKEN_TTL_DAYS } = require(`${__hooks}/lib/matchResult.js`);

        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        if (!matchId) throw new BadRequestError("Falta matchId.");

        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("El partido indicado no existe.");
        }
        if (match.getString("league") !== e.auth.id) {
            throw new BadRequestError("Ese partido no pertenece a tu liga.");
        }
        const status = match.getString("status");
        if (status !== "confirmed" && status !== "played") {
            throw new BadRequestError("Este partido no admite un link de resultado.");
        }

        const token = $security.randomString(TOKEN_LENGTH);
        const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
        match.set("resultToken", token);
        match.set("resultTokenExpiresAt", expiresAt.toISOString());
        $app.save(match);

        // Misma derivación de baseUrl que GET /api/liga/matches en league.pb.js — no se
        // puede compartir una función de módulo entre routerAdd, cada uno corre en su
        // propia VM (ver la nota de cabecera de match_arbitration.pb.js).
        const envAppUrl = $os.getenv("APP_URL") || $os.getenv("SITE_URL");
        const host = e.requestInfo().headers["host"] || "localhost:8090";
        const protocol = e.requestInfo().headers["x-forwarded-proto"] || "http";
        const baseUrl = envAppUrl ? envAppUrl.replace(/\/$/, "") : `${protocol}://${host}`;

        return e.json(200, { success: true, url: `${baseUrl}/registrar-resultado?token=${token}` });
    } catch (err) {
        console.error("[match_result.pb.js] Error en POST /api/liga/matches/generate-result-link:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo generar el link." });
    }
}, $apis.requireAuth("users"));

// Vista pública, sin sesión: el token de la URL es toda la autorización que hace falta.
routerAdd("GET", "/registrar-resultado", (e) => {
    const { PALETTE_CSS, escapeHtml } = require(`${__hooks}/lib/adminUi.js`);
    const { resultTokenDecision } = require(`${__hooks}/lib/matchResult.js`);

    function errorPage(message) {
        return e.html(400, `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">` +
            `<meta name="viewport" content="width=device-width, initial-scale=1.0">` +
            `<title>Registrar resultado - Beauchapp</title></head>` +
            `<body style="background:#0f172a;color:#f1f5f9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;">` +
            `<h1 style="color:#ef4444;font-size:20px;max-width:420px;">${escapeHtml(message)}</h1>` +
            `</body></html>`);
    }

    const token = String(e.requestInfo().query["token"] || "");
    if (!token) return errorPage("Falta el token del enlace.");

    let match;
    try {
        match = $app.findFirstRecordByFilter("league_matches", "resultToken = {:token} && resultToken != ''", { token });
    } catch (err) {
        return errorPage("Este enlace no existe o ya se usó.");
    }

    const decision = resultTokenDecision(
        { resultToken: match.getString("resultToken"), resultTokenExpiresAt: match.getString("resultTokenExpiresAt") },
        token
    );
    if (!decision.ok) return errorPage(decision.error);

    function teamName(teamId) {
        try {
            const team = $app.findRecordById("users", teamId);
            return team.getString("name") || team.getString("username") || "Equipo";
        } catch (err) {
            return "Equipo";
        }
    }
    const teamAId = match.getString("teamA");
    const teamBId = match.getString("teamB");
    const teamAName = teamName(teamAId);
    const teamBName = teamName(teamBId);

    // Roster incrustado directo en la página (server-side, con $app — así se salta la
    // regla de la colección): la vista no tiene sesión, así que no puede pedirlo con
    // /api/collections/team_players/records como hace el modal autenticado de
    // /admin/liga (league.pb.js). Mismo criterio de "endpoint dedicado en vez de abrir
    // reglas de colección" que ya usa GET /api/public/team (CLAUDE.md §5).
    function roster(teamId) {
        return $app.findRecordsByFilter("team_players", "team = {:team} && deleted = false && role != 'coach'", "name", 200, 0, { team: teamId })
            .map((p) => ({ id: p.id, name: p.getString("name") }));
    }

    // Si ya hay un informe cargado (este link es una CORRECCIÓN, generado de nuevo sobre
    // un partido ya 'played'), se precarga con lo que ya está guardado en vez de partir
    // de cero — evita que corregir un solo dato obligue a recargar todo el partido.
    let existingEvents = [];
    let existingNotes = "";
    try {
        const report = $app.findFirstRecordByFilter("match_reports", "match = {:match} && deleted = false", { match: match.id });
        existingEvents = JSON.parse(report.getString("events") || "[]");
        existingNotes = report.getString("notes") || "";
    } catch (err) {
        existingEvents = [];
    }

    const matchData = {
        token,
        teamAName,
        teamBName,
        rosterA: roster(teamAId),
        rosterB: roster(teamBId),
        existingEvents,
        existingNotes,
    };
    // JSON incrustado en un <script> — escapar "<" evita que un nombre con "</script>"
    // (el nombre del equipo o de un jugador es texto libre) corte la página a la mitad.
    const matchDataJson = JSON.stringify(matchData).replace(/</g, "\\u003c");

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registrar resultado - Beauchapp</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        ${PALETTE_CSS}
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
        body {
            background-color: var(--bg-color);
            background-image: radial-gradient(circle at top right, rgba(56, 189, 248, 0.1), transparent 40%),
                              radial-gradient(circle at bottom left, rgba(30, 41, 59, 0.5), transparent 50%);
            color: var(--text-color);
            min-height: 100vh;
            padding: 24px 16px 64px;
        }
        .wrap { max-width: 560px; margin: 0 auto; }
        h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; text-align: center; }
        .subtitle { color: var(--text-muted); font-size: 13px; text-align: center; margin-bottom: 24px; }
        .card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 18px; margin-bottom: 16px; }
        .card h2 { font-size: 14px; margin-bottom: 10px; }
        .hint { color: var(--text-muted); font-size: 12px; }
        .scoreboard-card { text-align: center; }
        .scoreboard-row { display: flex; align-items: center; justify-content: center; gap: 14px; }
        .scoreboard-team { font-size: 13px; font-weight: 600; flex: 1; }
        .scoreboard-score { font-size: 26px; font-weight: 700; min-width: 76px; }
        .scoreboard-details { display: flex; gap: 16px; margin-top: 14px; text-align: left; }
        .scoreboard-details > div { flex: 1; min-height: 20px; }
        .preview-line { font-size: 12px; margin-bottom: 4px; }
        .dynamic-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }
        .row-kind-label { font-size: 12px; min-width: 92px; }
        .dynamic-row select { background: rgba(15,23,42,0.6); border: 1px solid var(--border-color); color: var(--text-color); border-radius: 6px; padding: 6px 8px; font: inherit; font-size: 12px; flex: 1; min-width: 140px; }
        .remove-row-btn { background: none; border: none; color: var(--danger-color); font-size: 18px; cursor: pointer; line-height: 1; padding: 0 6px; }
        .row-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        textarea { width: 100%; min-height: 80px; background: rgba(15,23,42,0.6); border: 1px solid var(--border-color); color: var(--text-color); border-radius: 8px; padding: 10px; font: inherit; font-size: 13px; resize: vertical; }
        .btn { display: inline-block; background: var(--primary-color); color: #05202f; border: none; border-radius: 8px; padding: 10px 16px; font: inherit; font-weight: 600; font-size: 13px; cursor: pointer; }
        .btn:hover { background: var(--primary-hover); }
        .btn:disabled { opacity: 0.6; cursor: default; }
        .btn-secondary { background: rgba(255,255,255,0.08); color: var(--text-color); }
        .btn-submit-row { text-align: center; margin-top: 20px; }
        .alert-danger { background: rgba(239,68,68,0.12); color: #fca5a5; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 16px; display: none; }
        .success-box { text-align: center; padding: 40px 16px; }
        .success-box h1 { color: var(--success-color); }
    </style>
</head>
<body>
    <div class="wrap">
        <h1 id="matchTitle"></h1>
        <p class="subtitle">Registrá el resultado de este partido. Este enlace se puede usar una sola vez.</p>

        <div class="alert-danger" id="formError"></div>

        <div class="card scoreboard-card">
            <div class="scoreboard-row">
                <span class="scoreboard-team" id="scoreboardTeamA"></span>
                <span class="scoreboard-score" id="previewScore">0 - 0</span>
                <span class="scoreboard-team" id="scoreboardTeamB"></span>
            </div>
            <div class="scoreboard-details">
                <div id="previewA"></div>
                <div id="previewB"></div>
            </div>
        </div>

        <form id="resultForm">
            <div class="card">
                <h2 id="teamATitle"></h2>
                <div id="teamAEvents"></div>
                <div class="row-buttons">
                    <button type="button" class="btn btn-secondary" id="addGoalA">+ Agregar gol</button>
                    <button type="button" class="btn btn-secondary" id="addYellowA">+ Agregar tarjeta amarilla</button>
                    <button type="button" class="btn btn-secondary" id="addRedA">+ Agregar tarjeta roja</button>
                </div>
            </div>
            <div class="card">
                <h2 id="teamBTitle"></h2>
                <div id="teamBEvents"></div>
                <div class="row-buttons">
                    <button type="button" class="btn btn-secondary" id="addGoalB">+ Agregar gol</button>
                    <button type="button" class="btn btn-secondary" id="addYellowB">+ Agregar tarjeta amarilla</button>
                    <button type="button" class="btn btn-secondary" id="addRedB">+ Agregar tarjeta roja</button>
                </div>
            </div>

            <div class="card">
                <h2>Notas (opcional)</h2>
                <textarea id="notes" placeholder="Incidencias, observaciones, etc."></textarea>
            </div>

            <div class="btn-submit-row">
                <button type="submit" class="btn" id="submitBtn">Enviar resultado</button>
            </div>
        </form>

        <div class="success-box" id="successBox" hidden>
            <h1>Resultado registrado</h1>
            <p class="hint">Este enlace ya no sirve.</p>
        </div>
    </div>

    <script>
        const MATCH = ${matchDataJson};

        function newEventId() {
            if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
            return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
        }

        document.getElementById("matchTitle").textContent = MATCH.teamAName + " vs " + MATCH.teamBName;
        document.getElementById("teamATitle").textContent = MATCH.teamAName;
        document.getElementById("teamBTitle").textContent = MATCH.teamBName;
        document.getElementById("scoreboardTeamA").textContent = MATCH.teamAName;
        document.getElementById("scoreboardTeamB").textContent = MATCH.teamBName;

        function rosterFor(team) { return team === "A" ? MATCH.rosterA : MATCH.rosterB; }

        function populatePlayerSelect(select, team, selectedPlayerId) {
            select.innerHTML = '<option value="">Sin jugador (opcional)</option>';
            rosterFor(team).forEach((p) => {
                const opt = document.createElement("option");
                opt.value = p.id;
                opt.textContent = p.name;
                if (p.id === selectedPlayerId) opt.selected = true;
                select.appendChild(opt);
            });
        }

        const KIND_LABELS = { goal: "⚽ Gol", yellow_card: "🟨 Amarilla", red_card: "🟥 Roja" };

        // Una fila de gol o tarjeta, fija a un equipo y un tipo — los define el botón que
        // la crea, así que la fila en sí solo pide el jugador (opcional: un gol sin
        // jugador es, en la práctica, un autogol del rival). El parámetro preset, si
        // viene, precarga la fila desde un evento ya guardado (link de corrección).
        function addEventRow(team, kind, preset) {
            const list = document.getElementById(team === "A" ? "teamAEvents" : "teamBEvents");
            const row = document.createElement("div");
            row.className = "dynamic-row";

            const label = document.createElement("span");
            label.className = "row-kind-label";
            label.textContent = KIND_LABELS[kind];
            row.appendChild(label);

            const playerSelect = document.createElement("select");
            row.appendChild(playerSelect);
            populatePlayerSelect(playerSelect, team, preset && preset.playerId);
            playerSelect.addEventListener("change", updatePreview);

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "remove-row-btn";
            removeBtn.title = "Quitar fila";
            removeBtn.textContent = "×";
            removeBtn.addEventListener("click", () => { row.remove(); updatePreview(); });
            row.appendChild(removeBtn);

            row._getEvent = function () {
                const playerOpt = playerSelect.selectedOptions[0];
                const base = { id: (preset && preset.id) || newEventId(), team, type: kind };
                if (playerOpt && playerOpt.value) {
                    base.playerId = playerOpt.value;
                    base.player = playerOpt.textContent;
                }
                // ownGoal ya no es una opción visible (ver comentario de cabecera del
                // archivo) — un gol agregado acá siempre cuenta para el equipo de esta
                // sección, con o sin jugador. isValidEvent (lib/matchEvents.js) igual lo
                // exige presente.
                if (kind === "goal") base.ownGoal = false;
                return base;
            };

            list.appendChild(row);
            updatePreview();
        }

        document.getElementById("addGoalA").addEventListener("click", () => addEventRow("A", "goal"));
        document.getElementById("addYellowA").addEventListener("click", () => addEventRow("A", "yellow_card"));
        document.getElementById("addRedA").addEventListener("click", () => addEventRow("A", "red_card"));
        document.getElementById("addGoalB").addEventListener("click", () => addEventRow("B", "goal"));
        document.getElementById("addYellowB").addEventListener("click", () => addEventRow("B", "yellow_card"));
        document.getElementById("addRedB").addEventListener("click", () => addEventRow("B", "red_card"));

        // Marcador simplificado, recalculado en cada cambio (agregar/quitar fila,
        // cambiar el jugador de una) — para que quien está cargando el resultado vea de
        // inmediato cómo va quedando el partido, sin tener que enviarlo para saberlo.
        function collectRows(team) {
            const list = document.getElementById(team === "A" ? "teamAEvents" : "teamBEvents");
            return Array.from(list.querySelectorAll(".dynamic-row")).map((row) => row._getEvent());
        }
        function renderPreviewSide(elId, events) {
            const el = document.getElementById(elId);
            el.innerHTML = "";
            const goals = events.filter((ev) => ev.type === "goal");
            const cards = events.filter((ev) => ev.type !== "goal");
            if (!goals.length && !cards.length) {
                el.innerHTML = '<p class="hint">Sin goles ni tarjetas.</p>';
                return;
            }
            goals.forEach((ev) => {
                const p = document.createElement("p");
                p.className = "preview-line";
                p.textContent = "⚽ " + (ev.player || "Sin jugador");
                el.appendChild(p);
            });
            cards.forEach((ev) => {
                const p = document.createElement("p");
                p.className = "preview-line";
                p.textContent = (ev.type === "yellow_card" ? "🟨 " : "🟥 ") + (ev.player || "Sin jugador");
                el.appendChild(p);
            });
        }
        function updatePreview() {
            const eventsA = collectRows("A");
            const eventsB = collectRows("B");
            const scoreA = eventsA.filter((ev) => ev.type === "goal").length;
            const scoreB = eventsB.filter((ev) => ev.type === "goal").length;
            document.getElementById("previewScore").textContent = scoreA + " - " + scoreB;
            renderPreviewSide("previewA", eventsA);
            renderPreviewSide("previewB", eventsB);
        }

        // Precarga de goles/tarjetas ya guardados (link de corrección). Un gol viejo con
        // ownGoal:true se recoloca en la sección del equipo que se benefició, sin
        // jugador (su jugador, si tenía uno, era del OTRO equipo — no tiene sentido en
        // el roster de acá). Convocatoria y penales de un informe viejo ya no se
        // soportan en este formulario: se omiten al precargar.
        MATCH.existingEvents.forEach((ev) => {
            if (!ev || ev.deleted) return;
            if (ev.type === "goal") {
                const scoringTeam = ev.ownGoal ? (ev.team === "A" ? "B" : "A") : ev.team;
                addEventRow(scoringTeam, "goal", ev);
            } else if (ev.type === "yellow_card" || ev.type === "red_card") {
                addEventRow(ev.team, ev.type, ev);
            }
        });
        document.getElementById("notes").value = MATCH.existingNotes || "";
        updatePreview();

        function showFormError(msg) {
            const el = document.getElementById("formError");
            el.textContent = msg;
            el.style.display = "block";
        }

        document.getElementById("resultForm").addEventListener("submit", async (ev) => {
            ev.preventDefault();
            document.getElementById("formError").style.display = "none";

            const events = [];
            ["A", "B"].forEach((team) => {
                document.getElementById(team === "A" ? "teamAEvents" : "teamBEvents").querySelectorAll(".dynamic-row").forEach((row) => {
                    if (row._getEvent) events.push(row._getEvent());
                });
            });

            const btn = document.getElementById("submitBtn");
            btn.disabled = true;
            try {
                const res = await fetch("/api/public/match-result", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: MATCH.token, events, notes: document.getElementById("notes").value }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "No se pudo enviar el resultado.");
                document.getElementById("resultForm").hidden = true;
                document.getElementById("successBox").hidden = false;
            } catch (err) {
                showFormError(err.message);
                btn.disabled = false;
            }
        });
    </script>
</body>
</html>`;

    return e.html(200, htmlContent);
});

// Envío del resultado — sin sesión, el token de la URL/body es toda la autorización.
routerAdd("POST", "/api/public/match-result", (e) => {
    try {
        const { isValidEvent, summarizeEvents } = require(`${__hooks}/lib/matchEvents.js`);
        const { resultTokenDecision } = require(`${__hooks}/lib/matchResult.js`);
        const { isBettingClosed } = require(`${__hooks}/lib/polla.js`);

        const body = e.requestInfo().body || {};
        const token = String(body.token || "");
        const events = Array.isArray(body.events) ? body.events : [];
        const notes = String(body.notes || "");
        if (!token) throw new BadRequestError("Falta el token del enlace.");

        let match;
        try {
            match = $app.findFirstRecordByFilter("league_matches", "resultToken = {:token} && resultToken != ''", { token });
        } catch (err) {
            throw new BadRequestError("Este enlace no existe o ya se usó.");
        }
        const decision = resultTokenDecision(
            { resultToken: match.getString("resultToken"), resultTokenExpiresAt: match.getString("resultTokenExpiresAt") },
            token
        );
        // Respuesta directa, no BadRequestError: ver el mismo comentario en
        // match_arbitration.pb.js — BadRequestError normaliza cualquier data bag no
        // reconocido y acá igual no hace falta un `reason` de máquina, alcanza con el
        // mensaje.
        if (!decision.ok) return e.json(400, { error: decision.error });

        // Este formulario solo registra goles y tarjetas — nada de reloj, convocatoria
        // ni penales (decisión de producto, ver comentario de cabecera del archivo).
        // Lista blanca en vez de negra: cualquier tipo nuevo que sume lib/matchEvents.js
        // el día de mañana queda afuera acá hasta que se decida sumarlo también.
        const ALLOWED_TYPES = new Set(["goal", "yellow_card", "red_card"]);
        for (const ev of events) {
            if (!ev || !ALLOWED_TYPES.has(ev.type)) {
                throw new BadRequestError("Este formulario solo admite goles y tarjetas.");
            }
            if (!isValidEvent(ev)) throw new BadRequestError("Hay un evento con formato inválido.");
        }
        const summary = summarizeEvents(events);
        const matchId = match.id;
        // Si el partido ya estaba 'played', este envío es una CORRECCIÓN (llegó por un
        // link generado de nuevo sobre un resultado ya oficial) — determina si el
        // mercado de Beaumarket hay que revertirlo/reaplicarlo o resolverlo por primera
        // vez, igual que isAmend en match_arbitration.pb.js.
        const wasPlayed = match.getString("status") === "played";

        $app.runInTransaction((txApp) => {
            let report;
            try {
                report = txApp.findFirstRecordByFilter("match_reports", "match = {:match} && deleted = false", { match: matchId });
            } catch (err) {
                const coll = txApp.findCollectionByNameOrId("match_reports");
                report = new Record(coll);
                report.set("match", matchId);
            }
            report.set("events", events);
            report.set("status", "approved");
            report.set("notes", notes);
            txApp.save(report);

            const txMatch = txApp.findRecordById("league_matches", matchId);
            txMatch.set("scoreA", summary.scoreA);
            txMatch.set("scoreB", summary.scoreB);
            txMatch.set("status", "played");
            // Uso único: el link que se acaba de usar queda muerto, mismo patrón que
            // registrationToken en auth.pb.js.
            txMatch.set("resultToken", "");
            txMatch.set("resultTokenExpiresAt", "");
            // El partido ya ocurrió — la Beaupolla no puede seguir abierta, sin importar
            // qué tan tarde se haya cargado el resultado.
            if (!isBettingClosed(txMatch.getString("bettingClosesAt"))) {
                txMatch.set("bettingClosesAt", new Date().toISOString());
            }
            txApp.save(txMatch);

            const marketId = txMatch.getString("beaumarketMarket");
            if (!marketId) return;
            let market;
            try {
                market = txApp.findRecordById("beaumarkets", marketId);
            } catch (err) {
                return;
            }
            const { finalPayout } = require(`${__hooks}/lib/beaumarket.js`);
            const winningOutcomeIndex = summary.scoreA > summary.scoreB ? 0 : summary.scoreA < summary.scoreB ? 2 : 1;
            const marketStatus = market.getString("status");

            if (wasPlayed && marketStatus === "resolved") {
                // Corrección de un resultado ya pagado: revierte el pago viejo y aplica
                // el nuevo. Ver el comentario largo equivalente en
                // match_arbitration.pb.js sobre por qué la reversión es exacta.
                const oldWinningIndex = market.getInt("winningOutcomeIndex");
                if (oldWinningIndex === winningOutcomeIndex) return;

                const pool = JSON.parse(market.getString("pool") || "[]");
                const totalPool = pool.reduce((a, c) => a + c, 0);
                function settle(outcomeIndex, sign) {
                    const outcomePool = pool[outcomeIndex] || 0;
                    const positions = txApp.findRecordsByFilter(
                        "beaumarket_positions", "market = {:m} && outcomeIndex = {:o}", "", 0, 0,
                        { m: marketId, o: outcomeIndex }
                    );
                    positions.forEach((pos) => {
                        const amount = pos.getInt("amount");
                        const payout = finalPayout(amount, outcomePool, totalPool);
                        if (payout > 0) {
                            txApp.db()
                                .newQuery("UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:amt} WHERE id = {:id}")
                                .bind({ amt: sign * payout, id: pos.getString("user") })
                                .execute();
                        }
                    });
                }
                settle(oldWinningIndex, -1);
                settle(winningOutcomeIndex, 1);
                market.set("winningOutcomeIndex", winningOutcomeIndex);
                txApp.save(market);
            } else if (!wasPlayed && (marketStatus === "open" || marketStatus === "closed")) {
                // Primera carga del resultado: resuelve el mercado, igual que hacía
                // POST /api/league-matches/submit en match_arbitration.pb.js.
                const pool = JSON.parse(market.getString("pool") || "[]");
                const totalPool = pool.reduce((a, c) => a + c, 0);
                const winnerPool = pool[winningOutcomeIndex] || 0;
                const positions = txApp.findRecordsByFilter(
                    "beaumarket_positions", "market = {:m} && outcomeIndex = {:o}", "", 0, 0,
                    { m: marketId, o: winningOutcomeIndex }
                );
                positions.forEach((pos) => {
                    const amount = pos.getInt("amount");
                    const payout = finalPayout(amount, winnerPool, totalPool);
                    if (payout > 0) {
                        txApp.db()
                            .newQuery("UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:amt} WHERE id = {:id}")
                            .bind({ amt: payout, id: pos.getString("user") })
                            .execute();
                    }
                });
                market.set("status", "resolved");
                market.set("winningOutcomeIndex", winningOutcomeIndex);
                txApp.save(market);
            }
        });

        return e.json(200, { success: true, scoreA: summary.scoreA, scoreB: summary.scoreB });
    } catch (err) {
        console.error("[match_result.pb.js] Error en POST /api/public/match-result:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo guardar el resultado." });
    }
});

// Carga/corrección del resultado por el equipo asignado a arbitrar, con su propia
// sesión — ver el comentario de cabecera del archivo ("SEGUNDA VÍA"). Requiere cuenta
// (a diferencia del link, que es anónimo por diseño): la autorización es estar en
// league_matches.refereeTeams, no un token. Duplica buena parte de la transacción de
// POST /api/public/match-result (marcador + Beaumarket) a propósito, mismo criterio que
// ya usa el resto del arbitraje: cada routerAdd corre en su propia VM (ver la nota de
// cabecera de match_arbitration.pb.js), así que no hay forma de compartir esa lógica sin
// pasarla a un lib/*.js con $app — y eso rompería el poder testear ese lib sin PocketBase.
routerAdd("POST", "/api/league-matches/team-result", (e) => {
    try {
        const { isValidEvent, summarizeEvents } = require(`${__hooks}/lib/matchEvents.js`);
        const { teamRefereeDecision } = require(`${__hooks}/lib/matchResult.js`);
        const { isBettingClosed } = require(`${__hooks}/lib/polla.js`);

        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        const events = Array.isArray(body.events) ? body.events : [];
        const notes = String(body.notes || "");
        if (!matchId) throw new BadRequestError("Falta matchId.");

        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("El partido indicado no existe.");
        }

        const decision = teamRefereeDecision(
            { refereeTeams: match.get("refereeTeams") || [], status: match.getString("status") },
            e.auth.id
        );
        // Respuesta directa, no BadRequestError: mismo motivo que en
        // match_arbitration.pb.js — no hace falta un `reason` de máquina acá, alcanza
        // con el mensaje.
        if (!decision.ok) return e.json(400, { error: decision.error });

        // Este formulario solo registra goles y tarjetas — nada de reloj, convocatoria
        // ni penales, igual que el link (ver comentario de cabecera del archivo).
        const ALLOWED_TYPES = new Set(["goal", "yellow_card", "red_card"]);
        for (const ev of events) {
            if (!ev || !ALLOWED_TYPES.has(ev.type)) {
                throw new BadRequestError("Este formulario solo admite goles y tarjetas.");
            }
            if (!isValidEvent(ev)) throw new BadRequestError("Hay un evento con formato inválido.");
        }
        const summary = summarizeEvents(events);
        const wasPlayed = match.getString("status") === "played";

        $app.runInTransaction((txApp) => {
            let report;
            try {
                report = txApp.findFirstRecordByFilter("match_reports", "match = {:match} && deleted = false", { match: matchId });
            } catch (err) {
                const coll = txApp.findCollectionByNameOrId("match_reports");
                report = new Record(coll);
                report.set("match", matchId);
                report.set("referee", e.auth.id);
            }
            report.set("events", events);
            report.set("status", "approved");
            report.set("notes", notes);

            // Historial completo de envíos por equipo — ver el comentario de cabecera
            // del archivo sobre por qué esto es un arreglo y no un solo campo como
            // amendedBy/amendedAt. .get() sobre JSON no devuelve el valor parseado
            // dentro de un hook de registro, hay que pasar por getString()+JSON.parse()
            // (mismo caveat que `events` en match_arbitration.pb.js).
            let refereeTeamLog = [];
            try {
                refereeTeamLog = JSON.parse(report.getString("refereeTeamLog") || "[]");
            } catch (pErr) {
                refereeTeamLog = [];
            }
            refereeTeamLog.push({ team: e.auth.id, at: new Date().toISOString() });
            report.set("refereeTeamLog", refereeTeamLog);

            txApp.save(report);

            const txMatch = txApp.findRecordById("league_matches", matchId);
            txMatch.set("scoreA", summary.scoreA);
            txMatch.set("scoreB", summary.scoreB);
            txMatch.set("status", "played");
            // Si la liga había generado un link para este partido, queda invalidado: el
            // resultado ya se cargó por acá, un envío posterior por el link viejo no
            // debería poder pisarlo sin que la liga vuelva a generar uno nuevo a propósito.
            txMatch.set("resultToken", "");
            txMatch.set("resultTokenExpiresAt", "");
            if (!isBettingClosed(txMatch.getString("bettingClosesAt"))) {
                txMatch.set("bettingClosesAt", new Date().toISOString());
            }
            txApp.save(txMatch);

            const marketId = txMatch.getString("beaumarketMarket");
            if (!marketId) return;
            let market;
            try {
                market = txApp.findRecordById("beaumarkets", marketId);
            } catch (err) {
                return;
            }
            const { finalPayout } = require(`${__hooks}/lib/beaumarket.js`);
            const winningOutcomeIndex = summary.scoreA > summary.scoreB ? 0 : summary.scoreA < summary.scoreB ? 2 : 1;
            const marketStatus = market.getString("status");

            if (wasPlayed && marketStatus === "resolved") {
                // Corrección de un resultado ya pagado: revierte el pago viejo y aplica
                // el nuevo. Ver el comentario largo equivalente en
                // match_arbitration.pb.js sobre por qué la reversión es exacta.
                const oldWinningIndex = market.getInt("winningOutcomeIndex");
                if (oldWinningIndex === winningOutcomeIndex) return;

                const pool = JSON.parse(market.getString("pool") || "[]");
                const totalPool = pool.reduce((a, c) => a + c, 0);
                function settle(outcomeIndex, sign) {
                    const outcomePool = pool[outcomeIndex] || 0;
                    const positions = txApp.findRecordsByFilter(
                        "beaumarket_positions", "market = {:m} && outcomeIndex = {:o}", "", 0, 0,
                        { m: marketId, o: outcomeIndex }
                    );
                    positions.forEach((pos) => {
                        const amount = pos.getInt("amount");
                        const payout = finalPayout(amount, outcomePool, totalPool);
                        if (payout > 0) {
                            txApp.db()
                                .newQuery("UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:amt} WHERE id = {:id}")
                                .bind({ amt: sign * payout, id: pos.getString("user") })
                                .execute();
                        }
                    });
                }
                settle(oldWinningIndex, -1);
                settle(winningOutcomeIndex, 1);
                market.set("winningOutcomeIndex", winningOutcomeIndex);
                txApp.save(market);
            } else if (!wasPlayed && (marketStatus === "open" || marketStatus === "closed")) {
                // Primera carga del resultado: resuelve el mercado.
                const pool = JSON.parse(market.getString("pool") || "[]");
                const totalPool = pool.reduce((a, c) => a + c, 0);
                const winnerPool = pool[winningOutcomeIndex] || 0;
                const positions = txApp.findRecordsByFilter(
                    "beaumarket_positions", "market = {:m} && outcomeIndex = {:o}", "", 0, 0,
                    { m: marketId, o: winningOutcomeIndex }
                );
                positions.forEach((pos) => {
                    const amount = pos.getInt("amount");
                    const payout = finalPayout(amount, winnerPool, totalPool);
                    if (payout > 0) {
                        txApp.db()
                            .newQuery("UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:amt} WHERE id = {:id}")
                            .bind({ amt: payout, id: pos.getString("user") })
                            .execute();
                    }
                });
                market.set("status", "resolved");
                market.set("winningOutcomeIndex", winningOutcomeIndex);
                txApp.save(market);
            }
        });

        return e.json(200, { success: true, scoreA: summary.scoreA, scoreB: summary.scoreB });
    } catch (err) {
        console.error("[match_result.pb.js] Error en POST /api/league-matches/team-result:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo guardar el resultado." });
    }
}, $apis.requireAuth("users"));
