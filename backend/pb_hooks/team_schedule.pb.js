/// <reference path="../pb_data/types.d.ts" />

// ---------------------------------------------------------------------------------
// Validación de horario_availability — lo que las reglas declarativas de PocketBase
// no pueden expresar (completitud de los bloques de la ventana vigente sin contar los
// que el admin bloqueó). Cualquier cuenta autenticada puede enviar su propia
// disponibilidad — equipos Y jugadores individuales por igual, el campo `team` en
// realidad es solo "quién envía esto" (nombre heredado de cuando era exclusivo de
// equipos). Mismo estilo que polls.pb.js.
// ---------------------------------------------------------------------------------

const validateAvailabilitySubmission = (e) => {
    const teamId = e.record.getString("team");
    if (teamId !== e.auth.id) {
        throw new BadRequestError("No puedes enviar disponibilidad en nombre de otra cuenta.");
    }

    const { windowBlockCodes, windowBlockRange, computeValidBlocks, filterToBlocks } = require(`${__hooks}/lib/teamSchedule.js`);
    // Acotado a la ventana móvil: sin este rango se traían TODOS los partidos jugados
    // de la historia para calcular qué bloques de las próximas 3 semanas están libres.
    // El límite es el tamaño de la ventana porque no puede haber más bloques ocupados
    // que bloques existentes. Ver auditoria-2026-08-19.md §4.3.
    const allWindowBlocks = windowBlockCodes();
    const range = windowBlockRange();
    const maxRows = allWindowBlocks.length;
    const blockedCodes = $app
        .findRecordsByFilter("horario_blocked_slots", "blockCode >= {:from} && blockCode <= {:to}", "", maxRows, 0, range)
        .map((r) => r.getString("blockCode"));
    const occupiedCodes = $app
        .findRecordsByFilter("horario_matches", "status = 'confirmed' && blockCode >= {:from} && blockCode <= {:to}", "", maxRows, 0, range)
        .map((r) => r.getString("blockCode"))
        .concat(
            $app
                .findRecordsByFilter(
                    "league_matches",
                    "(status = 'confirmed' || status = 'played') && deleted = false && blockCode >= {:from} && blockCode <= {:to}",
                    "", maxRows, 0, range
                )
                .map((r) => r.getString("blockCode"))
        );
    const validBlocks = computeValidBlocks(allWindowBlocks, [blockedCodes, occupiedCodes]);

    // .get() sobre un campo JSON dentro de un hook de registro NO devuelve el valor
    // parseado (da un objeto indexado por bytes, no el array/objeto real) — hay que
    // pasar por getString()+JSON.parse() explícito (mismo bug encontrado y corregido
    // en polls.pb.js esta misma sesión).
    const happiness = JSON.parse(e.record.getString("happiness") || "{}");

    // Se acepta lo que el cliente mande, aunque no coincida exactamente con la ventana
    // vigente en este preciso instante en el servidor — exigir completitud exacta
    // rebotaba envíos legítimos de clientes con la página abierta desde antes de un
    // cambio en el rango horario (ej. al sumar bloques nuevos), o simplemente con la
    // pestaña abierta el tiempo suficiente para que la ventana móvil se corriera un
    // día, o para que un bloque se bloqueara/ocupara mientras la tenían abierta.
    // filterToBlocks() descarta en silencio lo que ya no es válido (fuera de ventana,
    // bloqueado u ocupado); lo que falte del lado contrario (válido ahora pero ausente
    // en lo que mandó el cliente) simplemente queda sin calificar — fillDefaultHappiness()
    // ya trata cualquier bloque sin calificar como "Regular" al leerlo para el
    // algoritmo, así que no hace falta exigir que venga completo.
    const filteredHappiness = filterToBlocks(happiness, validBlocks);
    for (const v of Object.values(filteredHappiness)) {
        if (!Number.isInteger(v) || v < 1 || v > 5) {
            throw new BadRequestError("Cada calificación debe ser un número entero entre 1 (muy mala) y 5 (excelente).");
        }
    }
    e.record.set("happiness", JSON.stringify(filteredHappiness));

    return e.next();
};

onRecordCreateRequest(validateAvailabilitySubmission, "horario_availability");
onRecordUpdateRequest(validateAvailabilitySubmission, "horario_availability");

// ---------------------------------------------------------------------------------
// Administración (vista tipo /admin/generate-link y /admin/beaumarket, sin gate de
// auth en el GET — la seguridad real vive en las rutas de acción, todas con
// requireSuperuserAuth()). Sin concepto de "ronda": la ventana marcable es siempre la
// misma regla relativa a hoy (ver teamSchedule.js). Acá solo se administran los
// horarios en sí (bloqueados/ocupados) — agendar partidos se hace desde /admin/liga.
// ---------------------------------------------------------------------------------

routerAdd("GET", "/admin/horarios", (e) => {
    const { PALETTE_CSS, clientCalendarFns, clientSessionGateFn, clientApiCallFn } = require(`${__hooks}/lib/adminUi.js`);
    // Las etiquetas de día/mes y los helpers de la ventana vienen de lib/adminUi.js:
    // esta página y /admin/liga tienen que dibujar exactamente el mismo calendario.
    const CALENDAR_FNS = clientCalendarFns();
    const SESSION_GATE_FN = clientSessionGateFn();
    const API_CALL_FN = clientApiCallFn("pb_auth");
    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Horarios - Administración</title>
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
            padding: 24px;
        }
        .page { max-width: 960px; margin: 0 auto; }
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
        input[type="email"], input[type="password"] {
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
        .alert { padding: 12px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 16px; text-align: left; display: none; }
        .alert-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
        #logoutBar { text-align: right; margin-bottom: 16px; }
        .week-block { margin-bottom: 18px; }
        .week-label { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
        /* width:100% + table-layout:fixed (no ancho intrínseco por contenido) es lo que
           garantiza que las 3 tablas de semana ocupen todo el ancho disponible y queden
           exactamente del mismo tamaño entre sí, sin importar que el texto de fechas de
           cada semana tenga largos distintos (ej. "9" vs "31"). */
        .grid-table { border-collapse: collapse; font-size: 10px; width: 100%; table-layout: fixed; }
        .grid-table th, .grid-table td { border: 1px solid var(--border-color); padding: 0; text-align: center; }
        .grid-table th { color: var(--text-muted); font-weight: 600; padding: 2px 4px; }
        .grid-table th:first-child, .grid-table td:first-child { width: 44px; }
        /* width:100% (no un width fijo) para que la celda llene su <td> entero — con un
           ancho fijo más chico que la columna (la cabecera de fecha suele ser más ancha)
           quedaba un espacio vacío a la derecha de cada casilla. */
        .grid-cell { display: block; width: 100%; height: 22px; box-sizing: border-box; cursor: pointer; user-select: none; background: rgba(15,23,42,0.4); }
        .grid-cell.active { background: var(--danger-color); }
        .grid-cell.occupied { background: #1e3a5f; cursor: default; }
        .grid-wrap { overflow-x: auto; }
        .grid-legend { display: flex; gap: 14px; margin-top: 10px; font-size: 11px; color: var(--text-muted); }
        .grid-legend-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
    </style>
</head>
<body>
    <div class="page" id="loginPage">
        <div class="container">
            <h1>Horarios</h1>
            <p class="subtitle">Administración de horarios (bloqueados y ocupados)</p>
            <div class="alert alert-danger" id="loginError"></div>
            <p class="hint" id="checkingMsg">Verificando sesión…</p>
            <form id="loginForm" style="display:none;">
                <div class="form-group">
                    <label>Correo del Administrador</label>
                    <input type="email" id="loginEmail" required>
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
        <h1>Horarios — Administración</h1>
        <p class="subtitle">Acá solo se administran los horarios: qué bloques quedan cerrados (cancha no disponible) y cuáles ya están ocupados por un partido. Los partidos se agendan desde /admin/liga, no desde acá.</p>
        <div class="alert alert-danger" id="panelError"></div>

        <div class="card">
            <h2 style="margin-top:0;">Horarios</h2>
            <p class="hint">Tocar un bloque libre lo bloquea/desbloquea (cancha no disponible). Los bloques ocupados por un partido ya confirmado se muestran aparte y no son tocables.</p>
            <div class="grid-wrap" id="blockedGridWrap"><p class="hint">Cargando...</p></div>
            <div class="grid-legend">
                <span><span class="grid-legend-swatch" style="background:var(--danger-color);"></span>Bloqueado</span>
                <span><span class="grid-legend-swatch" style="background:#1e3a5f;"></span>Ocupado por un partido</span>
                <span><span class="grid-legend-swatch" style="background:rgba(15,23,42,0.4);"></span>Libre</span>
            </div>
        </div>
    </div>

    <script>
${CALENDAR_FNS}
${SESSION_GATE_FN}

        let token = "";

        const loginPage = document.getElementById("loginPage");
        const panelPage = document.getElementById("panelPage");
        const loginError = document.getElementById("loginError");
        const panelError = document.getElementById("panelError");
        const checkingMsg = document.getElementById("checkingMsg");
        const loginForm = document.getElementById("loginForm");

        function showError(el, msg) { el.textContent = msg; el.style.display = "block"; }
        function hideError(el) { el.style.display = "none"; }

        function showPanel() { checkingMsg.style.display = "none"; loginPage.style.display = "none"; panelPage.style.display = "block"; loadBlockedGrid(); }
        function showLogin(hadStaleSession) {
            checkingMsg.style.display = "none";
            loginForm.style.display = "block";
            loginPage.style.display = "block";
            panelPage.style.display = "none";
            if (hadStaleSession) showError(loginError, "Tu sesión expiró. Inicia sesión de nuevo.");
        }

        document.getElementById("loginForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            hideError(loginError);
            const email = document.getElementById("loginEmail").value;
            const password = document.getElementById("loginPassword").value;
            try {
                const res = await fetch("/api/collections/_superusers/auth-with-password", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identity: email, password: password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || "Credenciales incorrectas.");
                token = data.token;
                localStorage.setItem("pb_auth", JSON.stringify({ token, model: data.record }));
                showPanel();
            } catch (err) { showError(loginError, err.message); }
        });

        document.getElementById("logoutBtn").addEventListener("click", () => {
            token = ""; localStorage.removeItem("pb_auth"); showLogin();
        });

${API_CALL_FN}

        // --- Grilla de bloques cerrados (3 semanas x 7 días x 11 horas) ---
        async function loadBlockedGrid() {
            const wrap = document.getElementById("blockedGridWrap");
            wrap.innerHTML = '<p class="hint">Cargando...</p>';
            try {
                const [blockedRes, horarioMatchesRes, leagueMatchesRes] = await Promise.all([
                    fetch("/api/collections/horario_blocked_slots/records?perPage=500", { headers: { "Authorization": "Bearer " + token } }),
                    fetch("/api/collections/horario_matches/records?perPage=500&filter=" + encodeURIComponent('status = "confirmed"'), { headers: { "Authorization": "Bearer " + token } }),
                    fetch("/api/collections/league_matches/records?perPage=500&filter=" + encodeURIComponent('(status = "confirmed" || status = "played") && deleted = false'), { headers: { "Authorization": "Bearer " + token } }),
                ]);
                const blockedData = await blockedRes.json();
                const horarioMatchesData = await horarioMatchesRes.json();
                const leagueMatchesData = await leagueMatchesRes.json();
                const blockedSet = new Set((blockedData.items || []).map((r) => r.blockCode));
                const occupiedSet = new Set(
                    [...(horarioMatchesData.items || []), ...(leagueMatchesData.items || [])].map((r) => r.blockCode)
                );
                renderBlockedGrid(wrap, blockedSet, occupiedSet);
            } catch (err) {
                wrap.innerHTML = "";
                showError(panelError, "No se pudo cargar la grilla de horarios.");
            }
        }

        function renderBlockedGrid(wrap, blockedSet, occupiedSet) {
            wrap.innerHTML = "";
            getWindow().forEach((week) => {
                const weekDiv = document.createElement("div");
                weekDiv.className = "week-block";
                const label = document.createElement("div");
                label.className = "week-label";
                label.textContent = "Semana del " + week.label;
                weekDiv.appendChild(label);

                const table = document.createElement("table");
                table.className = "grid-table";
                const thead = document.createElement("tr");
                thead.innerHTML = "<th></th>" + week.days.map((d) => "<th>" + d.dayLabel + " " + d.dayOfMonth + "</th>").join("");
                table.appendChild(thead);

                for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
                    const row = document.createElement("tr");
                    const hourTh = document.createElement("th");
                    hourTh.textContent = pad2(hour) + ":00";
                    row.appendChild(hourTh);
                    week.days.forEach((day) => {
                        const block = day.dateStr + "-" + pad2(hour);
                        const td = document.createElement("td");
                        const cell = document.createElement("div");
                        if (occupiedSet.has(block)) {
                            cell.className = "grid-cell occupied";
                        } else {
                            cell.className = "grid-cell" + (blockedSet.has(block) ? " active" : "");
                            cell.addEventListener("click", async () => {
                                cell.style.opacity = "0.5";
                                try {
                                    const res = await apiCall("/api/admin/horarios/blocked/toggle", "POST", { blockCode: block });
                                    cell.classList.toggle("active", res.blocked);
                                    if (res.blocked) blockedSet.add(block); else blockedSet.delete(block);
                                } catch (err) { showError(panelError, err.message); }
                                finally { cell.style.opacity = "1"; }
                            });
                        }
                        td.appendChild(cell);
                        row.appendChild(td);
                    });
                    table.appendChild(row);
                }
                weekDiv.appendChild(table);
                wrap.appendChild(weekDiv);
            });
        }

        // Al final del script a propósito: showPanel() usa la const loginPage/panelPage
        // etc. declaradas más abajo en este mismo script — si este chequeo de sesión
        // corre antes de esas declaraciones, revienta con "can't access lexical
        // declaration before initialization" (temporal dead zone) cada vez que ya había
        // un token guardado (es decir, en toda carga de página después del primer login).
        //
        // gateSession valida el token contra el servidor (auth-refresh) antes de decidir
        // qué mostrar — antes se confiaba en que un token presente en localStorage
        // seguía sirviendo, así que una sesión vencida mostraba el panel igual y recién
        // fallaba al primer POST.
        gateSession("_superusers", "pb_auth", (freshToken) => {
            token = freshToken;
            showPanel();
        }, (hadStaleSession) => showLogin(hadStaleSession));
    </script>
</body>
</html>
    `;
    return e.html(200, htmlContent);
});

routerAdd("POST", "/api/admin/horarios/blocked/toggle", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const blockCode = String(body.blockCode || "");
        if (!blockCode) throw new BadRequestError("Falta blockCode.");

        let existing = null;
        try {
            existing = $app.findFirstRecordByFilter("horario_blocked_slots", "blockCode = {:b}", { b: blockCode });
        } catch (err) {
            existing = null;
        }

        if (existing) {
            $app.delete(existing);
            return e.json(200, { blocked: false });
        }

        const coll = $app.findCollectionByNameOrId("horario_blocked_slots");
        const record = new Record(coll);
        record.set("blockCode", blockCode);
        $app.save(record);
        return e.json(200, { blocked: true });
    } catch (err) {
        console.error("[team_schedule.pb.js] Error en POST /api/admin/horarios/blocked/toggle:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo actualizar el bloque." });
    }
}, $apis.requireSuperuserAuth());

// ---------------------------------------------------------------------------------
// Disponibilidad de los integrantes de un equipo para un bloque puntual — un equipo
// no puede leer la disponibilidad de OTRO equipo (eso sigue protegido: es lo que hace
// el anti-trampa de la normalización tener sentido), pero SÍ debe poder ver la de sus
// propios integrantes para decidir bien. horario_availability.viewRule solo permite
// `@request.auth.id = team`, así que hace falta una ruta con $app (bypassea reglas)
// que arme esto explícitamente.
// ---------------------------------------------------------------------------------

routerAdd("GET", "/api/team-schedule/roster-availability", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "team") {
            throw new BadRequestError("Solo las cuentas de equipo pueden ver la disponibilidad de sus integrantes.");
        }
        const blockCode = String(e.requestInfo().query.blockCode || "");
        if (!blockCode) throw new BadRequestError("Falta blockCode.");

        const members = $app.findRecordsByFilter(
            "organization_members",
            "organization = {:org} && status = 'active'",
            "",
            0,
            0,
            { org: e.auth.id }
        );

        const result = members.map((m) => {
            const userId = m.getString("user");
            let name = userId;
            try {
                const userRec = $app.findRecordById("users", userId);
                name = userRec.getString("name") || userRec.getString("username") || userId;
            } catch (err) {
                // usuario eliminado — se muestra igual con el id crudo como fallback
            }

            let happiness = null;
            try {
                const avail = $app.findFirstRecordByFilter("horario_availability", "team = {:u}", { u: userId });
                const parsed = JSON.parse(avail.getString("happiness") || "{}");
                if (blockCode in parsed) happiness = parsed[blockCode];
            } catch (err) {
                // nunca envió disponibilidad — happiness queda null (distinto de un 1
                // real, para no mostrarlo como "mala disponibilidad" sin serlo)
            }

            return { memberId: userId, memberName: name, happiness };
        });

        return e.json(200, { members: result });
    } catch (err) {
        console.error("[team_schedule.pb.js] Error en GET /api/team-schedule/roster-availability:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cargar la disponibilidad del equipo." });
    }
}, $apis.requireAuth("users"));

