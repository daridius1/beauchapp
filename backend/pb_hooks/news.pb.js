/// <reference path="../pb_data/types.d.ts" />

// ---------------------------------------------------------------------------------
// Noticias generadas con IA sobre partidos de liga — panel de administración para
// cuentas de organización subtype=media (ej. "Beauchef Deportes"), mismo criterio de
// autenticación que /admin/liga (la propia cuenta, no un superusuario).
//
// Las lecturas (partidos, declaraciones, informe arbitral, comentarios, noticias
// propias) las hace el navegador directo contra la API estándar de colecciones —
// las reglas de match_statements/news ya dejan pasar a subtype=media (ver las
// migraciones create_match_statements.js/create_news.js). Acá solo viven los
// endpoints que necesitan `$app`/`$http`: generar con DeepSeek, guardar/publicar y
// descartar (news tiene create/update/delete en null a propósito, igual que
// league_matches).
// ---------------------------------------------------------------------------------

routerAdd("GET", "/admin/noticias", (e) => {
    const { PALETTE_CSS, clientEscapeHtmlFn, clientSessionGateFn, clientApiCallFn } = require(`${__hooks}/lib/adminUi.js`);
    const { VENUE_LABELS } = require(`${__hooks}/lib/newsGen.js`);
    const ESCAPE_HTML_FN = clientEscapeHtmlFn();
    const SESSION_GATE_FN = clientSessionGateFn();
    const API_CALL_FN = clientApiCallFn("noticias_auth");
    const VENUE_OPTIONS_HTML = Object.keys(VENUE_LABELS)
        .map((key) => `<option value="${key}">${VENUE_LABELS[key]}</option>`)
        .join("");

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generar Noticias</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        ${PALETTE_CSS}
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            min-height: 100vh;
            padding: 24px;
        }
        .page { max-width: 720px; margin: 0 auto; }
        .container {
            width: 100%; max-width: 420px; margin: 60px auto;
            background: var(--card-bg); border: 1px solid var(--border-color);
            border-radius: 20px; padding: 36px; text-align: center;
        }
        h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
        h2 { font-size: 15px; font-weight: 700; margin: 20px 0 12px; }
        .subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }
        .card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
        .form-group { text-align: left; margin-bottom: 14px; }
        label { display: block; font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
        input[type="email"], input[type="password"], input[type="text"], textarea {
            width: 100%; background: rgba(15,23,42,0.6); border: 1px solid var(--border-color);
            border-radius: 10px; padding: 10px 14px; color: var(--text-color); font-size: 14px; outline: none;
            font-family: inherit;
        }
        textarea { resize: vertical; }
        input:focus, textarea:focus { border-color: var(--primary-color); }
        .btn {
            background: var(--primary-color); color: #0f172a; border: none; border-radius: 10px;
            padding: 10px 18px; font-size: 14px; font-weight: 700; cursor: pointer;
        }
        .btn:hover { background: var(--primary-hover); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: rgba(255,255,255,0.05); color: var(--text-color); border: 1px solid var(--border-color); }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }
        .btn-danger { background: var(--danger-color); color: #fff; }
        .btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
        .alert { padding: 12px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 16px; text-align: left; display: none; }
        .alert-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
        #logoutBar { text-align: right; margin-bottom: 16px; }
        .match-row {
            display: flex; justify-content: space-between; align-items: center; padding: 10px 0;
            border-bottom: 1px solid var(--border-color); font-size: 13px; cursor: pointer; text-align: left;
            background: none; border-left: none; border-right: none; border-top: none; color: var(--text-color); width: 100%;
        }
        .match-row:hover { color: var(--primary-color); }
        .match-row .tag { font-size: 11px; color: var(--text-muted); font-weight: 400; }
        .source-block { border-bottom: 1px solid var(--border-color); padding: 10px 0; }
        .source-block:last-child { border-bottom: none; }
        .source-block.empty { opacity: 0.45; }
        .source-row { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
        .source-row .count { font-size: 11px; color: var(--text-muted); margin-left: auto; }
        .source-body {
            font-size: 12px; color: var(--text-muted); line-height: 1.6; white-space: pre-wrap;
            margin-top: 6px; margin-left: 24px; max-height: 220px; overflow-y: auto;
        }
        .match-header { font-size: 16px; font-weight: 700; margin: 14px 0; }
        .news-row {
            display: flex; justify-content: space-between; align-items: center; padding: 10px 0;
            border-bottom: 1px solid var(--border-color); font-size: 13px; cursor: pointer; text-align: left;
            background: none; border-left: none; border-right: none; border-top: none; color: var(--text-color); width: 100%;
        }
        .news-row:hover { color: var(--primary-color); }
        .status-badge {
            font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
            padding: 2px 8px; border-radius: 6px; flex-shrink: 0;
        }
        .status-draft { background: rgba(148,163,184,0.15); color: var(--text-muted); }
        .status-published { background: rgba(34,197,94,0.15); color: var(--success-color); }
        .hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
    </style>
</head>
<body>
    <div class="page">
        <div id="checkingMsg" style="text-align:center; padding: 60px 0; color: var(--text-muted);">Verificando sesión...</div>

        <div id="loginPage" class="container" style="display:none;">
            <h1>Beauchef Deportes</h1>
            <p class="subtitle">Panel de noticias — solo cuentas de medio (subtype=media).</p>
            <div id="loginError" class="alert alert-danger"></div>
            <form id="loginForm">
                <div class="form-group">
                    <label>Usuario o email</label>
                    <input type="text" id="loginIdentity" required>
                </div>
                <div class="form-group">
                    <label>Contraseña</label>
                    <input type="password" id="loginPassword" required>
                </div>
                <button type="submit" class="btn" style="width:100%;">Ingresar</button>
            </form>
        </div>

        <div id="panelPage" style="display:none;">
            <div id="logoutBar"><button class="btn btn-secondary" id="logoutBtn">Cerrar sesión</button></div>
            <h1 id="orgName">Noticias</h1>
            <div id="panelError" class="alert alert-danger"></div>

            <div id="homeView">
                <div class="card">
                    <h2>Partidos jugados recientes</h2>
                    <div id="matchesList"><p class="hint">Cargando...</p></div>
                </div>
                <div class="card">
                    <h2>Mis noticias</h2>
                    <div id="myNewsList"><p class="hint">Cargando...</p></div>
                </div>
            </div>

            <div id="composeView" style="display:none;">
                <button class="btn btn-secondary" id="backToHomeBtn">&larr; Volver a partidos</button>
                <div class="match-header" id="composeMatchTitle"></div>
                <div id="composeError" class="alert alert-danger"></div>

                <div class="card">
                    <h2>Fuentes de datos</h2>
                    <p class="hint">Cada categoría muestra su contenido real. El checkbox decide si se manda a la IA.</p>
                    <div id="sourcesSections"><p class="hint">Cargando...</p></div>
                </div>

                <div class="card">
                    <h2>Cancha donde se jugó</h2>
                    <select id="venueSelect">
                        <option value="">Sin especificar</option>
                        ${VENUE_OPTIONS_HTML}
                    </select>
                </div>

                <div class="card">
                    <h2>Contexto adicional (opcional)</h2>
                    <p class="hint">Cualquier cosa que quieras que la IA sepa, en tus palabras — ella se encarga del resto.</p>
                    <textarea id="editorContextInput" rows="4" maxlength="3000" placeholder="Ej: es el regreso de un jugador lesionado, hubo un incidente después del partido..."></textarea>
                    <p class="hint" id="editorContextCounter">0 / 3000</p>
                </div>

                <div class="card">
                    <h2>Instrucciones para la IA (tono, estilo)</h2>
                    <p class="hint">Se agregan a las reglas fijas del redactor (privacidad, formato) — nunca las reemplazan. Quedan guardadas para la próxima vez.</p>
                    <textarea id="instructionsInput" rows="4" maxlength="2000" placeholder="Ej: tono más informal, menos tecnicismos, siempre mencionar al árbitro..."></textarea>
                    <p class="hint" id="instructionsCounter">0 / 2000</p>
                    <button class="btn btn-secondary" id="saveInstructionsBtn">Guardar instrucciones</button>
                    <p class="hint" id="instructionsSavedHint"></p>
                </div>

                <div class="card">
                    <button class="btn" id="generateBtn" style="width:100%;">Generar con IA</button>
                    <p class="hint" id="generateHint"></p>
                </div>

                <div class="card" id="editorCard" style="display:none;">
                    <h2>Editar noticia</h2>
                    <div class="form-group">
                        <label>Título</label>
                        <input type="text" id="editTitle">
                    </div>
                    <div class="form-group">
                        <label>Bajada</label>
                        <input type="text" id="editSubtitle">
                    </div>
                    <div class="form-group">
                        <label>Cuerpo</label>
                        <textarea id="editBody" rows="12"></textarea>
                    </div>
                    <div class="btn-row">
                        <button class="btn btn-secondary" id="saveDraftBtn">Guardar borrador</button>
                        <button class="btn" id="publishBtn">Publicar</button>
                        <button class="btn btn-danger" id="discardBtn">Descartar</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let token = "";
        let myId = "";
        let myRecord = null;
        let selectedMatch = null;
        let currentNewsId = null;

        const checkingMsg = document.getElementById("checkingMsg");
        const loginPage = document.getElementById("loginPage");
        const panelPage = document.getElementById("panelPage");
        const loginForm = document.getElementById("loginForm");
        const loginError = document.getElementById("loginError");
        const panelError = document.getElementById("panelError");
        const composeError = document.getElementById("composeError");
        const homeView = document.getElementById("homeView");
        const composeView = document.getElementById("composeView");

        function showError(el, msg) { el.textContent = msg; el.style.display = "block"; }
        function hideError(el) { el.style.display = "none"; }

        function showPanel(name) {
            checkingMsg.style.display = "none";
            loginPage.style.display = "none";
            panelPage.style.display = "block";
            document.getElementById("orgName").textContent = name || "Noticias";
            hideError(panelError);
            showHome();
        }
        function showLogin(hadStaleSession) {
            checkingMsg.style.display = "none";
            loginPage.style.display = "block";
            panelPage.style.display = "none";
            if (hadStaleSession) showError(loginError, "Tu sesión expiró. Inicia sesión de nuevo.");
        }

        // Dos "vistas" del panel autenticado: la lista de partidos/noticias, y el
        // compositor de una noticia puntual — nunca las dos a la vez, en vez de ir
        // revelando secciones en la misma pantalla larga.
        function showHome() {
            homeView.style.display = "block";
            composeView.style.display = "none";
            selectedMatch = null;
            currentNewsId = null;
            loadMatches();
            loadMyNews();
        }
        function showCompose() {
            homeView.style.display = "none";
            composeView.style.display = "block";
        }
        document.getElementById("backToHomeBtn").addEventListener("click", showHome);

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
                if (data.record.type !== "organization" || data.record.subtype !== "media") {
                    throw new Error("Esta cuenta no es un medio de noticias.");
                }
                token = data.token;
                myRecord = data.record;
                localStorage.setItem("noticias_auth", JSON.stringify({ token, model: data.record }));
                showPanel(data.record.name);
            } catch (err) { showError(loginError, err.message); }
        });

        document.getElementById("logoutBtn").addEventListener("click", () => {
            token = ""; localStorage.removeItem("noticias_auth"); showLogin();
        });

${ESCAPE_HTML_FN}
${SESSION_GATE_FN}
${API_CALL_FN}

        // --- Colecciones vía API estándar (las reglas ya dejan pasar a subtype=media) ---
        async function pbList(collection, params) {
            const qs = new URLSearchParams(params).toString();
            const res = await fetch("/api/collections/" + collection + "/records?" + qs, {
                headers: { "Authorization": "Bearer " + token }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error cargando " + collection);
            return data.items || [];
        }
        async function pbGetOne(collection, id, expand) {
            const qs = expand ? ("?expand=" + encodeURIComponent(expand)) : "";
            const res = await fetch("/api/collections/" + collection + "/records/" + id + qs, {
                headers: { "Authorization": "Bearer " + token }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error cargando " + collection);
            return data;
        }

        function teamLabel(team) { return (team && (team.name || team.username)) || "?"; }

        async function loadMatches() {
            const list = document.getElementById("matchesList");
            list.innerHTML = '<p class="hint">Cargando...</p>';
            try {
                const matches = await pbList("league_matches", {
                    filter: 'status = "played" && deleted = false',
                    sort: "-created", perPage: "30",
                    expand: "teamA,teamB,stage,league",
                });
                if (matches.length === 0) {
                    list.innerHTML = '<p class="hint">Todavía no hay partidos jugados.</p>';
                    return;
                }
                list.innerHTML = "";
                matches.forEach((m) => {
                    const teamA = m.expand && m.expand.teamA;
                    const teamB = m.expand && m.expand.teamB;
                    const btn = document.createElement("button");
                    btn.className = "match-row";
                    btn.innerHTML = esc(teamLabel(teamA)) + " " + m.scoreA + " - " + m.scoreB + " " + esc(teamLabel(teamB))
                        + ' <span class="tag">' + esc((m.expand && m.expand.league && teamLabel(m.expand.league)) || "") + "</span>";
                    btn.addEventListener("click", () => enterCompose(m, null));
                    list.appendChild(btn);
                });
            } catch (err) {
                list.innerHTML = "";
                showError(panelError, err.message);
            }
        }

        async function loadMyNews() {
            const list = document.getElementById("myNewsList");
            list.innerHTML = '<p class="hint">Cargando...</p>';
            try {
                const items = await pbList("news", { filter: 'author = "' + myId + '" && deleted = false', sort: "-created", perPage: "30" });
                if (items.length === 0) {
                    list.innerHTML = '<p class="hint">Todavía no hay noticias.</p>';
                    return;
                }
                list.innerHTML = "";
                items.forEach((n) => {
                    const btn = document.createElement("button");
                    btn.className = "news-row";
                    btn.innerHTML = "<span>" + esc(n.title) + "</span>"
                        + '<span class="status-badge status-' + n.status + '">' + (n.status === "published" ? "Publicada" : "Borrador") + "</span>";
                    btn.addEventListener("click", () => openExistingNews(n));
                    list.appendChild(btn);
                });
            } catch (err) {
                list.innerHTML = "";
                showError(panelError, err.message);
            }
        }

        async function openExistingNews(newsItem) {
            hideError(panelError);
            if (!newsItem.relatedMatch) {
                showError(panelError, "Esta noticia no tiene un partido asociado.");
                return;
            }
            try {
                const match = await pbGetOne("league_matches", newsItem.relatedMatch, "teamA,teamB,stage,league");
                enterCompose(match, newsItem);
            } catch (err) {
                showError(panelError, err.message);
            }
        }

        const SOURCE_KEYS_CLIENT = ["matchInfo", "leagueContext", "statements", "refereeReport", "comments", "weather"];
        const SOURCE_LABELS_FALLBACK = {
            matchInfo: "Información del partido",
            leagueContext: "Contexto de la liga",
            statements: "Declaraciones",
            refereeReport: "Informe arbitral",
            comments: "Comentarios del partido",
            weather: "Clima ese día (Beauchef)",
        };

        function updateCounter(inputId, counterId, max) {
            const value = document.getElementById(inputId).value || "";
            document.getElementById(counterId).textContent = value.length + " / " + max;
        }
        document.getElementById("editorContextInput").addEventListener("input", () => updateCounter("editorContextInput", "editorContextCounter", 3000));
        document.getElementById("instructionsInput").addEventListener("input", () => updateCounter("instructionsInput", "instructionsCounter", 2000));

        async function enterCompose(match, existingNews) {
            selectedMatch = match;
            currentNewsId = existingNews ? existingNews.id : null;
            showCompose();
            hideError(composeError);

            const teamA = match.expand && match.expand.teamA;
            const teamB = match.expand && match.expand.teamB;
            document.getElementById("composeMatchTitle").textContent =
                teamLabel(teamA) + " " + match.scoreA + " - " + match.scoreB + " " + teamLabel(teamB);

            document.getElementById("venueSelect").value = (existingNews && existingNews.venue) || "";
            document.getElementById("editorContextInput").value = (existingNews && existingNews.editorContext) || "";
            updateCounter("editorContextInput", "editorContextCounter", 3000);
            document.getElementById("instructionsInput").value = (myRecord && myRecord.newsInstructions) || "";
            updateCounter("instructionsInput", "instructionsCounter", 2000);
            document.getElementById("instructionsSavedHint").textContent = "";
            document.getElementById("generateHint").textContent = "";

            if (existingNews) {
                openEditor(existingNews);
            } else {
                document.getElementById("editorCard").style.display = "none";
            }

            const sourcesList = document.getElementById("sourcesSections");
            sourcesList.innerHTML = '<p class="hint">Cargando...</p>';
            try {
                const result = await apiCall("/api/news/generate", "POST", { matchId: match.id, sources: [], preview: true });
                renderSources(result.sections, result.counts, existingNews && existingNews.sourcesUsed);
            } catch (err) {
                sourcesList.innerHTML = "";
                showError(composeError, err.message);
            }
        }

        function renderSources(sections, counts, presetSources) {
            const list = document.getElementById("sourcesSections");
            list.innerHTML = "";
            SOURCE_KEYS_CLIENT.forEach((key) => {
                const sec = sections[key];
                const count = (counts && counts[key]) || 0;
                const block = document.createElement("div");
                block.className = "source-block" + (count === 0 ? " empty" : "");

                const row = document.createElement("label");
                row.className = "source-row";
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.value = key;
                checkbox.checked = presetSources ? presetSources.indexOf(key) !== -1 : count > 0;
                checkbox.disabled = count === 0;
                row.appendChild(checkbox);
                const strong = document.createElement("strong");
                strong.textContent = " " + ((sec && sec.title) || SOURCE_LABELS_FALLBACK[key]);
                row.appendChild(strong);
                const countSpan = document.createElement("span");
                countSpan.className = "count";
                countSpan.textContent = count;
                row.appendChild(countSpan);
                block.appendChild(row);

                const body = document.createElement("div");
                body.className = "source-body";
                body.textContent = sec ? sec.body : "Sin datos disponibles.";
                block.appendChild(body);

                list.appendChild(block);
            });
        }

        document.getElementById("saveInstructionsBtn").addEventListener("click", async () => {
            const text = document.getElementById("instructionsInput").value.slice(0, 2000);
            const hint = document.getElementById("instructionsSavedHint");
            hint.textContent = "";
            hideError(composeError);
            try {
                const res = await fetch("/api/collections/users/records/" + myId, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                    body: JSON.stringify({ newsInstructions: text }),
                });
                const updated = await res.json();
                if (!res.ok) throw new Error(updated.message || "No se pudieron guardar las instrucciones.");
                myRecord = updated;
                const stored = JSON.parse(localStorage.getItem("noticias_auth") || "{}");
                stored.model = updated;
                localStorage.setItem("noticias_auth", JSON.stringify(stored));
                hint.textContent = "Instrucciones guardadas.";
            } catch (err) {
                showError(composeError, err.message);
            }
        });

        document.getElementById("generateBtn").addEventListener("click", async () => {
            if (!selectedMatch) return;
            const checked = Array.from(document.querySelectorAll("#sourcesSections input[type=checkbox]:checked")).map((i) => i.value);
            const btn = document.getElementById("generateBtn");
            const hint = document.getElementById("generateHint");
            btn.disabled = true;
            hint.textContent = "Generando con IA, puede tardar unos segundos...";
            hideError(composeError);
            try {
                const venue = document.getElementById("venueSelect").value;
                const editorContext = document.getElementById("editorContextInput").value;
                const draft = await apiCall("/api/news/generate", "POST", {
                    matchId: selectedMatch.id, sources: checked, venue: venue, editorContext: editorContext,
                });
                openEditor(draft);
                hint.textContent = "";
                loadMyNews();
            } catch (err) {
                hint.textContent = "";
                showError(composeError, err.message);
            } finally {
                btn.disabled = false;
            }
        });

        function openEditor(news) {
            currentNewsId = news.id;
            document.getElementById("editTitle").value = news.title || "";
            document.getElementById("editSubtitle").value = news.subtitle || "";
            document.getElementById("editBody").value = news.body || "";
            document.getElementById("editorCard").style.display = "block";
            document.getElementById("editorCard").scrollIntoView({ behavior: "smooth" });
        }

        document.getElementById("saveDraftBtn").addEventListener("click", () => saveNews(false));
        document.getElementById("publishBtn").addEventListener("click", () => saveNews(true));

        async function saveNews(publish) {
            if (!currentNewsId) return;
            hideError(composeError);
            try {
                await apiCall("/api/news/save", "POST", {
                    newsId: currentNewsId,
                    title: document.getElementById("editTitle").value,
                    subtitle: document.getElementById("editSubtitle").value,
                    body: document.getElementById("editBody").value,
                    publish: !!publish,
                });
                loadMyNews();
            } catch (err) { showError(composeError, err.message); }
        }

        document.getElementById("discardBtn").addEventListener("click", async () => {
            if (!currentNewsId) return;
            if (!confirm("¿Descartar esta noticia? No se puede deshacer.")) return;
            hideError(composeError);
            try {
                await apiCall("/api/news/discard", "POST", { newsId: currentNewsId });
                showHome();
            } catch (err) { showError(composeError, err.message); }
        });

        gateSession("users", "noticias_auth", (freshToken, record) => {
            token = freshToken;
            myId = record && record.id;
            myRecord = record;
            showPanel(record && record.name);
        }, (hadStaleSession) => showLogin(hadStaleSession));
    </script>
</body>
</html>
    `;
    return e.html(200, htmlContent);
});

// El chequeo "es una cuenta subtype=media" se repite inline en cada endpoint (en vez
// de una función compartida a nivel de módulo) a propósito: cada routerAdd corre en su
// propia VM Goja aislada y no ve nada declarado fuera del handler — mismo motivo por
// el que /admin/liga repite su chequeo de subtype=league en cada ruta en vez de
// factorizarlo (ver la nota grande sobre esto en match_arbitration.pb.js).

routerAdd("POST", "/api/news/generate", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "media") {
            throw new BadRequestError("Esta cuenta no es un medio de noticias.");
        }
        const { normalizeSelectedSources, VENUE_LABELS, buildContextSections, buildContext, buildPrompt, parseAiResponse } = require(`${__hooks}/lib/newsGen.js`);

        const data = e.requestInfo().body || {};
        const matchId = data.matchId;
        if (!matchId) throw new BadRequestError("Falta matchId.");

        const sources = normalizeSelectedSources(data.sources);

        // Cancha: lista cerrada (VENUE_LABELS), cualquier otro valor se ignora en vez de
        // rechazar la generación entera por esto.
        const venue = data.venue && VENUE_LABELS[data.venue] ? data.venue : "";

        // Contexto libre que escribió quien genera la noticia — se manda tal cual (no
        // pasa por ninguna síntesis de privacidad, es contenido del propio editor, no de
        // un tercero) y se guarda en la noticia para que quede trazable.
        const editorContext = String(data.editorContext || "").trim().slice(0, 3000);

        // `preview: true` arma y devuelve el contenido de CADA fuente por separado (el
        // mismo texto que recibiría DeepSeek, pero sin filtrar por `sources` — el panel
        // muestra todas las categorías con contenido real apenas se elige un partido, no
        // detrás de un botón aparte) sin llamar a la IA ni gastar cupo.
        const isPreview = !!data.preview;
        if (!isPreview && sources.length === 0) {
            throw new BadRequestError("Selecciona al menos una fuente de datos.");
        }

        let apiKey = "";
        if (!isPreview) {
            apiKey = $os.getenv("DEEPSEEK_API_KEY");
            if (!apiKey) throw new BadRequestError("DEEPSEEK_API_KEY no está configurada en este servidor.");

            // Tope defensivo contra abuso de la API key — mismo criterio que el límite de
            // respuestas de BeauRok (mentions.pb.js), pero bajo, porque esto es una acción
            // manual de panel, no una reacción automática a cada mención. No aplica a
            // previews: no llaman a DeepSeek, no cuestan nada.
            const DAILY_GENERATE_CAP = 30;
            const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const recentCount = $app.findRecordsByFilter(
                "news", "author = {:a} && created >= {:d}", "", 0, 0, { a: e.auth.id, d: since24h }
            ).length;
            if (recentCount >= DAILY_GENERATE_CAP) {
                throw new BadRequestError("Se alcanzó el máximo de generaciones por hoy. Vuelve a intentar más tarde.");
            }
        }

        const match = $app.findRecordById("league_matches", matchId);
        if (match.getBool("deleted")) throw new BadRequestError("Ese partido ya no existe.");

        const teamAId = match.getString("teamA");
        const teamBId = match.getString("teamB");
        const blockCode = match.getString("blockCode");
        let teamAName = "Equipo A", teamBName = "Equipo B";
        try { teamAName = $app.findRecordById("users", teamAId).getString("name") || teamAName; } catch (err) {}
        try { teamBName = $app.findRecordById("users", teamBId).getString("name") || teamBName; } catch (err) {}

        let leagueName = "", stageName = "";
        try { leagueName = $app.findRecordById("users", match.getString("league")).getString("name") || ""; } catch (err) {}
        try { stageName = $app.findRecordById("league_stages", match.getString("stage")).getString("name") || ""; } catch (err) {}

        // "26 de julio de 2026" — solo para dar contexto a la IA, no necesita día de la
        // semana (a diferencia del formateo que usa la app para mostrarlo en pantalla).
        const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        function formatDateLabel(code) {
            if (!code || code.length < 13) return "";
            const parts = code.slice(0, -3).split("-");
            const y = parts[0], m = parseInt(parts[1], 10), d = parseInt(parts[2], 10);
            if (!y || !m || !d) return "";
            return d + " de " + MONTH_NAMES[m - 1] + " de " + y;
        }

        // El informe se busca una sola vez (barato) porque tanto "declaraciones" (para
        // saber si el autor fue convocado a ESTE partido) como "informe arbitral" lo
        // necesitan — evita pedirlo dos veces cuando ambas fuentes están tildadas.
        let reportRecord = null;
        try {
            reportRecord = $app.findFirstRecordByFilter("match_reports", "match = {:m} && deleted = false && status = 'approved'", { m: matchId });
        } catch (err) {
            try {
                reportRecord = $app.findFirstRecordByFilter("match_reports", "match = {:m} && deleted = false && status = 'submitted'", { m: matchId });
            } catch (err2) {}
        }
        let reportEvents = [];
        let reportSummary = null;
        if (reportRecord) {
            reportEvents = JSON.parse(reportRecord.getString("events") || "[]");
            try {
                const { summarizeEvents } = require(`${__hooks}/lib/matchEvents.js`);
                reportSummary = summarizeEvents(reportEvents);
            } catch (err) {}
        }

        // Declaraciones — cada una se marca "jugador de <equipo>" si su autor aparece en
        // el roster (team_players) de alguno de los dos equipos, "espectador" si no; y si
        // fue CONVOCADO a este partido en particular, cuando el informe registró
        // convocatoria (lineup) — muchos informes viejos no lo hicieron, ahí queda sin
        // determinar (null) en vez de asumir que no jugó. El nombre real del autor solo
        // se resuelve si la propia persona marcó `wantsMention` al declarar — si no,
        // nunca se le busca el nombre, ni siquiera para guardarlo en memoria de más.
        let statementsData = [];
        {
            const rawStatements = $app.findRecordsByFilter(
                "match_statements", "match = {:m} && deleted = false", "+created", 0, 0, { m: matchId }
            );
            const rosterA = $app.findRecordsByFilter("team_players", "team = {:t} && deleted = false && user != ''", "", 0, 0, { t: teamAId });
            const rosterB = $app.findRecordsByFilter("team_players", "team = {:t} && deleted = false && user != ''", "", 0, 0, { t: teamBId });
            const infoByUserA = {}; rosterA.forEach((p) => { infoByUserA[p.getString("user")] = { name: p.getString("name"), role: p.getString("role") }; });
            const infoByUserB = {}; rosterB.forEach((p) => { infoByUserB[p.getString("user")] = { name: p.getString("name"), role: p.getString("role") }; });
            const lineupNamesA = reportSummary && reportSummary.lineupA.length > 0 ? new Set(reportSummary.lineupA.map((p) => p.name)) : null;
            const lineupNamesB = reportSummary && reportSummary.lineupB.length > 0 ? new Set(reportSummary.lineupB.map((p) => p.name)) : null;

            statementsData = rawStatements.map((s) => {
                const authorId = s.getString("author");
                let role = "espectador";
                let calledUp = null;
                if (infoByUserA[authorId]) {
                    const info = infoByUserA[authorId];
                    role = (info.role === "coach" ? "DT de " : "jugador de ") + teamAName;
                    if (info.role !== "coach" && lineupNamesA) calledUp = lineupNamesA.has(info.name);
                } else if (infoByUserB[authorId]) {
                    const info = infoByUserB[authorId];
                    role = (info.role === "coach" ? "DT de " : "jugador de ") + teamBName;
                    if (info.role !== "coach" && lineupNamesB) calledUp = lineupNamesB.has(info.name);
                }

                const wantsMention = s.getBool("wantsMention");
                let authorName = null;
                if (wantsMention) {
                    try { authorName = $app.findRecordById("users", authorId).getString("name") || null; } catch (err) {}
                }

                return { content: s.getString("content"), role, calledUp, wantsMention, authorName };
            });
        }

        let reportData = null;
        if (reportRecord) {
            reportData = { notes: reportRecord.getString("notes"), events: reportEvents };

            // Convocados/no convocados por equipo: la convocatoria real (lineup) sale de
            // la propia bitácora del informe; "no convocados" es el resto del roster que
            // no aparece ahí. Comparado por nombre (la convocatoria vieja no siempre trae
            // playerId, ver matchEvents.js). Un lineup vacío NO significa "nadie fue
            // convocado": significa que ese informe no registró convocatoria, y hay que
            // omitir la sección en vez de mostrar a todo el plantel (goleadores incluidos)
            // como ausente.
            try {
                // role = 'player' — un DT no aparece nunca en "no convocados", solo
                // jugadores del plantel pueden serlo.
                if (reportSummary && reportSummary.lineupA.length > 0) {
                    const rosterA = $app.findRecordsByFilter("team_players", "team = {:t} && deleted = false && role = 'player'", "", 0, 0, { t: teamAId });
                    const lineupNamesA = new Set(reportSummary.lineupA.map((p) => p.name));
                    reportData.calledUpA = reportSummary.lineupA.map((p) => p.name);
                    reportData.notCalledA = rosterA.map((p) => p.getString("name")).filter((n) => !lineupNamesA.has(n));
                }
                if (reportSummary && reportSummary.lineupB.length > 0) {
                    const rosterB = $app.findRecordsByFilter("team_players", "team = {:t} && deleted = false && role = 'player'", "", 0, 0, { t: teamBId });
                    const lineupNamesB = new Set(reportSummary.lineupB.map((p) => p.name));
                    reportData.calledUpB = reportSummary.lineupB.map((p) => p.name);
                    reportData.notCalledB = rosterB.map((p) => p.getString("name")).filter((n) => !lineupNamesB.has(n));
                }
            } catch (err) {
                console.error("[news.pb.js] Error armando convocatoria:", err);
            }
        }

        // Contexto de la liga: tabla de posiciones de la ETAPA (mezclar puntos entre fase
        // de grupos y llave de eliminación no tendría sentido), racha reciente de cada
        // equipo dentro de toda la liga, y la tabla de goleadores del campeonato completo
        // — con quién de este partido aparece ahí, si aplica. Todo derivado de datos que
        // ya existen (ningún contador nuevo que mantener), igual que el resto de la app.
        let standingsData = [], formAData = null, formBData = null, topScorersData = [], rosterAData = null, rosterBData = null;
        {
            try {
                const leagueId = match.getString("league");
                const stageId = match.getString("stage");
                const leagueMatchRecords = $app.findRecordsByFilter(
                    "league_matches", "league = {:l} && deleted = false", "", 0, 0, { l: leagueId }
                );
                const plainMatches = leagueMatchRecords.map((m) => ({
                    teamA: m.getString("teamA"), teamB: m.getString("teamB"),
                    scoreA: m.getInt("scoreA"), scoreB: m.getInt("scoreB"),
                    status: m.getString("status"), blockCode: m.getString("blockCode"),
                    stage: m.getString("stage"),
                }));
                const stageMatches = plainMatches.filter((m) => m.stage === stageId);

                const { computeStandings, previousResult } = require(`${__hooks}/lib/leagueStandings.js`);

                let stageTeamIds = [teamAId, teamBId];
                try {
                    const stageTeams = ($app.findRecordById("league_stages", stageId).get("teams") || []).map(String);
                    if (stageTeams.length > 0) stageTeamIds = stageTeams;
                } catch (err) {}

                const teamNameCache = {};
                teamNameCache[teamAId] = teamAName;
                teamNameCache[teamBId] = teamBName;
                function teamNameOf(id) {
                    if (!teamNameCache[id]) {
                        try { teamNameCache[id] = $app.findRecordById("users", id).getString("name") || id; }
                        catch (err) { teamNameCache[id] = id; }
                    }
                    return teamNameCache[id];
                }

                standingsData = computeStandings(stageTeamIds, stageMatches)
                    .map((row) => Object.assign({}, row, { teamName: teamNameOf(row.teamId) }));

                const rawFormA = previousResult(teamAId, plainMatches, blockCode);
                const rawFormB = previousResult(teamBId, plainMatches, blockCode);
                if (rawFormA) formAData = Object.assign({}, rawFormA, { opponentName: teamNameOf(rawFormA.opponentId) });
                if (rawFormB) formBData = Object.assign({}, rawFormB, { opponentName: teamNameOf(rawFormB.opponentId) });

                // Una sola consulta vía traversal de relación (match.league) en vez de N
                // consultas por partido de la liga (PRINCIPLES.md §1).
                const { computeTopScorers } = require(`${__hooks}/lib/matchEvents.js`);
                const leagueReports = $app.findRecordsByFilter(
                    "match_reports",
                    "match.league = {:l} && match.deleted = false && deleted = false && status = 'approved'",
                    "", 0, 0, { l: leagueId }
                );
                const matchEntries = leagueReports.map((r) => {
                    let entryTeamA = "", entryTeamB = "";
                    try {
                        const relatedMatch = $app.findRecordById("league_matches", r.getString("match"));
                        entryTeamA = relatedMatch.getString("teamA");
                        entryTeamB = relatedMatch.getString("teamB");
                    } catch (err) {}
                    return { events: JSON.parse(r.getString("events") || "[]"), teamAId: entryTeamA, teamBId: entryTeamB };
                });

                const thisMatchPlayerIds = new Set();
                const thisMatchPlayerNames = new Set();
                if (reportData && Array.isArray(reportData.events)) {
                    reportData.events.forEach((ev) => {
                        if ((ev.type === "goal" || ev.type === "penalty") && ev.player) thisMatchPlayerNames.add(ev.player);
                        if ((ev.type === "goal" || ev.type === "penalty") && ev.playerId) thisMatchPlayerIds.add(ev.playerId);
                    });
                }

                const allScorers = computeTopScorers(matchEntries);
                topScorersData = allScorers.slice(0, 8).map((s) => ({
                    name: s.name,
                    teamName: s.teamId ? teamNameOf(s.teamId) : "",
                    goals: s.goals,
                    inThisMatch: (s.playerId && thisMatchPlayerIds.has(s.playerId)) || thisMatchPlayerNames.has(s.name),
                }));

                // Plantel completo (no solo el top 8 de goleadores) con los goles de
                // temporada de cada jugador, más el DT — el "top 8" de arriba es del
                // campeonato entero, esto es cada equipo mirando adentro suyo.
                const goalsByPlayerId = {};
                allScorers.forEach((s) => { if (s.playerId) goalsByPlayerId[s.playerId] = s.goals; });
                function buildRosterData(teamIdForRoster) {
                    const rosterRecords = $app.findRecordsByFilter("team_players", "team = {:t} && deleted = false", "name", 0, 0, { t: teamIdForRoster });
                    const playerRows = rosterRecords.filter((p) => p.getString("role") !== "coach");
                    // El cuerpo técnico admite cualquier cantidad de personas; el DT es
                    // quien tenga isDT=true (único por equipo, lo hace cumplir
                    // team_players.pb.js) — no "el primer coach que aparezca".
                    const dtRow = rosterRecords.find((p) => p.getString("role") === "coach" && p.getBool("isDT")) || null;
                    return {
                        dtName: dtRow ? dtRow.getString("name") : "",
                        players: playerRows.map((p) => ({
                            name: p.getString("name"),
                            goals: goalsByPlayerId[p.id] || 0,
                            isCaptain: p.getBool("isCaptain"),
                        })),
                    };
                }
                rosterAData = buildRosterData(teamAId);
                rosterBData = buildRosterData(teamBId);
            } catch (err) {
                console.error("[news.pb.js] Error armando contexto de liga:", err);
            }
        }

        let commentsData = [];
        {
            const rawComments = $app.findRecordsByFilter(
                "posts",
                "targetType = 'league_match' && targetId = {:id} && actionType = 'comment' && deleted = false",
                "+created", 50, 0, { id: matchId }
            );
            commentsData = rawComments.map((c) => {
                let authorName = "Alguien";
                try { authorName = $app.findRecordById("users", c.getString("author")).getString("name") || authorName; } catch (err) {}
                return { authorName, content: c.getString("content") };
            });
        }

        // Clima del campus Beauchef ese día — cacheado por fecha en weather_daily (todos
        // los partidos se juegan en el mismo lugar), nunca se confía en nada que mande el
        // cliente. Es un dato "nice to have": si Open-Meteo no responde o no cubre esa
        // fecha todavía, se omite la sección en vez de fallar la generación completa.
        let weatherData = null;
        {
            const { dateFromBlockCode, buildOpenMeteoUrl, parseOpenMeteoDaily, buildWeatherSummary } = require(`${__hooks}/lib/weather.js`);
            const weatherDate = dateFromBlockCode(match.getString("blockCode"));
            if (weatherDate) {
                try {
                    let cachedWeather = null;
                    try { cachedWeather = $app.findFirstRecordByFilter("weather_daily", "date = {:d}", { d: weatherDate }); } catch (err) {}
                    if (cachedWeather) {
                        weatherData = { summary: cachedWeather.getString("summary") };
                    } else {
                        const weatherRes = $http.send({ url: buildOpenMeteoUrl(weatherDate), method: "GET", timeout: 20 });
                        const parsedWeather = parseOpenMeteoDaily(weatherRes.json || JSON.parse(weatherRes.raw || "{}"));
                        if (parsedWeather) {
                            const weatherSummary = buildWeatherSummary(parsedWeather);
                            const weatherRecord = new Record($app.findCollectionByNameOrId("weather_daily"));
                            weatherRecord.set("date", weatherDate);
                            weatherRecord.set("tempMaxC", parsedWeather.tempMaxC);
                            weatherRecord.set("tempMinC", parsedWeather.tempMinC);
                            weatherRecord.set("precipitationMm", parsedWeather.precipitationMm);
                            weatherRecord.set("weatherCode", parsedWeather.weatherCode);
                            weatherRecord.set("summary", weatherSummary);
                            $app.save(weatherRecord);
                            weatherData = { summary: weatherSummary };
                        }
                    }
                } catch (err) {
                    console.error("[news.pb.js] Error obteniendo clima:", err);
                }
            }
        }

        const contextParams = {
            match: { teamAName, teamBName, scoreA: match.getInt("scoreA"), scoreB: match.getInt("scoreB"), status: match.getString("status"), dateLabel: formatDateLabel(blockCode), venue },
            league: { name: leagueName },
            stage: { name: stageName },
            standings: standingsData,
            formA: formAData,
            formB: formBData,
            topScorers: topScorersData,
            rosterA: rosterAData,
            rosterB: rosterBData,
            statements: statementsData,
            report: reportData,
            comments: commentsData,
            weather: weatherData,
            editorContext,
        };

        if (isPreview) {
            // Todas las secciones con contenido real, sin filtrar por `sources` — el
            // panel las muestra todas apenas se elige el partido; los checkboxes solo
            // deciden cuáles se mandan de verdad al generar.
            const sections = buildContextSections(contextParams);
            const counts = {
                matchInfo: 1,
                leagueContext: (leagueName || stageName || standingsData.length > 0 || formAData || formBData || topScorersData.length > 0 || rosterAData || rosterBData) ? 1 : 0,
                statements: statementsData.length,
                refereeReport: reportData ? 1 : 0,
                comments: commentsData.length,
                weather: weatherData && weatherData.summary ? 1 : 0,
            };
            return e.json(200, {
                matchLabel: teamAName + " " + match.getInt("scoreA") + " - " + match.getInt("scoreB") + " " + teamBName,
                sections,
                counts,
            });
        }

        const context = buildContext(Object.assign({}, contextParams, { selectedSources: sources }));
        const customInstructions = e.auth.getString("newsInstructions");
        const { system, user: userMsg } = buildPrompt(context, customInstructions);

        const res = $http.send({
            url: "https://api.deepseek.com/chat/completions",
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
            body: JSON.stringify({
                model: "deepseek-v4-flash",
                messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
                max_tokens: 1200,
                temperature: 0.7,
                // thinking:disabled — igual que en mentions.pb.js: deepseek-v4-flash piensa
                // (reasoning_content) por defecto, y con un max_tokens fijo el razonamiento se
                // come todo el presupuesto sin dejar nada para la respuesta final (probado acá:
                // volvía content vacío, finish_reason "length", con los 1200 tokens gastados
                // enteros en reasoning_tokens). Sin pensar, todo el presupuesto va al artículo.
                thinking: { type: "disabled" },
            }),
            timeout: 45,
        });

        const responseData = res.json || JSON.parse(res.raw || "{}");
        const rawReply = responseData && responseData.choices && responseData.choices[0] && responseData.choices[0].message && responseData.choices[0].message.content;
        if (!rawReply) {
            console.error("[news.pb.js] Respuesta de DeepSeek sin contenido:", res.statusCode, res.raw);
            throw new BadRequestError("DeepSeek no devolvió contenido. Intenta de nuevo.");
        }

        const { title, subtitle, body } = parseAiResponse(rawReply);

        const newsRecord = new Record($app.findCollectionByNameOrId("news"));
        newsRecord.set("title", title || "Sin título");
        newsRecord.set("subtitle", subtitle || "");
        newsRecord.set("body", body || "");
        newsRecord.set("author", e.auth.id);
        newsRecord.set("relatedMatch", matchId);
        newsRecord.set("status", "draft");
        newsRecord.set("sourcesUsed", sources);
        if (venue) newsRecord.set("venue", venue);
        if (editorContext) newsRecord.set("editorContext", editorContext);
        newsRecord.set("deleted", false);
        $app.save(newsRecord);

        return e.json(200, {
            id: newsRecord.id,
            title: newsRecord.getString("title"),
            subtitle: newsRecord.getString("subtitle"),
            body: newsRecord.getString("body"),
            venue: newsRecord.getString("venue"),
            status: newsRecord.getString("status"),
        });
    } catch (err) {
        console.error("[news.pb.js] Error en POST /api/news/generate:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo generar la noticia." });
    }
}, $apis.requireAuth("users"));

// Clima del día de un partido, para mostrarlo como preview en el panel antes de generar
// (independiente del endpoint de generación, que vuelve a resolverlo él mismo — ver la
// nota ahí sobre por qué nunca se confía en un valor que mande el cliente).
routerAdd("POST", "/api/news/weather", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "media") {
            throw new BadRequestError("Esta cuenta no es un medio de noticias.");
        }
        const { dateFromBlockCode, buildOpenMeteoUrl, parseOpenMeteoDaily, buildWeatherSummary } = require(`${__hooks}/lib/weather.js`);

        const data = e.requestInfo().body || {};
        if (!data.matchId) throw new BadRequestError("Falta matchId.");

        const match = $app.findRecordById("league_matches", data.matchId);
        const date = dateFromBlockCode(match.getString("blockCode"));
        if (!date) throw new BadRequestError("Ese partido no tiene una fecha válida.");

        let cached = null;
        try { cached = $app.findFirstRecordByFilter("weather_daily", "date = {:d}", { d: date }); } catch (err) {}
        if (cached) {
            return e.json(200, { date, summary: cached.getString("summary") });
        }

        const res = $http.send({ url: buildOpenMeteoUrl(date), method: "GET", timeout: 20 });
        const parsed = parseOpenMeteoDaily(res.json || JSON.parse(res.raw || "{}"));
        if (!parsed) throw new BadRequestError("El clima de esa fecha todavía no está disponible.");

        const summary = buildWeatherSummary(parsed);
        const weatherRecord = new Record($app.findCollectionByNameOrId("weather_daily"));
        weatherRecord.set("date", date);
        weatherRecord.set("tempMaxC", parsed.tempMaxC);
        weatherRecord.set("tempMinC", parsed.tempMinC);
        weatherRecord.set("precipitationMm", parsed.precipitationMm);
        weatherRecord.set("weatherCode", parsed.weatherCode);
        weatherRecord.set("summary", summary);
        $app.save(weatherRecord);

        return e.json(200, { date, summary });
    } catch (err) {
        console.error("[news.pb.js] Error en POST /api/news/weather:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo obtener el clima." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/news/save", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "media") {
            throw new BadRequestError("Esta cuenta no es un medio de noticias.");
        }
        const data = e.requestInfo().body || {};
        if (!data.newsId) throw new BadRequestError("Falta newsId.");

        const newsRecord = $app.findRecordById("news", data.newsId);
        if (newsRecord.getString("author") !== e.auth.id) throw new BadRequestError("Esta noticia no te pertenece.");

        const title = (data.title || "").trim();
        const subtitle = (data.subtitle || "").trim();
        const body = (data.body || "").trim();
        if (!title) throw new BadRequestError("El título no puede estar vacío.");
        if (!body) throw new BadRequestError("El cuerpo no puede estar vacío.");

        newsRecord.set("title", title);
        newsRecord.set("subtitle", subtitle);
        newsRecord.set("body", body);
        if (data.publish) newsRecord.set("status", "published");
        $app.save(newsRecord);

        return e.json(200, {
            id: newsRecord.id,
            title: newsRecord.getString("title"),
            subtitle: newsRecord.getString("subtitle"),
            body: newsRecord.getString("body"),
            venue: newsRecord.getString("venue"),
            status: newsRecord.getString("status"),
        });
    } catch (err) {
        console.error("[news.pb.js] Error en POST /api/news/save:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo guardar la noticia." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/news/discard", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "media") {
            throw new BadRequestError("Esta cuenta no es un medio de noticias.");
        }
        const data = e.requestInfo().body || {};
        if (!data.newsId) throw new BadRequestError("Falta newsId.");

        const newsRecord = $app.findRecordById("news", data.newsId);
        if (newsRecord.getString("author") !== e.auth.id) throw new BadRequestError("Esta noticia no te pertenece.");

        newsRecord.set("deleted", true);
        $app.save(newsRecord);

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[news.pb.js] Error en POST /api/news/discard:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo descartar la noticia." });
    }
}, $apis.requireAuth("users"));
