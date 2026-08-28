/// <reference path="../pb_data/types.d.ts" />

// Beaumarket: mercados de predicción con puntos (BeauTokens, símbolo ℬ, jugado
// únicamente sobre users.beautokens, nunca dinero real) — pari-mutuel: cada apuesta va
// directo al pozo del resultado elegido (sin market maker, sin curva de precio), el
// porcentaje que se muestra es proporcional a lo apostado, y al resolver el pozo total se
// reparte entre quienes acertaron a prorrata de su apuesta. La casa nunca gana ni pierde:
// todo lo que entra al pozo sale repartido (con el resto del redondeo hacia abajo
// quedando sin repartir — "breakage", ver lib/beaumarket.js).
//
// Las apuestas son definitivas: a diferencia de LMSR (donde "vender" tenía sentido porque
// había un precio de salida en todo momento), acá no existe forma de retirar una apuesta
// ya hecha — apostar es la única operación, y por eso el modal para apostar (POST /bet)
// nunca muestra una previsualización de "ganarías X": justo en el momento de decidir el
// monto sería la promesa más engañosa, porque el pago real depende de cuánto apueste
// todavía el resto antes del cierre. GET /markets sí manda ese estimado (estimatedPayout,
// dentro de myPositions) para la lista de "tus apuestas" — ahí es simple seguimiento de
// algo ya hecho, no una promesa para convencer de apostar.
//
// Todo mercado nace con una fecha de cierre automático (closesAt) — un cron pasa a
// "closed" cualquier mercado abierto que ya la cumplió, sin depender de que un admin
// entre a cerrarlo a mano.
//
// Cada callback de abajo es autocontenido (require() propio en vez de compartir
// const/function de nivel de archivo) por el mismo motivo documentado en karma.pb.js: el
// JSVM no conserva referencias de nivel de archivo entre callbacks registrados por
// separado.
//
// Saldo inicial: onRecordCreate (NO onRecordCreateRequest) — onRecordCreateRequest solo
// dispara en una request API real de creación; onRecordCreate dispara siempre que se
// crea un modelo, incluyendo $app.save() directo (ej. la ruta /api/admin/generate-link
// de auth.pb.js crea cuentas de organización así, evitando a propósito el hook
// onRecordCreateRequest). Con onRecordCreateRequest, esas cuentas se quedarían sin sus
// 100 BeauTokens iniciales en silencio.
onRecordCreate((e) => {
    e.record.set("beautokens", 100);
    return e.next();
}, "users");

// Acumulación diaria: un monto plano para todo usuario verificado. Un solo UPDATE
// masivo (no hace falta paginar usuario por usuario como sí hace karma.pb.js, porque
// acá el monto es idéntico para todos, no depende de un cálculo individual).
cronAdd("credit_daily_beautokens", "5 4 * * *", () => {
    try {
        const DAILY_BEAUTOKENS_AMOUNT = 15;
        $app.db()
            .newQuery("UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:amt} WHERE verified = true")
            .bind({ amt: DAILY_BEAUTOKENS_AMOUNT })
            .execute();
    } catch (err) {
        console.error("[beaumarket.pb.js] Error en cron credit_daily_beautokens:", err);
    }
});

// Cierre automático: cada 5 minutos (no hace falta más frecuencia — closesAt no es un
// resultado que dependa de milisegundos, y en un servidor tan chico no vale la pena
// consultar más seguido) pasa a "closed" cualquier mercado abierto cuya fecha de cierre
// ya se cumplió. El botón "Cerrar operaciones" del panel admin sigue existiendo para
// cerrar ANTES de esa fecha si hace falta — este cron nunca reabre ni extiende nada, solo
// empuja hacia "closed" en una dirección.
cronAdd("beaumarket_autoclose", "*/5 * * * *", () => {
    try {
        const now = new Date().toISOString();
        const dueMarkets = $app.findRecordsByFilter(
            "beaumarkets", "status = 'open' && closesAt != '' && closesAt <= {:now}", "", 200, 0, { now }
        );
        dueMarkets.forEach((market) => {
            try {
                market.set("status", "closed");
                $app.save(market);
            } catch (err) {
                console.error("[beaumarket.pb.js] Error autocerrando mercado", market.id, err.message || err);
            }
        });
    } catch (err) {
        console.error("[beaumarket.pb.js] Error en cron beaumarket_autoclose:", err);
    }
});

// GET /api/beaumarket/markets — lista de mercados con porcentajes pari-mutuel calculados
// en vivo desde "pool" (ninguna agregación de filas necesaria) y, si el usuario tiene
// posiciones abiertas, incluidas. Con ?id=<marketId> devuelve solo ese mercado, con
// "history" incluido (la oscilación del pozo apuesta a apuesta, para el gráfico) — no se
// calcula para la lista completa a propósito, para no pagar ese costo extra en cada carga
// de la pantalla de lista.
routerAdd("GET", "/api/beaumarket/markets", (e) => {
    try {
        const { poolPercentages, payoutForStake, computePoolHistory, MAX_CHART_POINTS } = require(`${__hooks}/lib/beaumarket.js`);
        const status = e.requestInfo().query["status"] || "";
        const singleId = e.requestInfo().query["id"] || "";

        let filter = "";
        const params = {};
        if (singleId) {
            filter = "id = {:id}";
            params.id = singleId;
        } else if (status) {
            filter = "status = {:s}";
            params.s = status;
        }

        const markets = $app.findRecordsByFilter("beaumarkets", filter, "-created", 100, 0, params);

        // Dos consultas totales (no N+1) para las posiciones y apuestas propias de TODOS
        // los mercados de la página, filtradas por el conjunto de ids ya cargados y
        // agrupadas en memoria. Ver auditoria-2026-08-19.md §4.2.
        //
        // El filtro se arma parametrizado ({:m0} || {:m1} || ...), nunca interpolando
        // los ids como strings: es la regla que no se negocia de PRINCIPLES.md §4.
        const marketIds = markets.map((m) => m.id);
        const PAGE_SIZE = 500;

        function buildMarketFilter(ids, extraClause) {
            const clauses = [];
            const bind = { u: e.auth.id };
            ids.forEach((id, i) => {
                clauses.push(`market = {:m${i}}`);
                bind[`m${i}`] = id;
            });
            return { filter: `(${clauses.join(" || ")})${extraClause || ""}`, bind: bind };
        }

        // Paginación real: la cantidad de apuestas de un usuario no tiene techo natural,
        // así que se recorre por páginas en vez de pedir "todo" y confiar en que sea poco.
        function findAllPaged(collection, filter, bind, sort) {
            const out = [];
            let offset = 0;
            while (true) {
                const page = $app.findRecordsByFilter(collection, filter, sort || "", PAGE_SIZE, offset, bind);
                if (!page || page.length === 0) break;
                for (const rec of page) out.push(rec);
                if (page.length < PAGE_SIZE) break;
                offset += PAGE_SIZE;
            }
            return out;
        }

        // { marketId: { outcomeIndex: amount } } — ℬ vigentes de este usuario en cada
        // resultado de cada mercado.
        const amountByMarket = {};

        if (marketIds.length > 0) {
            const posQuery = buildMarketFilter(marketIds, " && user = {:u}");
            findAllPaged("beaumarket_positions", posQuery.filter, posQuery.bind).forEach((p) => {
                const mid = p.getString("market");
                if (!amountByMarket[mid]) amountByMarket[mid] = {};
                amountByMarket[mid][p.getInt("outcomeIndex")] = p.getInt("amount");
            });
        }

        const result = markets.map((m) => {
            const outcomes = JSON.parse(m.getString("outcomes") || "[]");
            const pool = JSON.parse(m.getString("pool") || "[]");
            const totalPool = pool.reduce((a, c) => a + c, 0);
            const marketPrices = poolPercentages(pool);

            // estimatedPayout se manda siempre, en la lista de "tus apuestas" de cada
            // posición — pero OJO: solo ahí. El modal para apostar (POST /bet) nunca
            // muestra esta cifra mientras se decide el monto, justo porque en ese momento
            // sería la más engañosa (una promesa fresca, mientras se está por confirmar
            // una apuesta). Acá, en cambio, es simple información de seguimiento sobre una
            // apuesta ya hecha: antes de resolver, es una proyección al estado ACTUAL del
            // pozo (sigue moviéndose con cada apuesta de cualquiera); al resolver, el pozo
            // queda congelado y esta misma cuenta pasa a ser, sin ningún caso especial,
            // "lo ganado" (si acertó) o "lo que pudo haber ganado" (si no).
            const amountByOutcome = amountByMarket[m.id] || {};
            const myPositions = Object.keys(amountByOutcome).map(Number).sort((a, b) => a - b).map((outcomeIndex) => {
                const amount = amountByOutcome[outcomeIndex];
                const estimatedPayout = Math.floor(payoutForStake(amount, pool[outcomeIndex] || 0, totalPool));
                return { outcomeIndex, amount, estimatedPayout };
            });

            let history;
            if (singleId) {
                // El eje X del gráfico es tiempo real: desde que se creó el mercado hasta
                // ahora (o hasta que se cerró/resolvió/canceló, si ya terminó — no tiene
                // sentido seguir "avanzando" el gráfico después de eso).
                const rangeStartMs = m.getDateTime("created").unix() * 1000;
                const isFinished = m.getString("status") !== "open";
                const rangeEndMs = isFinished ? (m.getDateTime("updated").unix() * 1000) : Date.now();
                // Solo en la vista de detalle (un mercado), y paginado: el volumen de
                // apuestas de un mercado no tiene techo. Ver auditoria-2026-08-19.md §4.2.
                const trades = findAllPaged("beaumarket_trades", "market = {:id}", { id: m.id }, "created");
                const plainBets = trades.map((t) => ({
                    outcomeIndex: t.getInt("outcomeIndex"),
                    amountDelta: t.getInt("amountDelta"),
                    createdAtMs: t.getDateTime("created").unix() * 1000,
                }));
                history = computePoolHistory(plainBets, outcomes.length, rangeStartMs, rangeEndMs, MAX_CHART_POINTS);
            }

            return {
                id: m.id,
                title: m.getString("title"),
                description: m.getString("description"),
                outcomes,
                status: m.getString("status"),
                winningOutcomeIndex: m.getString("status") === "resolved" ? m.getInt("winningOutcomeIndex") : null,
                closesAt: m.getString("closesAt"),
                prices: marketPrices,
                history,
                myPositions,
            };
        });

        return e.json(200, { markets: result });
    } catch (err) {
        console.error("[beaumarket.pb.js] Error en GET /api/beaumarket/markets:", err);
        return e.json(500, { error: "No se pudieron cargar los mercados." });
    }
}, $apis.requireAuth("users"));

// POST /api/beaumarket/bet — body {marketId, outcomeIndex, amount}. A diferencia del LMSR
// anterior, apostar es simplemente sumar el monto al pozo del resultado elegido: no hay
// curva de precio que recalcular ni redondeo de acciones fraccionarias, el costo es
// exactamente el monto pedido.
routerAdd("POST", "/api/beaumarket/bet", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const marketId = String(body.marketId || "");
        const outcomeIndex = Number.isInteger(body.outcomeIndex) ? body.outcomeIndex : -1;
        const amount = Number.isInteger(body.amount) ? body.amount : 0;

        if (!marketId || outcomeIndex < 0 || amount <= 0) {
            throw new BadRequestError("Datos de apuesta inválidos.");
        }

        $app.runInTransaction((txApp) => {
            const market = txApp.findRecordById("beaumarkets", marketId);
            const closesAt = market.getString("closesAt");
            if (market.getString("status") !== "open" || (closesAt && closesAt <= new Date().toISOString())) {
                throw new BadRequestError("Este mercado no está abierto para apostar.");
            }

            // Cooldown anti-flood: acá no hay una cota matemática de pérdida que
            // reemplace esta defensa (como sí tenía LMSR) — sin ella, un script podría
            // saturar la ruta sin ningún costo real más allá del propio saldo. Se
            // inlinea (en vez de una función de nivel de archivo) porque el JSVM no
            // conserva referencias de nivel de archivo entre callbacks registrados por
            // separado — mismo patrón ya establecido en este archivo.
            const lastTrade = txApp.findRecordsByFilter(
                "beaumarket_trades", "market = {:m} && user = {:u}", "-created", 1, 0,
                { m: marketId, u: e.auth.id }
            );
            if (lastTrade.length > 0) {
                const waitMs = 3000 - (Date.now() - lastTrade[0].getDateTime("created").unix() * 1000);
                if (waitMs > 0) {
                    throw new BadRequestError(`Espera ${Math.ceil(waitMs / 1000)}s antes de apostar de nuevo en este mercado.`);
                }
            }

            const outcomes = JSON.parse(market.getString("outcomes") || "[]");
            if (outcomeIndex >= outcomes.length) {
                throw new BadRequestError("Resultado inválido.");
            }

            const res = txApp.db()
                .newQuery("UPDATE users SET beautokens = beautokens - {:amt} WHERE id = {:id} AND beautokens >= {:amt}")
                .bind({ amt: amount, id: e.auth.id })
                .execute();
            if (res.rowsAffected() === 0) {
                throw new BadRequestError("Saldo insuficiente de BeauTokens.");
            }

            const pool = JSON.parse(market.getString("pool") || "[]");
            pool[outcomeIndex] += amount;
            market.set("pool", JSON.stringify(pool));
            txApp.save(market);

            const existing = txApp.findRecordsByFilter(
                "beaumarket_positions", "market = {:m} && user = {:u} && outcomeIndex = {:o}", "", 1, 0,
                { m: marketId, u: e.auth.id, o: outcomeIndex }
            );
            if (existing.length > 0) {
                const pos = existing[0];
                pos.set("amount", pos.getInt("amount") + amount);
                txApp.save(pos);
            } else {
                const pos = new Record(txApp.findCollectionByNameOrId("beaumarket_positions"));
                pos.set("market", marketId);
                pos.set("user", e.auth.id);
                pos.set("outcomeIndex", outcomeIndex);
                pos.set("amount", amount);
                txApp.save(pos);
            }

            const trade = new Record(txApp.findCollectionByNameOrId("beaumarket_trades"));
            trade.set("market", marketId);
            trade.set("user", e.auth.id);
            trade.set("outcomeIndex", outcomeIndex);
            trade.set("amountDelta", amount);
            txApp.save(trade);
        });

        return e.json(200, { success: true, amount });
    } catch (err) {
        console.error("[beaumarket.pb.js] Error en POST /api/beaumarket/bet:", err);
        const msg = (err && err.message) || "No se pudo completar la apuesta.";
        return e.json(400, { error: msg });
    }
}, $apis.requireAuth("users"));

// ---------------------------------------------------------------------------------
// Administración (vista tipo /admin/generate-link, sin gate de auth en el GET —
// la seguridad real vive en las rutas POST/GET de acción, todas con requireSuperuserAuth()).
// ---------------------------------------------------------------------------------

routerAdd("GET", "/admin/beaumarket", (e) => {
    const { PALETTE_CSS, clientEscapeHtmlFn, clientSessionGateFn, clientApiCallFn } = require(`${__hooks}/lib/adminUi.js`);
    const ESC_FN = clientEscapeHtmlFn();
    const SESSION_GATE_FN = clientSessionGateFn();
    const API_CALL_FN = clientApiCallFn("pb_auth");

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Beaumarket - Administración</title>
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
        input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="datetime-local"], textarea {
            width: 100%; background: rgba(15,23,42,0.6); border: 1px solid var(--border-color);
            border-radius: 10px; padding: 10px 14px; color: var(--text-color); font-size: 14px; outline: none;
        }
        input:focus, textarea:focus { border-color: var(--primary-color); }
        .hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
        .btn {
            background: var(--primary-color); color: #0f172a; border: none; border-radius: 10px;
            padding: 10px 18px; font-size: 14px; font-weight: 700; cursor: pointer;
        }
        .btn:hover { background: var(--primary-hover); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: rgba(255,255,255,0.05); color: var(--text-color); border: 1px solid var(--border-color); }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }
        .btn-danger { background: var(--danger-color); color: #fff; }
        .btn-sm { padding: 6px 12px; font-size: 12px; margin-right: 6px; margin-top: 6px; }
        .alert { padding: 12px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 16px; text-align: left; display: none; }
        .alert-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
        .outcome-row { display: flex; gap: 8px; margin-bottom: 8px; }
        .outcome-row input { flex: 1; }
        .market-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
        .market-desc { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
        .status-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 10px; }
        .status-open { background: rgba(34,197,94,0.15); color: var(--success-color); }
        .status-closed { background: rgba(250,204,21,0.15); color: #facc15; }
        .status-resolved { background: rgba(56,189,248,0.15); color: var(--primary-color); }
        .status-cancelled { background: rgba(239,68,68,0.15); color: var(--danger-color); }
        .outcome-line { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px solid var(--border-color); }
        .outcome-line.winner { color: var(--success-color); font-weight: 700; }
        .resolve-picker { display: none; margin-top: 10px; padding: 12px; background: rgba(15,23,42,0.6); border-radius: 10px; }
        .resolve-picker label { display: block; font-weight: 400; margin-bottom: 4px; cursor: pointer; }
        #logoutBar { text-align: right; margin-bottom: 16px; }
    </style>
</head>
<body>
    <div class="page" id="loginPage">
        <div class="container">
            <h1>Beaumarket</h1>
            <p class="subtitle">Administración de mercados de predicción</p>
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
        <h1>Beaumarket — Administración</h1>
        <div class="alert alert-danger" id="panelError"></div>

        <div class="card">
            <h2 style="margin-top:0;">Crear mercado</h2>
            <form id="createForm">
                <div class="form-group">
                    <label>Título</label>
                    <input type="text" id="newTitle" required>
                </div>
                <div class="form-group">
                    <label>Descripción (opcional)</label>
                    <textarea id="newDescription" rows="2"></textarea>
                </div>
                <div class="form-group">
                    <label>Resultados posibles</label>
                    <div id="outcomesList"></div>
                    <button type="button" class="btn btn-secondary btn-sm" id="addOutcomeBtn" style="margin-top:4px;">+ Agregar resultado</button>
                </div>
                <div class="form-group">
                    <label>Cierre automático</label>
                    <input type="datetime-local" id="newClosesAt" required>
                    <div class="hint">Desde esa fecha nadie puede seguir apostando — se puede cerrar antes a mano, nunca extender después.</div>
                </div>
                <button type="submit" class="btn" id="createBtn">Crear mercado</button>
            </form>
        </div>

        <h2>Mercados existentes</h2>
        <div id="marketsList"></div>
    </div>

    <script>
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

        function showPanel() { checkingMsg.style.display = "none"; loginPage.style.display = "none"; panelPage.style.display = "block"; loadMarkets(); }
        function showLogin(hadStaleSession) {
            checkingMsg.style.display = "none";
            loginForm.style.display = "block";
            loginPage.style.display = "block";
            panelPage.style.display = "none";
            if (hadStaleSession) showError(loginError, "Tu sesión expiró. Inicia sesión de nuevo.");
        }

        loginForm.addEventListener("submit", async (e) => {
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

        // Título, descripción y etiquetas de resultado de un mercado son texto libre.
        // Hoy solo los escribe el propio superusuario desde esta página (self-XSS), pero
        // renderMarket los mete en innerHTML, así que se escapan igual: es la misma clase
        // de bug que sí era explotable cross-user en /admin/liga (auditoria-2026-08-19.md
        // §3.1 y §5.2). La función esc() viene de lib/adminUi.js — una sola definición
        // para todas las páginas de administración, en vez de una copia por página.
        ${ESC_FN}

        // --- Formulario de creación: lista dinámica de resultados + fecha de cierre ---
        const outcomesList = document.getElementById("outcomesList");
        function addOutcomeRow(value) {
            const row = document.createElement("div");
            row.className = "outcome-row";
            row.innerHTML = '<input type="text" placeholder="Resultado" value="' + esc(value) + '">' +
                '<button type="button" class="btn btn-secondary btn-sm" style="margin:0;">Quitar</button>';
            row.querySelector("button").addEventListener("click", () => {
                if (outcomesList.children.length > 2) row.remove();
            });
            outcomesList.appendChild(row);
        }
        addOutcomeRow("Sí");
        addOutcomeRow("No");
        document.getElementById("addOutcomeBtn").addEventListener("click", () => {
            if (outcomesList.children.length < 10) addOutcomeRow("");
        });

        document.getElementById("createForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            hideError(panelError);
            const createBtn = document.getElementById("createBtn");
            const title = document.getElementById("newTitle").value.trim();
            const description = document.getElementById("newDescription").value.trim();
            const outcomes = Array.from(outcomesList.querySelectorAll("input")).map(i => i.value.trim()).filter(Boolean);
            // datetime-local no trae zona horaria — el navegador la interpreta como hora
            // local, y toISOString() la convierte a UTC antes de mandarla: el backend
            // solo compara strings ISO, nunca reinterpreta zona horaria por su cuenta.
            const closesAtLocal = document.getElementById("newClosesAt").value;
            const closesAt = closesAtLocal ? new Date(closesAtLocal).toISOString() : "";
            createBtn.disabled = true;
            try {
                await apiCall("/api/admin/beaumarket/create", "POST", { title, description, outcomes, closesAt });
                document.getElementById("createForm").reset();
                outcomesList.innerHTML = "";
                addOutcomeRow("Sí"); addOutcomeRow("No");
                loadMarkets();
            } catch (err) { showError(panelError, err.message); }
            finally { createBtn.disabled = false; }
        });

        // --- Listado de mercados ---
        const marketsList = document.getElementById("marketsList");

        function formatClosesAt(iso) {
            if (!iso) return "sin fecha";
            const d = new Date(iso);
            return d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
        }

        function renderMarket(m) {
            const div = document.createElement("div");
            div.className = "card";
            let outcomesHtml = m.outcomes.map((label, idx) => {
                const pct = m.prices[idx] || 0;
                const pool = m.pool[idx] || 0;
                const isWinner = m.status === "resolved" && m.winningOutcomeIndex === idx;
                return '<div class="outcome-line' + (isWinner ? ' winner' : '') + '">' +
                    '<span>' + (isWinner ? '🏆 ' : '') + esc(label) + '</span>' +
                    '<span>' + pct.toFixed(1) + '% · ' + pool + ' ℬ</span></div>';
            }).join("");

            let actionsHtml = "";
            if (m.status === "open" || m.status === "closed") {
                if (m.status === "open") {
                    actionsHtml += '<button class="btn btn-secondary btn-sm" data-action="close">Cerrar operaciones</button>';
                }
                actionsHtml += '<button class="btn btn-secondary btn-sm" data-action="resolve">Resolver</button>';
                actionsHtml += '<button class="btn btn-danger btn-sm" data-action="cancel">Cancelar</button>';
            }

            let resolvePickerHtml = '<div class="resolve-picker" data-resolve-picker>' +
                m.outcomes.map((label, idx) => '<label><input type="radio" name="winner-' + esc(m.id) + '" value="' + idx + '"> ' + esc(label) + '</label>').join("") +
                '<button class="btn btn-sm" data-action="confirm-resolve" style="margin-top:8px;">Confirmar</button></div>';

            const totalPool = m.pool.reduce((a, c) => a + c, 0);
            div.innerHTML =
                '<span class="status-badge status-' + esc(m.status) + '">' + esc(m.status) + '</span>' +
                '<div class="market-title">' + esc(m.title) + '</div>' +
                (m.description ? '<div class="market-desc">' + esc(m.description) + '</div>' : '') +
                outcomesHtml +
                '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">pozo total: ' + totalPool + ' ℬ &middot; ' + m.betCount + ' apuestas &middot; cierra ' + formatClosesAt(m.closesAt) + '</div>' +
                '<div style="margin-top:10px;">' + actionsHtml + '</div>' +
                resolvePickerHtml;

            div.querySelectorAll("[data-action]").forEach((btn) => {
                btn.addEventListener("click", async () => {
                    const action = btn.getAttribute("data-action");
                    if (action === "resolve") {
                        div.querySelector("[data-resolve-picker]").style.display = "block";
                        return;
                    }
                    if (action === "confirm-resolve") {
                        const picked = div.querySelector('input[name="winner-' + m.id + '"]:checked');
                        if (!picked) { showError(panelError, "Elige un resultado ganador."); return; }
                        try {
                            await apiCall("/api/admin/beaumarket/resolve", "POST", { marketId: m.id, winningOutcomeIndex: Number(picked.value) });
                            loadMarkets();
                        } catch (err) { showError(panelError, err.message); }
                        return;
                    }
                    if (action === "close") {
                        try { await apiCall("/api/admin/beaumarket/close", "POST", { marketId: m.id }); loadMarkets(); }
                        catch (err) { showError(panelError, err.message); }
                        return;
                    }
                    if (action === "cancel") {
                        if (!confirm("¿Cancelar este mercado y reembolsar todas las posiciones vigentes?")) return;
                        try { await apiCall("/api/admin/beaumarket/cancel", "POST", { marketId: m.id }); loadMarkets(); }
                        catch (err) { showError(panelError, err.message); }
                        return;
                    }
                });
            });

            return div;
        }

        async function loadMarkets() {
            hideError(panelError);
            try {
                const data = await apiCall("/api/admin/beaumarket/list", "GET");
                marketsList.innerHTML = "";
                if (!data.markets.length) {
                    marketsList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Todavía no hay mercados.</p>';
                    return;
                }
                data.markets.forEach((m) => marketsList.appendChild(renderMarket(m)));
            } catch (err) { showError(panelError, err.message); }
        }

        // Al final del script a propósito: gateSession usa showPanel()/showLogin(), que a
        // su vez usan loadMarkets() — si corriera antes de esas declaraciones, revienta
        // por temporal dead zone en cada carga con un token ya guardado (o sea, en toda
        // carga después del primer login). Mismo motivo documentado en team_schedule.pb.js.
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

routerAdd("GET", "/api/admin/beaumarket/list", (e) => {
    try {
        const { poolPercentages } = require(`${__hooks}/lib/beaumarket.js`);
        const markets = $app.findRecordsByFilter("beaumarkets", "", "-created", 200, 0);

        // betCount es solo un número en pantalla, pero antes se traían TODAS las filas
        // de apuestas de cada mercado (hasta 200 consultas sin límite) únicamente para
        // leer su .length. Un solo agregado lo resuelve. Ver auditoria-2026-08-19.md §4.2.
        const betCounts = {};
        try {
            const rows = arrayOf(new DynamicModel({ market: "", total: 0 }));
            $app.db()
                .newQuery("SELECT market, COUNT(*) AS total FROM beaumarket_trades GROUP BY market")
                .all(rows);
            rows.forEach((r) => { betCounts[r.market] = r.total; });
        } catch (err) {
            // Si el agregado falla, el panel se sigue mostrando con el contador en 0 en
            // vez de caerse entero: es un dato informativo, no el propósito de la vista.
            console.error("[beaumarket.pb.js] No se pudo contar apuestas por mercado:", err);
        }

        const result = markets.map((m) => {
            const outcomes = JSON.parse(m.getString("outcomes") || "[]");
            const pool = JSON.parse(m.getString("pool") || "[]");
            return {
                id: m.id,
                title: m.getString("title"),
                description: m.getString("description"),
                outcomes,
                status: m.getString("status"),
                winningOutcomeIndex: m.getString("status") === "resolved" ? m.getInt("winningOutcomeIndex") : null,
                closesAt: m.getString("closesAt"),
                pool,
                prices: poolPercentages(pool),
                betCount: betCounts[m.id] || 0,
            };
        });
        return e.json(200, { markets: result });
    } catch (err) {
        console.error("[beaumarket.pb.js] Error en GET /api/admin/beaumarket/list:", err);
        return e.json(500, { error: "No se pudo cargar la lista." });
    }
}, $apis.requireSuperuserAuth());

routerAdd("POST", "/api/admin/beaumarket/create", (e) => {
    try {
        const { MIN_OUTCOMES, MAX_OUTCOMES } = require(`${__hooks}/lib/beaumarket.js`);
        const body = e.requestInfo().body || {};
        const title = String(body.title || "").trim();
        const description = String(body.description || "").trim();
        const outcomes = Array.isArray(body.outcomes)
            ? body.outcomes.map((o) => String(o).trim()).filter(Boolean)
            : [];
        const closesAt = String(body.closesAt || "");

        if (!title) throw new BadRequestError("El título es requerido.");
        if (outcomes.length < MIN_OUTCOMES || outcomes.length > MAX_OUTCOMES) {
            throw new BadRequestError(`Debe haber entre ${MIN_OUTCOMES} y ${MAX_OUTCOMES} resultados.`);
        }
        const closesAtDate = closesAt ? new Date(closesAt) : null;
        if (!closesAtDate || isNaN(closesAtDate.getTime()) || closesAtDate.getTime() <= Date.now()) {
            throw new BadRequestError("La fecha de cierre debe ser una fecha futura válida.");
        }

        const market = new Record($app.findCollectionByNameOrId("beaumarkets"));
        market.set("title", title);
        market.set("description", description);
        market.set("outcomes", JSON.stringify(outcomes));
        market.set("status", "open");
        market.set("closesAt", closesAtDate.toISOString());
        market.set("pool", JSON.stringify(new Array(outcomes.length).fill(0)));
        $app.save(market);

        return e.json(200, { success: true, id: market.id });
    } catch (err) {
        console.error("[beaumarket.pb.js] Error en POST /api/admin/beaumarket/create:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo crear el mercado." });
    }
}, $apis.requireSuperuserAuth());

routerAdd("POST", "/api/admin/beaumarket/close", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const market = $app.findRecordById("beaumarkets", String(body.marketId || ""));
        if (market.getString("status") !== "open") {
            throw new BadRequestError("Solo se puede cerrar un mercado abierto.");
        }
        market.set("status", "closed");
        $app.save(market);
        return e.json(200, { success: true });
    } catch (err) {
        console.error("[beaumarket.pb.js] Error en POST /api/admin/beaumarket/close:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cerrar el mercado." });
    }
}, $apis.requireSuperuserAuth());

// POST /api/admin/beaumarket/resolve — reparte el pozo total entre las posiciones del
// resultado ganador, a prorrata de lo que apostó cada quien (ver finalPayout en
// lib/beaumarket.js). El pozo ya no cambia después de esto, así que el pago es un cálculo
// puro y determinista sobre el estado guardado.
routerAdd("POST", "/api/admin/beaumarket/resolve", (e) => {
    try {
        const { finalPayout } = require(`${__hooks}/lib/beaumarket.js`);
        const body = e.requestInfo().body || {};
        const marketId = String(body.marketId || "");
        const winningOutcomeIndex = Number.isInteger(body.winningOutcomeIndex) ? body.winningOutcomeIndex : -1;

        $app.runInTransaction((txApp) => {
            const market = txApp.findRecordById("beaumarkets", marketId);
            const status = market.getString("status");
            if (status !== "open" && status !== "closed") {
                throw new BadRequestError("Este mercado ya no puede resolverse.");
            }

            const outcomes = JSON.parse(market.getString("outcomes") || "[]");
            if (winningOutcomeIndex < 0 || winningOutcomeIndex >= outcomes.length) {
                throw new BadRequestError("Resultado ganador inválido.");
            }

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
        });

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[beaumarket.pb.js] Error en POST /api/admin/beaumarket/resolve:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo resolver el mercado." });
    }
}, $apis.requireSuperuserAuth());

// POST /api/admin/beaumarket/cancel — reembolsa cada posición vigente (en cualquier
// resultado) su monto exacto, 1:1 — en pari-mutuel nunca hace falta calcular un neto
// "justo" sobre un historial de compras/ventas, porque lo que se apostó siempre fue
// exactamente lo que se puso.
routerAdd("POST", "/api/admin/beaumarket/cancel", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const marketId = String(body.marketId || "");

        $app.runInTransaction((txApp) => {
            const market = txApp.findRecordById("beaumarkets", marketId);
            const status = market.getString("status");
            if (status !== "open" && status !== "closed") {
                throw new BadRequestError("Este mercado ya no puede cancelarse.");
            }

            const positions = txApp.findRecordsByFilter("beaumarket_positions", "market = {:m}", "", 0, 0, { m: marketId });
            positions.forEach((pos) => {
                const amount = pos.getInt("amount");
                if (amount > 0) {
                    txApp.db()
                        .newQuery("UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:amt} WHERE id = {:id}")
                        .bind({ amt: amount, id: pos.getString("user") })
                        .execute();
                }
            });

            market.set("status", "cancelled");
            txApp.save(market);
        });

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[beaumarket.pb.js] Error en POST /api/admin/beaumarket/cancel:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cancelar el mercado." });
    }
}, $apis.requireSuperuserAuth());
