/// <reference path="../pb_data/types.d.ts" />

// ---------------------------------------------------------------------------------
// Gestión de ligas — a diferencia de /admin/horarios (superusuario), esta herramienta
// se autentica con la propia cuenta de organización de la liga (type=organization,
// subtype=league). No existe una colección "leagues" separada: la cuenta de usuario
// ES la liga, así que cada ruta opera siempre sobre "mi propia liga" (e.auth.id), sin
// necesidad de un parámetro leagueId ni de chequear ownership contra otro id.
// ---------------------------------------------------------------------------------

routerAdd("GET", "/admin/liga", (e) => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestionar Liga</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --border-color: rgba(255, 255, 255, 0.1);
            --primary-color: #38bdf8;
            --primary-hover: #0ea5e9;
            --text-color: #f1f5f9;
            --text-muted: #94a3b8;
            --danger-color: #ef4444;
            --success-color: #22c55e;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
        body {
            background-color: var(--bg-color);
            background-image: radial-gradient(circle at top right, rgba(56, 189, 248, 0.1), transparent 40%),
                              radial-gradient(circle at bottom left, rgba(30, 41, 59, 0.5), transparent 50%);
            color: var(--text-color);
            min-height: 100vh;
            padding: 24px;
        }
        .page { max-width: 720px; margin: 0 auto; }
        .container {
            width: 100%;
            max-width: 480px;
            margin: 60px auto;
            background: var(--card-bg);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            text-align: center;
        }
        h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        h2 { font-size: 16px; font-weight: 700; margin: 28px 0 14px; }
        .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 24px; }
        .card { background: var(--card-bg); backdrop-filter: blur(16px); border: 1px solid var(--border-color); border-radius: 18px; padding: 24px; margin-bottom: 20px; }
        .form-group { text-align: left; margin-bottom: 16px; }
        label { display: block; font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
        input[type="email"], input[type="password"], input[type="text"] {
            width: 100%; background: rgba(15,23,42,0.6); border: 1px solid var(--border-color);
            border-radius: 10px; padding: 10px 14px; color: var(--text-color); font-size: 14px; outline: none;
        }
        input:focus { border-color: var(--primary-color); }
        .hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
        .btn {
            background: var(--primary-color); color: #0f172a; border: none; border-radius: 10px;
            padding: 10px 18px; font-size: 14px; font-weight: 700; cursor: pointer;
        }
        .btn:hover { background: var(--primary-hover); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: rgba(255,255,255,0.05); color: var(--text-color); border: 1px solid var(--border-color); }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }
        .btn-sm { padding: 6px 12px; font-size: 12px; margin-right: 6px; margin-top: 6px; }
        .btn-accept { background: var(--success-color); color: #05230f; }
        .btn-reject { background: rgba(255,255,255,0.05); color: var(--text-color); border: 1px solid var(--border-color); }
        .alert { padding: 12px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 16px; text-align: left; display: none; }
        .alert-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
        #logoutBar { text-align: right; margin-bottom: 16px; }
        .team-checkbox-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border-color); font-size: 13px; }
        .match-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color); font-size: 13px; gap: 10px; }
        .match-row .gap-tag { font-size: 11px; color: var(--text-muted); }
        .match-actions { display: flex; gap: 6px; flex-shrink: 0; }
        select { background: rgba(15,23,42,0.6); border: 1px solid var(--border-color); border-radius: 10px; padding: 8px 12px; color: var(--text-color); font-size: 13px; width: 100%; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="page" id="loginPage">
        <div class="container">
            <h1>Gestionar Liga</h1>
            <p class="subtitle">Inicia sesión con la cuenta de tu liga</p>
            <div class="alert alert-danger" id="loginError"></div>
            <form id="loginForm">
                <div class="form-group">
                    <label>Usuario</label>
                    <input type="text" id="loginIdentity" required autocapitalize="none" autocomplete="username">
                </div>
                <div class="form-group">
                    <label>Contraseña</label>
                    <input type="password" id="loginPassword" required>
                </div>
                <button type="submit" class="btn" style="width:100%;">Iniciar Sesión</button>
            </form>
        </div>
    </div>

    <div class="page" id="panelPage" style="display:none;">
        <div id="logoutBar"><button class="btn btn-secondary btn-sm" id="logoutBtn">Cerrar Sesión</button></div>
        <h1 id="leagueName">Liga</h1>
        <p class="subtitle">Elige qué equipos participan, crea etapas, y agrega partidos dentro de cada etapa.</p>
        <div class="alert alert-danger" id="panelError"></div>

        <div class="card">
            <h2 style="margin-top:0;">Equipos de la liga</h2>
            <div id="rosterList"><p class="hint">Cargando...</p></div>
        </div>

        <div class="card">
            <h2 style="margin-top:0;">Etapas</h2>
            <form id="createStageForm" style="display:flex; gap:8px; margin-bottom:14px;">
                <input type="text" id="stageName" placeholder="Ej. Fase de grupos" required style="flex:1;">
                <button type="submit" class="btn btn-sm" style="margin-top:0;">Crear</button>
            </form>
            <div id="stagesList"><p class="hint">Cargando...</p></div>
        </div>

        <div class="card" id="addMatchesCard" style="display:none;">
            <h2 style="margin-top:0;">Agregar partidos — <span id="activeStageName"></span></h2>
            <p class="hint">Elige los equipos de la liga que van a jugar y corre el algoritmo. Cada sugerencia se acepta o descarta individualmente.</p>
            <div id="stageTeamsList"></div>
            <button class="btn btn-sm" id="proposeBtn" style="margin-top:10px;">Sugerir partidos</button>
            <div id="proposalsWrap"></div>
        </div>

        <div class="card" id="stageMatchesCard" style="display:none;">
            <h2 style="margin-top:0;">Partidos de <span id="matchesStageName"></span></h2>
            <div id="stageMatchesList"></div>
        </div>
    </div>

    <script>
        const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
        const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

        function formatBlockLabel(code) {
            const hour = code.slice(-2);
            const dateStr = code.slice(0, -3);
            const d = new Date(dateStr + "T00:00:00");
            const label = DAY_LABELS[(d.getDay() + 6) % 7] + " " + d.getDate() + " " + MONTH_LABELS[d.getMonth()];
            return label + " " + hour + ":00";
        }

        let token = "";
        try {
            const authData = JSON.parse(localStorage.getItem("liga_auth"));
            if (authData && authData.token) token = authData.token;
        } catch (e) {}

        const loginPage = document.getElementById("loginPage");
        const panelPage = document.getElementById("panelPage");
        const loginError = document.getElementById("loginError");
        const panelError = document.getElementById("panelError");

        function showError(el, msg) { el.textContent = msg; el.style.display = "block"; }
        function hideError(el) { el.style.display = "none"; }

        let myLeagueId = "";

        function showPanel(name, leagueId) {
            loginPage.style.display = "none";
            panelPage.style.display = "block";
            document.getElementById("leagueName").textContent = name || "Liga";
            myLeagueId = leagueId || "";
            loadRoster();
            loadStages();
        }
        function showLogin() { loginPage.style.display = "block"; panelPage.style.display = "none"; }

        document.getElementById("loginForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            hideError(loginError);
            const identity = document.getElementById("loginIdentity").value;
            const password = document.getElementById("loginPassword").value;
            try {
                const res = await fetch("/api/collections/users/auth-with-password", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identity: identity, password: password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || "Credenciales incorrectas.");
                if (data.record.type !== "organization" || data.record.subtype !== "league") {
                    throw new Error("Esta cuenta no es una liga.");
                }
                token = data.token;
                localStorage.setItem("liga_auth", JSON.stringify({ token, model: data.record }));
                showPanel(data.record.name, data.record.id);
            } catch (err) { showError(loginError, err.message); }
        });

        document.getElementById("logoutBtn").addEventListener("click", () => {
            token = ""; localStorage.removeItem("liga_auth"); showLogin();
        });

        async function apiCall(path, method, payload) {
            const res = await fetch(path, {
                method: method,
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: payload ? JSON.stringify(payload) : undefined,
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    token = ""; localStorage.removeItem("liga_auth"); showLogin();
                    throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
                }
                throw new Error(data.error || data.message || "Error.");
            }
            return data;
        }

        // --- Equipos de la liga ---
        const rosterList = document.getElementById("rosterList");
        let rosterTeams = [];

        async function loadRoster() {
            hideError(panelError);
            rosterList.innerHTML = '<p class="hint">Cargando...</p>';
            try {
                const data = await apiCall("/api/liga/roster", "GET");
                const myTeamIds = new Set(data.myTeamIds);
                rosterTeams = data.allTeams.filter((t) => myTeamIds.has(t.id));
                rosterList.innerHTML = "";
                if (!data.allTeams.length) {
                    rosterList.innerHTML = '<p class="hint">Todavía no hay ninguna cuenta de equipo creada.</p>';
                    return;
                }
                data.allTeams.forEach((t) => {
                    const row = document.createElement("label");
                    row.className = "team-checkbox-row";
                    const checked = myTeamIds.has(t.id) ? "checked" : "";
                    row.innerHTML = '<input type="checkbox" value="' + t.id + '" ' + checked + '> ' + (t.name || t.username || t.id);
                    row.querySelector("input").addEventListener("change", async (ev) => {
                        ev.target.disabled = true;
                        try {
                            await apiCall("/api/liga/roster/toggle", "POST", { teamId: t.id });
                            await loadRoster();
                            renderStageTeamOptions();
                        } catch (err) { showError(panelError, err.message); }
                        finally { ev.target.disabled = false; }
                    });
                    rosterList.appendChild(row);
                });
            } catch (err) { showError(panelError, err.message); }
        }

        // --- Etapas ---
        const stagesList = document.getElementById("stagesList");
        let stages = [];
        let activeStage = null;

        document.getElementById("createStageForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            hideError(panelError);
            const input = document.getElementById("stageName");
            const name = input.value.trim();
            if (!name) return;
            try {
                await apiCall("/api/liga/stages/create", "POST", { name });
                input.value = "";
                await loadStages();
            } catch (err) { showError(panelError, err.message); }
        });

        async function loadStages() {
            hideError(panelError);
            stagesList.innerHTML = '<p class="hint">Cargando...</p>';
            try {
                const data = await apiCall("/api/liga/stages", "GET");
                stages = data.stages;
                stagesList.innerHTML = "";
                if (!stages.length) {
                    stagesList.innerHTML = '<p class="hint">Todavía no hay etapas.</p>';
                    return;
                }
                stages.forEach((s) => {
                    const row = document.createElement("div");
                    row.className = "team-checkbox-row";
                    row.innerHTML = '<span style="flex:1;">' + s.name + '</span>';
                    const btn = document.createElement("button");
                    btn.className = "btn btn-sm";
                    btn.style.marginTop = "0";
                    btn.textContent = "Gestionar";
                    btn.addEventListener("click", () => selectStage(s));
                    row.appendChild(btn);
                    stagesList.appendChild(row);
                });
            } catch (err) { showError(panelError, err.message); }
        }

        function selectStage(stage) {
            activeStage = stage;
            document.getElementById("addMatchesCard").style.display = "block";
            document.getElementById("activeStageName").textContent = stage.name;
            document.getElementById("proposalsWrap").innerHTML = "";
            renderStageTeamOptions();
            loadStageMatches();
        }

        function renderStageTeamOptions() {
            const wrap = document.getElementById("stageTeamsList");
            wrap.innerHTML = "";
            if (!activeStage) return;
            rosterTeams.forEach((t) => {
                const row = document.createElement("label");
                row.className = "team-checkbox-row";
                row.innerHTML = '<input type="checkbox" class="stage-team-check" value="' + t.id + '" checked> ' + (t.name || t.username || t.id);
                wrap.appendChild(row);
            });
        }

        let lastByeTeamId = null;

        document.getElementById("proposeBtn").addEventListener("click", async () => {
            hideError(panelError);
            if (!activeStage) return;
            const selected = Array.from(document.querySelectorAll(".stage-team-check:checked")).map((i) => i.value);
            if (selected.length < 2) { showError(panelError, "Elige al menos 2 equipos."); return; }
            const btn = document.getElementById("proposeBtn");
            btn.disabled = true;
            try {
                const payload = { stageId: activeStage.id, teamIds: selected };
                if (lastByeTeamId) payload.byeTeamId = lastByeTeamId;
                const res = await apiCall("/api/liga/matches/propose", "POST", payload);
                renderProposals(res, (byeId) => { lastByeTeamId = byeId; btn.click(); });
            } catch (err) { showError(panelError, err.message); }
            finally { btn.disabled = false; }
        });

        function renderProposals(res, onByeChange) {
            const wrap = document.getElementById("proposalsWrap");
            wrap.innerHTML = "";

            if (res.needsBye) {
                const p = document.createElement("p");
                p.className = "hint";
                p.textContent = "Cantidad impar de equipos — elige quién queda libre:";
                wrap.appendChild(p);
                const select = document.createElement("select");
                res.candidates.forEach((c) => {
                    const opt = document.createElement("option");
                    opt.value = c.id;
                    opt.textContent = (c.name || c.username || c.id) + (c.id === res.suggestedByeTeamId ? " (sugerido)" : "");
                    if (c.id === res.suggestedByeTeamId) opt.selected = true;
                    select.appendChild(opt);
                });
                wrap.appendChild(select);
                const btn = document.createElement("button");
                btn.className = "btn btn-sm";
                btn.textContent = "Usar este bye";
                btn.addEventListener("click", () => onByeChange(select.value));
                wrap.appendChild(btn);
                return;
            }

            if (res.infeasible) {
                wrap.innerHTML = '<p class="hint">No existe ningún emparejamiento posible para este conjunto de equipos.</p>';
                return;
            }

            const summary = document.createElement("p");
            summary.className = "hint";
            summary.textContent = "Diferencia máxima lograda: " + res.threshold.toFixed(2) + " · felicidad total: " + res.totalScore.toFixed(2) +
                (res.byeTeamId ? " · libre: " + (res.byeTeamName || res.byeTeamId) : "");
            wrap.appendChild(summary);

            res.matches.forEach((m) => {
                const row = document.createElement("div");
                row.className = "match-row";
                const info = document.createElement("span");
                info.textContent = m.teamAName + " (" + m.happinessA + ") vs " + m.teamBName + " (" + m.happinessB + ") · " + formatBlockLabel(m.block) + " · gap " + m.gap.toFixed(2);
                row.appendChild(info);

                const actions = document.createElement("div");
                actions.className = "match-actions";
                const acceptBtn = document.createElement("button");
                acceptBtn.className = "btn btn-sm btn-accept";
                acceptBtn.textContent = "Sí";
                acceptBtn.addEventListener("click", async () => {
                    acceptBtn.disabled = true;
                    try {
                        await apiCall("/api/liga/matches/accept", "POST", {
                            stageId: activeStage.id,
                            teamA: m.teamA, teamB: m.teamB, block: m.block,
                            happinessA: m.happinessA, happinessB: m.happinessB, gap: m.gap,
                        });
                        row.style.opacity = "0.5";
                        actions.innerHTML = "Agregado ✓";
                        loadStageMatches();
                    } catch (err) { showError(panelError, err.message); acceptBtn.disabled = false; }
                });
                const rejectBtn = document.createElement("button");
                rejectBtn.className = "btn btn-sm btn-reject";
                rejectBtn.textContent = "No";
                rejectBtn.addEventListener("click", () => { row.remove(); });
                actions.appendChild(acceptBtn);
                actions.appendChild(rejectBtn);
                row.appendChild(actions);
                wrap.appendChild(row);
            });
        }

        async function loadStageMatches() {
            if (!activeStage) return;
            const card = document.getElementById("stageMatchesCard");
            const list = document.getElementById("stageMatchesList");
            document.getElementById("matchesStageName").textContent = activeStage.name;
            card.style.display = "block";
            list.innerHTML = '<p class="hint">Cargando...</p>';
            try {
                const data = await apiCall("/api/liga/matches?stageId=" + activeStage.id, "GET");
                list.innerHTML = "";
                if (!data.matches.length) {
                    list.innerHTML = '<p class="hint">Todavía no hay partidos en esta etapa.</p>';
                    return;
                }
                data.matches.forEach((m) => {
                    const row = document.createElement("div");
                    row.className = "match-row";
                    let statusTag = "";
                    if (m.status === "played") {
                        statusTag = "Jugado";
                    } else if (m.status === "cancelled") {
                        statusTag = "Cancelado";
                    } else {
                        statusTag = "Código: " + m.code;
                    }
                    row.innerHTML = '<span>' + m.teamAName + ' vs ' + m.teamBName + '</span><span class="gap-tag">' + formatBlockLabel(m.blockCode) + ' &middot; ' + statusTag + '</span>';
                    list.appendChild(row);
                });
            } catch (err) { showError(panelError, err.message); }
        }

        // Al final del script a propósito: showPanel()/loadRoster()/loadStages() usan
        // consts (rosterList, stagesList, etc.) declaradas más abajo en este mismo
        // script — si este chequeo de sesión corre antes de esas declaraciones, revienta
        // con "can't access lexical declaration before initialization" (temporal dead
        // zone), que es justo el bug que esto corrige.
        if (token) {
            try {
                const authData = JSON.parse(localStorage.getItem("liga_auth"));
                showPanel(authData && authData.model && authData.model.name, authData && authData.model && authData.model.id);
            } catch (e) { showLogin(); }
        } else {
            showLogin();
        }
    </script>
</body>
</html>
    `;
    return e.html(200, htmlContent);
});

routerAdd("GET", "/api/liga/roster", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const allTeams = $app.findRecordsByFilter("users", "type = 'organization' && subtype = 'team'", "name", 500, 0);
        const myRows = $app.findRecordsByFilter("league_teams", "league = {:league}", "", 0, 0, { league: e.auth.id });
        return e.json(200, {
            allTeams: allTeams.map((t) => ({ id: t.id, name: t.getString("name"), username: t.getString("username") })),
            myTeamIds: myRows.map((r) => r.getString("team")),
        });
    } catch (err) {
        console.error("[league.pb.js] Error en GET /api/liga/roster:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cargar el roster." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/liga/roster/toggle", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const teamId = String(body.teamId || "");
        if (!teamId) throw new BadRequestError("Falta teamId.");

        let team;
        try {
            team = $app.findRecordById("users", teamId);
        } catch (err) {
            throw new BadRequestError("El equipo indicado no existe.");
        }
        if (team.getString("type") !== "organization" || team.getString("subtype") !== "team") {
            throw new BadRequestError("Esa cuenta no es un equipo.");
        }

        let existing = null;
        try {
            existing = $app.findFirstRecordByFilter(
                "league_teams",
                "league = {:league} && team = {:team}",
                { league: e.auth.id, team: teamId }
            );
        } catch (err) {
            existing = null;
        }

        if (existing) {
            $app.delete(existing);
            return e.json(200, { inRoster: false });
        }

        const coll = $app.findCollectionByNameOrId("league_teams");
        const record = new Record(coll);
        record.set("league", e.auth.id);
        record.set("team", teamId);
        $app.save(record);
        return e.json(200, { inRoster: true });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/roster/toggle:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo actualizar el roster." });
    }
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/liga/stages", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const stages = $app.findRecordsByFilter("league_stages", "league = {:league}", "-created", 0, 0, { league: e.auth.id });
        return e.json(200, { stages: stages.map((s) => ({ id: s.id, name: s.getString("name") })) });
    } catch (err) {
        console.error("[league.pb.js] Error en GET /api/liga/stages:", err);
        return e.json(400, { error: (err && err.message) || "No se pudieron cargar las etapas." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/liga/stages/create", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const name = String(body.name || "").trim();
        if (!name) throw new BadRequestError("El nombre es requerido.");

        const coll = $app.findCollectionByNameOrId("league_stages");
        const record = new Record(coll);
        record.set("league", e.auth.id);
        record.set("name", name);
        $app.save(record);
        return e.json(200, { success: true, id: record.id });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/stages/create:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo crear la etapa." });
    }
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/liga/matches", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const stageId = String(e.requestInfo().query.stageId || "");
        if (!stageId) throw new BadRequestError("Falta stageId.");

        let stage;
        try {
            stage = $app.findRecordById("league_stages", stageId);
        } catch (err) {
            throw new BadRequestError("La etapa indicada no existe.");
        }
        if (stage.getString("league") !== e.auth.id) {
            throw new BadRequestError("Esa etapa no pertenece a tu liga.");
        }

        function teamDisplay(teamId) {
            try {
                const team = $app.findRecordById("users", teamId);
                return team.getString("name") || team.getString("username") || teamId;
            } catch (err) {
                return teamId;
            }
        }

        // El código de arbitraje (league_matches.code) es un campo "hidden" — no viaja
        // en una lectura normal de la colección para cuentas no-superusuario, así que
        // la única forma de que la liga lo vea (para poder compartirlo) es que una ruta
        // con $app, como esta, lo incluya explícitamente en su propia respuesta.
        function reportStatusFor(matchId) {
            try {
                return $app.findFirstRecordByFilter("match_reports", "match = {:match}", { match: matchId }).getString("status");
            } catch (err) {
                return null;
            }
        }

        const matches = $app.findRecordsByFilter("league_matches", "stage = {:stage}", "-created", 0, 0, { stage: stageId });
        return e.json(200, {
            matches: matches.map((m) => ({
                id: m.id,
                teamA: m.getString("teamA"),
                teamB: m.getString("teamB"),
                teamAName: teamDisplay(m.getString("teamA")),
                teamBName: teamDisplay(m.getString("teamB")),
                blockCode: m.getString("blockCode"),
                status: m.getString("status"),
                code: m.getString("code"),
                reportStatus: reportStatusFor(m.id),
            })),
        });
    } catch (err) {
        console.error("[league.pb.js] Error en GET /api/liga/matches:", err);
        return e.json(400, { error: (err && err.message) || "No se pudieron cargar los partidos." });
    }
}, $apis.requireAuth("users"));

// teamDisplay/loadValidBlocks/loadMatchInputs se definen DENTRO de cada routerAdd que
// las usa — ver la nota equivalente en team_schedule.pb.js sobre por qué una función
// top-level de este archivo no se puede llamar de forma confiable desde el closure de
// un routerAdd distinto.

routerAdd("POST", "/api/liga/matches/propose", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const {
            windowBlockCodes,
            computeValidBlocks,
            fillDefaultHappiness,
            DEFAULT_HAPPINESS_LEVEL,
            suggestByeTeam,
            proposeMatches,
        } = require(`${__hooks}/lib/teamSchedule.js`);

        const body = e.requestInfo().body || {};
        const stageId = String(body.stageId || "");
        let teamIds = Array.isArray(body.teamIds) ? body.teamIds.map(String) : [];
        const byeTeamId = body.byeTeamId ? String(body.byeTeamId) : null;

        if (!stageId) throw new BadRequestError("Falta stageId.");
        if (teamIds.length < 2) throw new BadRequestError("Elige al menos 2 equipos.");

        let stage;
        try {
            stage = $app.findRecordById("league_stages", stageId);
        } catch (err) {
            throw new BadRequestError("La etapa indicada no existe.");
        }
        if (stage.getString("league") !== e.auth.id) {
            throw new BadRequestError("Esa etapa no pertenece a tu liga.");
        }

        const rosterRows = $app.findRecordsByFilter(
            "league_teams",
            "league = {:league}",
            "",
            0,
            0,
            { league: e.auth.id }
        );
        const rosterSet = new Set(rosterRows.map((r) => r.getString("team")));
        if (!teamIds.every((id) => rosterSet.has(id))) {
            throw new BadRequestError("Todos los equipos elegidos deben pertenecer a tu liga.");
        }

        function teamDisplay(teamId) {
            try {
                const team = $app.findRecordById("users", teamId);
                return team.getString("name") || team.getString("username") || teamId;
            } catch (err) {
                return teamId;
            }
        }

        function loadValidBlocks() {
            const blockedCodes = $app
                .findRecordsByFilter("horario_blocked_slots", "", "", 0, 0)
                .map((r) => r.getString("blockCode"));
            const occupiedCodes = $app
                .findRecordsByFilter("horario_matches", "status = 'confirmed'", "", 0, 0)
                .map((r) => r.getString("blockCode"))
                .concat(
                    $app
                        .findRecordsByFilter("league_matches", "status = 'confirmed' || status = 'played'", "", 0, 0)
                        .map((r) => r.getString("blockCode"))
                );
            return computeValidBlocks(windowBlockCodes(), [blockedCodes, occupiedCodes]);
        }

        function loadMatchInputs(ids, validBlocks) {
            const happinessByTeam = {};
            for (const teamId of ids) {
                let happiness = {};
                try {
                    const record = $app.findFirstRecordByFilter("horario_availability", "team = {:team}", { team: teamId });
                    happiness = JSON.parse(record.getString("happiness") || "{}");
                } catch (err) {
                    happiness = {};
                }
                happinessByTeam[teamId] = fillDefaultHappiness(happiness, validBlocks, DEFAULT_HAPPINESS_LEVEL);
            }
            return happinessByTeam;
        }

        const validBlocks = loadValidBlocks();
        const happinessByTeam = loadMatchInputs(teamIds, validBlocks);

        if (teamIds.length % 2 !== 0) {
            if (!byeTeamId) {
                const suggested = suggestByeTeam(teamIds, happinessByTeam);
                return e.json(200, {
                    needsBye: true,
                    suggestedByeTeamId: suggested,
                    candidates: teamIds.map((id) => ({ id, name: teamDisplay(id) })),
                });
            }
            teamIds = teamIds.filter((id) => id !== byeTeamId);
        }

        const result = proposeMatches(teamIds, happinessByTeam);
        if (result.infeasible) {
            return e.json(200, { infeasible: true, byeTeamId: byeTeamId || null });
        }

        const matches = result.matches.map((m) => ({
            ...m,
            teamAName: teamDisplay(m.teamA),
            teamBName: teamDisplay(m.teamB),
        }));

        return e.json(200, {
            infeasible: false,
            threshold: result.threshold,
            totalScore: result.totalScore,
            matches,
            byeTeamId: byeTeamId || null,
            byeTeamName: byeTeamId ? teamDisplay(byeTeamId) : null,
        });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/matches/propose:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo generar la propuesta." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/liga/matches/accept", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const { windowBlockCodes, computeValidBlocks } = require(`${__hooks}/lib/teamSchedule.js`);
        const { CODE_ALPHABET, CODE_LENGTH } = require(`${__hooks}/lib/matchEvents.js`);

        const body = e.requestInfo().body || {};
        const stageId = String(body.stageId || "");
        const teamA = String(body.teamA || "");
        const teamB = String(body.teamB || "");
        const block = String(body.block || "");
        const happinessA = Number.isFinite(body.happinessA) ? body.happinessA : null;
        const happinessB = Number.isFinite(body.happinessB) ? body.happinessB : null;
        const gap = Number.isFinite(body.gap) ? body.gap : null;

        if (!stageId || !teamA || !teamB || !block) {
            throw new BadRequestError("Faltan datos del partido.");
        }

        let stage;
        try {
            stage = $app.findRecordById("league_stages", stageId);
        } catch (err) {
            throw new BadRequestError("La etapa indicada no existe.");
        }
        if (stage.getString("league") !== e.auth.id) {
            throw new BadRequestError("Esa etapa no pertenece a tu liga.");
        }

        const rosterRows = $app.findRecordsByFilter(
            "league_teams",
            "league = {:league}",
            "",
            0,
            0,
            { league: e.auth.id }
        );
        const rosterSet = new Set(rosterRows.map((r) => r.getString("team")));
        if (!rosterSet.has(teamA) || !rosterSet.has(teamB)) {
            throw new BadRequestError("Ambos equipos deben pertenecer a tu liga.");
        }

        // Re-chequeo defensivo: el bloque pudo haberse ocupado (bloqueado por el admin,
        // o tomado por otro partido) entre que se generó la sugerencia y este click.
        const blockedCodes = $app
            .findRecordsByFilter("horario_blocked_slots", "", "", 0, 0)
            .map((r) => r.getString("blockCode"));
        const occupiedCodes = $app
            .findRecordsByFilter("horario_matches", "status = 'confirmed'", "", 0, 0)
            .map((r) => r.getString("blockCode"))
            .concat(
                $app
                    .findRecordsByFilter("league_matches", "status = 'confirmed' || status = 'played'", "", 0, 0)
                    .map((r) => r.getString("blockCode"))
            );
        const validBlocks = new Set(computeValidBlocks(windowBlockCodes(), [blockedCodes, occupiedCodes]));
        if (!validBlocks.has(block)) {
            throw new BadRequestError("Ese bloque ya no está disponible (se bloqueó o se ocupó con otro partido). Vuelve a generar la sugerencia.");
        }

        const coll = $app.findCollectionByNameOrId("league_matches");
        const record = new Record(coll);
        record.set("league", e.auth.id);
        record.set("stage", stageId);
        record.set("teamA", teamA);
        record.set("teamB", teamB);
        record.set("blockCode", block);
        if (happinessA !== null) record.set("happinessA", happinessA);
        if (happinessB !== null) record.set("happinessB", happinessB);
        if (gap !== null) record.set("gap", gap);
        record.set("status", "confirmed");
        // El código de arbitraje se genera acá, junto con el partido — hace falta desde
        // el primer intento de arbitrarlo, no solo para quien se suma después.
        record.set("code", $security.randomStringWithAlphabet(CODE_LENGTH, CODE_ALPHABET));
        $app.save(record);

        return e.json(200, { success: true, id: record.id });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/matches/accept:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo agregar el partido." });
    }
}, $apis.requireAuth("users"));
