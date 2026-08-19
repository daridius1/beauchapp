/// <reference path="../pb_data/types.d.ts" />

// Beaumarket: mercados de predicción con puntos (BeauTokens, símbolo ℬ, jugado
// únicamente sobre users.beautokens, nunca dinero real), con un market maker automático LMSR
// (Logarithmic Market Scoring Rule) en vez de pari-mutuel — el precio de cada resultado
// se mueve solo con la actividad de compra/venta, así que siempre hay motivo para volver
// a mirar/operar un mercado (no hace falta esperar a que otra persona apueste para que
// el gráfico se mueva). La garantía anti-abuso central es matemática, no una regla
// inventada: la pérdida máxima de la casa en un mercado, sin importar qué tan
// adversarial sea el trading, está acotada por b*ln(n) (b = liquidez elegida por el
// admin al crear, n = cantidad de resultados) — ver lib/beaumarket.js.
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

// GET /api/beaumarket/markets — lista de mercados con precios LMSR calculados en vivo
// desde q/b (ninguna agregación de filas necesaria, más barato que el pari-mutuel
// anterior) y, si el usuario tiene posiciones abiertas, incluidas. Con ?id=<marketId>
// devuelve solo ese mercado, con "history" incluido (la oscilación de precios trade a
// trade, para el gráfico tipo Polymarket) — no se calcula para la lista completa a
// propósito, para no pagar ese costo extra en cada carga de la pantalla de lista.
routerAdd("GET", "/api/beaumarket/markets", (e) => {
    try {
        const { prices, computeLmsrPriceHistory, MAX_CHART_POINTS } = require(`${__hooks}/lib/beaumarket.js`);
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

        // Antes acá había un N+1: por CADA mercado (hasta 100) se hacían dos consultas
        // sin límite para traer las posiciones y los trades propios, o sea ~200 consultas
        // por carga de la pantalla y por usuario. Ahora son dos consultas totales,
        // filtradas por el conjunto de ids ya cargados y agrupadas en memoria — el mismo
        // patrón que PRINCIPLES.md §1 documenta para la cadena de ancestros de un hilo.
        // Ver auditoria-2026-08-19.md §4.2.
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

        // Paginación real: la cantidad de trades de un usuario no tiene techo natural,
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

        // { marketId: { outcomeIndex: shares } } y { marketId: { outcomeIndex: netInvested } }
        const sharesByMarket = {};
        const netInvestedByMarket = {};

        if (marketIds.length > 0) {
            const posQuery = buildMarketFilter(marketIds, " && user = {:u}");
            findAllPaged("beaumarket_positions", posQuery.filter, posQuery.bind).forEach((p) => {
                const mid = p.getString("market");
                if (!sharesByMarket[mid]) sharesByMarket[mid] = {};
                sharesByMarket[mid][p.getInt("outcomeIndex")] = p.getInt("shares");
            });

            // netInvested = neto de caja histórico de esta posición: suma de "cost" de
            // todos los trades propios en ese resultado (positivo al comprar, negativo al
            // vender — ver POST /buy y /sell). A diferencia de un costo promedio
            // ponderado, esto SÍ puede quedar en negativo si ya vendiste una parte de la
            // posición recibiendo más de lo que gastaste en total (estás "jugando con
            // ganancia ya realizada") — a propósito, es justamente lo que se quiere
            // mostrar: cuánta plata neta llevas puesta en esta apuesta ahora mismo, no un
            // piso artificial en 0. Se consulta siempre (no solo si hay posición vigente)
            // porque un resultado puede tener historial de trades sin tener ya ninguna
            // acción (se vendió todo, la posición se borra al llegar a 0 en /sell) — igual
            // debe mostrarse cuánto llevas invertido en él.
            const tradesQuery = buildMarketFilter(marketIds, " && user = {:u}");
            findAllPaged("beaumarket_trades", tradesQuery.filter, tradesQuery.bind).forEach((t) => {
                const mid = t.getString("market");
                if (!netInvestedByMarket[mid]) netInvestedByMarket[mid] = {};
                const idx = t.getInt("outcomeIndex");
                netInvestedByMarket[mid][idx] = (netInvestedByMarket[mid][idx] || 0) + t.getInt("cost");
            });
        }

        const result = markets.map((m) => {
            const outcomes = JSON.parse(m.getString("outcomes") || "[]");
            const b = m.getFloat("b");
            const q = JSON.parse(m.getString("q") || "[]");
            const marketPrices = prices(q, b).map((p) => p * 100);

            const netInvestedByOutcome = netInvestedByMarket[m.id] || {};

            const sharesByOutcome = sharesByMarket[m.id] || {};

            // Unión de resultados con acciones vigentes y resultados con historial de
            // trades (aunque ya no tengan acciones) — cada uno de estos es "una apuesta
            // que hice" y debe tener su barra en el front, no solo las abiertas.
            const outcomeIndexes = new Set([
                ...Object.keys(sharesByOutcome).map(Number),
                ...Object.keys(netInvestedByOutcome).map(Number),
            ]);
            const myPositions = Array.from(outcomeIndexes).sort((a, b) => a - b).map((outcomeIndex) => ({
                outcomeIndex,
                shares: sharesByOutcome[outcomeIndex] || 0,
                netInvested: netInvestedByOutcome[outcomeIndex] || 0,
            }));

            let history;
            if (singleId) {
                // El eje X del gráfico es tiempo real: desde que se creó el mercado hasta
                // ahora (o hasta que se resolvió/canceló, si ya terminó — no tiene
                // sentido seguir "avanzando" el gráfico después de eso).
                // getDateTime(...).unix() evita parsear a mano el string de fecha de
                // PocketBase.
                const rangeStartMs = m.getDateTime("created").unix() * 1000;
                const isFinished = m.getString("status") === "resolved" || m.getString("status") === "cancelled";
                const rangeEndMs = isFinished ? (m.getDateTime("updated").unix() * 1000) : Date.now();
                // Solo en la vista de detalle (un mercado), y paginado: el volumen de
                // trades de un mercado no tiene techo. Ver auditoria-2026-08-19.md §4.2.
                const trades = findAllPaged("beaumarket_trades", "market = {:id}", { id: m.id }, "created");
                const plainTrades = trades.map((t) => ({
                    outcomeIndex: t.getInt("outcomeIndex"),
                    sharesDelta: t.getInt("sharesDelta"),
                    createdAtMs: t.getDateTime("created").unix() * 1000,
                }));
                history = computeLmsrPriceHistory(plainTrades, outcomes.length, b, rangeStartMs, rangeEndMs, MAX_CHART_POINTS);
            }

            return {
                id: m.id,
                title: m.getString("title"),
                description: m.getString("description"),
                outcomes,
                status: m.getString("status"),
                winningOutcomeIndex: m.getString("status") === "resolved" ? m.getInt("winningOutcomeIndex") : null,
                b,
                q,
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

// POST /api/beaumarket/buy — body {marketId, outcomeIndex, budgetPoints}. Trade
// denominado en puntos (cuánto quiero gastar), no en acciones — más natural para el
// usuario ("quiero apostar 50 puntos" en vez de "quiero comprar 6.3 acciones"). Se
// compra la mayor cantidad ENTERA de acciones que ese presupuesto alcanza (sin venta en
// corto, sin fracciones), y se cobra el costo EXACTO de esa cantidad entera, redondeado
// hacia arriba (a favor de la casa) — nunca se cobra menos de lo que cuesta ni se
// permite gastar más del presupuesto declarado.
routerAdd("POST", "/api/beaumarket/buy", (e) => {
    try {
        const { costForShares, sharesForBudget } = require(`${__hooks}/lib/beaumarket.js`);
        const body = e.requestInfo().body || {};
        const marketId = String(body.marketId || "");
        const outcomeIndex = Number.isInteger(body.outcomeIndex) ? body.outcomeIndex : -1;
        const budgetPoints = Number.isInteger(body.budgetPoints) ? body.budgetPoints : 0;

        if (!marketId || outcomeIndex < 0 || budgetPoints <= 0) {
            throw new BadRequestError("Datos de compra inválidos.");
        }

        let result = null;

        $app.runInTransaction((txApp) => {
            const market = txApp.findRecordById("beaumarkets", marketId);
            if (market.getString("status") !== "open") {
                throw new BadRequestError("Este mercado no está abierto para operar.");
            }

            // Cooldown anti-flood: no es una defensa "de plata" (esa ya la da la cota
            // b*ln(n) de LMSR), es solo para que un script no pueda saturar la ruta de
            // trading. Se inlinea acá (en vez de una función de nivel de archivo) porque
            // el JSVM no conserva referencias de nivel de archivo entre callbacks
            // registrados por separado — mismo patrón ya establecido en este archivo.
            const lastTrade = txApp.findRecordsByFilter(
                "beaumarket_trades", "market = {:m} && user = {:u}", "-created", 1, 0,
                { m: marketId, u: e.auth.id }
            );
            if (lastTrade.length > 0) {
                const waitMs = 3000 - (Date.now() - lastTrade[0].getDateTime("created").unix() * 1000);
                if (waitMs > 0) {
                    throw new BadRequestError(`Espera ${Math.ceil(waitMs / 1000)}s antes de operar de nuevo en este mercado.`);
                }
            }

            const outcomes = JSON.parse(market.getString("outcomes") || "[]");
            if (outcomeIndex >= outcomes.length) {
                throw new BadRequestError("Resultado inválido.");
            }

            const b = market.getFloat("b");
            const q = JSON.parse(market.getString("q") || "[]");

            const rawShares = sharesForBudget(q, b, outcomeIndex, budgetPoints);
            const shares = Math.floor(rawShares);
            if (!(shares > 0)) {
                throw new BadRequestError("Tu presupuesto no alcanza para comprar ni una acción entera al precio actual.");
            }
            const exactCost = costForShares(q, b, outcomeIndex, shares);
            const cost = Math.ceil(exactCost); // a favor de la casa: nunca se cobra menos de lo real

            const res = txApp.db()
                .newQuery("UPDATE users SET beautokens = beautokens - {:amt} WHERE id = {:id} AND beautokens >= {:amt}")
                .bind({ amt: cost, id: e.auth.id })
                .execute();
            if (res.rowsAffected() === 0) {
                throw new BadRequestError("Saldo insuficiente de BeauTokens.");
            }

            q[outcomeIndex] += shares;
            market.set("q", JSON.stringify(q));
            txApp.save(market);

            const existing = txApp.findRecordsByFilter(
                "beaumarket_positions", "market = {:m} && user = {:u} && outcomeIndex = {:o}", "", 1, 0,
                { m: marketId, u: e.auth.id, o: outcomeIndex }
            );
            if (existing.length > 0) {
                const pos = existing[0];
                pos.set("shares", pos.getInt("shares") + shares);
                txApp.save(pos);
            } else {
                const pos = new Record(txApp.findCollectionByNameOrId("beaumarket_positions"));
                pos.set("market", marketId);
                pos.set("user", e.auth.id);
                pos.set("outcomeIndex", outcomeIndex);
                pos.set("shares", shares);
                txApp.save(pos);
            }

            const trade = new Record(txApp.findCollectionByNameOrId("beaumarket_trades"));
            trade.set("market", marketId);
            trade.set("user", e.auth.id);
            trade.set("outcomeIndex", outcomeIndex);
            trade.set("sharesDelta", shares);
            trade.set("cost", cost);
            txApp.save(trade);

            result = { shares, cost };
        });

        return e.json(200, { success: true, shares: result.shares, cost: result.cost });
    } catch (err) {
        console.error("[beaumarket.pb.js] Error en POST /api/beaumarket/buy:", err);
        const msg = (err && err.message) || "No se pudo completar la compra.";
        return e.json(400, { error: msg });
    }
}, $apis.requireAuth("users"));

// POST /api/beaumarket/sell — body {marketId, outcomeIndex, shares}. Trade denominado en
// acciones (cuántas quiero vender) — a diferencia de comprar, acá el usuario sí conoce
// la cantidad exacta que tiene (se la mostramos en el modal de venta). Nunca se puede
// vender más de lo que se tiene en la posición (sin venta en corto), así que no hay
// forma de terminar un mercado debiendo puntos.
routerAdd("POST", "/api/beaumarket/sell", (e) => {
    try {
        const { costForShares } = require(`${__hooks}/lib/beaumarket.js`);
        const body = e.requestInfo().body || {};
        const marketId = String(body.marketId || "");
        const outcomeIndex = Number.isInteger(body.outcomeIndex) ? body.outcomeIndex : -1;
        const sharesToSell = Number.isInteger(body.shares) ? body.shares : 0;

        if (!marketId || outcomeIndex < 0 || sharesToSell <= 0) {
            throw new BadRequestError("Datos de venta inválidos.");
        }

        let result = null;

        $app.runInTransaction((txApp) => {
            const market = txApp.findRecordById("beaumarkets", marketId);
            if (market.getString("status") !== "open") {
                throw new BadRequestError("Este mercado no está abierto para operar.");
            }

            const lastTrade = txApp.findRecordsByFilter(
                "beaumarket_trades", "market = {:m} && user = {:u}", "-created", 1, 0,
                { m: marketId, u: e.auth.id }
            );
            if (lastTrade.length > 0) {
                const waitMs = 3000 - (Date.now() - lastTrade[0].getDateTime("created").unix() * 1000);
                if (waitMs > 0) {
                    throw new BadRequestError(`Espera ${Math.ceil(waitMs / 1000)}s antes de operar de nuevo en este mercado.`);
                }
            }

            const positions = txApp.findRecordsByFilter(
                "beaumarket_positions", "market = {:m} && user = {:u} && outcomeIndex = {:o}", "", 1, 0,
                { m: marketId, u: e.auth.id, o: outcomeIndex }
            );
            const position = positions[0];
            const heldShares = position ? position.getInt("shares") : 0;
            if (sharesToSell > heldShares) {
                throw new BadRequestError("No tienes esa cantidad de acciones en este resultado.");
            }

            const b = market.getFloat("b");
            const q = JSON.parse(market.getString("q") || "[]");

            const exactProceeds = -costForShares(q, b, outcomeIndex, -sharesToSell);
            const proceeds = Math.floor(exactProceeds); // a favor de la casa: nunca se paga de más

            txApp.db()
                .newQuery("UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:amt} WHERE id = {:id}")
                .bind({ amt: proceeds, id: e.auth.id })
                .execute();

            q[outcomeIndex] -= sharesToSell;
            market.set("q", JSON.stringify(q));
            txApp.save(market);

            const remaining = heldShares - sharesToSell;
            if (remaining > 0) {
                position.set("shares", remaining);
                txApp.save(position);
            } else {
                txApp.delete(position);
            }

            const trade = new Record(txApp.findCollectionByNameOrId("beaumarket_trades"));
            trade.set("market", marketId);
            trade.set("user", e.auth.id);
            trade.set("outcomeIndex", outcomeIndex);
            trade.set("sharesDelta", -sharesToSell);
            trade.set("cost", -proceeds);
            txApp.save(trade);

            result = { shares: sharesToSell, proceeds };
        });

        return e.json(200, { success: true, shares: result.shares, proceeds: result.proceeds });
    } catch (err) {
        console.error("[beaumarket.pb.js] Error en POST /api/beaumarket/sell:", err);
        const msg = (err && err.message) || "No se pudo completar la venta.";
        return e.json(400, { error: msg });
    }
}, $apis.requireAuth("users"));

// ---------------------------------------------------------------------------------
// Administración (vista tipo /admin/generate-link, sin gate de auth en el GET —
// la seguridad real vive en las rutas POST/GET de acción, todas con requireSuperuserAuth()).
// ---------------------------------------------------------------------------------

routerAdd("GET", "/admin/beaumarket", (e) => {
    const { PALETTE_CSS, clientEscapeHtmlFn } = require(`${__hooks}/lib/adminUi.js`);
    const ESC_FN = clientEscapeHtmlFn();

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
        input[type="text"], input[type="email"], input[type="password"], input[type="number"], textarea {
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
            <form id="loginForm">
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
                    <label>Liquidez (b)</label>
                    <input type="number" id="newB" min="5" max="500" value="30" required>
                    <div class="hint" id="maxLossHint"></div>
                </div>
                <button type="submit" class="btn" id="createBtn">Crear mercado</button>
            </form>
        </div>

        <h2>Mercados existentes</h2>
        <div id="marketsList"></div>
    </div>

    <script>
        let token = "";
        try {
            const authData = JSON.parse(localStorage.getItem("pb_auth") || localStorage.getItem("pocketbase_auth"));
            if (authData && authData.token) token = authData.token;
        } catch (e) {}

        const loginPage = document.getElementById("loginPage");
        const panelPage = document.getElementById("panelPage");
        const loginError = document.getElementById("loginError");
        const panelError = document.getElementById("panelError");

        function showError(el, msg) { el.textContent = msg; el.style.display = "block"; }
        function hideError(el) { el.style.display = "none"; }

        // Título, descripción y etiquetas de resultado de un mercado son texto libre.
        // Hoy solo los escribe el propio superusuario desde esta página (self-XSS), pero
        // renderMarket los mete en innerHTML, así que se escapan igual: es la misma clase
        // de bug que sí era explotable cross-user en /admin/liga (auditoria-2026-08-19.md
        // §3.1 y §5.2). La función esc() viene de lib/adminUi.js — una sola definición
        // para todas las páginas de administración, en vez de una copia por página.
        ${ESC_FN}

        // --- Formulario de creación: lista dinámica de resultados + hint de pérdida máxima ---
        const outcomesList = document.getElementById("outcomesList");
        function addOutcomeRow(value) {
            const row = document.createElement("div");
            row.className = "outcome-row";
            row.innerHTML = '<input type="text" placeholder="Resultado" value="' + esc(value) + '">' +
                '<button type="button" class="btn btn-secondary btn-sm" style="margin:0;">Quitar</button>';
            row.querySelector("button").addEventListener("click", () => {
                if (outcomesList.children.length > 2) { row.remove(); updateMaxLossHint(); }
            });
            row.querySelector("input").addEventListener("input", updateMaxLossHint);
            outcomesList.appendChild(row);
            updateMaxLossHint();
        }
        function updateMaxLossHint() {
            const n = outcomesList.querySelectorAll("input").length;
            const b = Number(document.getElementById("newB").value) || 0;
            const maxLoss = b * Math.log(n);
            document.getElementById("maxLossHint").textContent =
                "Pérdida máxima teórica de la casa en este mercado: " + maxLoss.toFixed(1) + " ℬ";
        }
        addOutcomeRow("Sí");
        addOutcomeRow("No");
        document.getElementById("newB").addEventListener("input", updateMaxLossHint);
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
            const b = Number(document.getElementById("newB").value);
            createBtn.disabled = true;
            try {
                await apiCall("/api/admin/beaumarket/create", "POST", { title, description, outcomes, b });
                document.getElementById("createForm").reset();
                outcomesList.innerHTML = "";
                addOutcomeRow("Sí"); addOutcomeRow("No");
                document.getElementById("newB").value = 30;
                updateMaxLossHint();
                loadMarkets();
            } catch (err) { showError(panelError, err.message); }
            finally { createBtn.disabled = false; }
        });

        // --- Listado de mercados ---
        const marketsList = document.getElementById("marketsList");

        function renderMarket(m) {
            const div = document.createElement("div");
            div.className = "card";
            let outcomesHtml = m.outcomes.map((label, idx) => {
                const pct = m.prices[idx] || 0;
                const isWinner = m.status === "resolved" && m.winningOutcomeIndex === idx;
                return '<div class="outcome-line' + (isWinner ? ' winner' : '') + '">' +
                    '<span>' + (isWinner ? '🏆 ' : '') + esc(label) + '</span>' +
                    '<span>' + pct.toFixed(1) + '%</span></div>';
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

            const maxLoss = m.b * Math.log(m.outcomes.length);
            div.innerHTML =
                '<span class="status-badge status-' + esc(m.status) + '">' + esc(m.status) + '</span>' +
                '<div class="market-title">' + esc(m.title) + '</div>' +
                (m.description ? '<div class="market-desc">' + esc(m.description) + '</div>' : '') +
                outcomesHtml +
                '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">b=' + m.b + ' &middot; pérdida máx.: ' + maxLoss.toFixed(1) + ' ℬ &middot; ' + m.tradeCount + ' operaciones</div>' +
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
    </script>
</body>
</html>
    `;
    return e.html(200, htmlContent);
});

routerAdd("GET", "/api/admin/beaumarket/list", (e) => {
    try {
        const { prices } = require(`${__hooks}/lib/beaumarket.js`);
        const markets = $app.findRecordsByFilter("beaumarkets", "", "-created", 200, 0);

        // tradeCount es solo un número en pantalla, pero antes se traían TODAS las filas
        // de trades de cada mercado (hasta 200 consultas sin límite) únicamente para leer
        // su .length. Un solo agregado lo resuelve. Ver auditoria-2026-08-19.md §4.2.
        const tradeCounts = {};
        try {
            const rows = arrayOf(new DynamicModel({ market: "", total: 0 }));
            $app.db()
                .newQuery("SELECT market, COUNT(*) AS total FROM beaumarket_trades GROUP BY market")
                .all(rows);
            rows.forEach((r) => { tradeCounts[r.market] = r.total; });
        } catch (err) {
            // Si el agregado falla, el panel se sigue mostrando con el contador en 0 en
            // vez de caerse entero: es un dato informativo, no el propósito de la vista.
            console.error("[beaumarket.pb.js] No se pudo contar trades por mercado:", err);
        }

        const result = markets.map((m) => {
            const outcomes = JSON.parse(m.getString("outcomes") || "[]");
            const b = m.getFloat("b");
            const q = JSON.parse(m.getString("q") || "[]");
            return {
                id: m.id,
                title: m.getString("title"),
                description: m.getString("description"),
                outcomes,
                status: m.getString("status"),
                winningOutcomeIndex: m.getString("status") === "resolved" ? m.getInt("winningOutcomeIndex") : null,
                b,
                prices: prices(q, b).map((p) => p * 100),
                tradeCount: tradeCounts[m.id] || 0,
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
        const { MIN_OUTCOMES, MAX_OUTCOMES, MIN_B, MAX_B, DEFAULT_B } = require(`${__hooks}/lib/beaumarket.js`);
        const body = e.requestInfo().body || {};
        const title = String(body.title || "").trim();
        const description = String(body.description || "").trim();
        const outcomes = Array.isArray(body.outcomes)
            ? body.outcomes.map((o) => String(o).trim()).filter(Boolean)
            : [];
        const b = Number.isFinite(body.b) ? body.b : DEFAULT_B;

        if (!title) throw new BadRequestError("El título es requerido.");
        if (outcomes.length < MIN_OUTCOMES || outcomes.length > MAX_OUTCOMES) {
            throw new BadRequestError(`Debe haber entre ${MIN_OUTCOMES} y ${MAX_OUTCOMES} resultados.`);
        }
        if (b < MIN_B || b > MAX_B) {
            throw new BadRequestError(`La liquidez (b) debe estar entre ${MIN_B} y ${MAX_B}.`);
        }

        const market = new Record($app.findCollectionByNameOrId("beaumarkets"));
        market.set("title", title);
        market.set("description", description);
        market.set("outcomes", JSON.stringify(outcomes));
        market.set("status", "open");
        market.set("b", b);
        market.set("q", JSON.stringify(new Array(outcomes.length).fill(0)));
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

// POST /api/admin/beaumarket/resolve — a diferencia del pari-mutuel anterior (repartir un
// pot), acá el pago es directo: cada acción del resultado ganador vale exactamente 1
// punto (así se definió el mecanismo LMSR desde el principio, comprar una acción a
// precio p es "apostar" a que vale 1 si gana). Sin redondeo posible: shares ya es entero.
routerAdd("POST", "/api/admin/beaumarket/resolve", (e) => {
    try {
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

            const positions = txApp.findRecordsByFilter(
                "beaumarket_positions", "market = {:m} && outcomeIndex = {:o}", "", 0, 0,
                { m: marketId, o: winningOutcomeIndex }
            );
            positions.forEach((pos) => {
                const shares = pos.getInt("shares");
                if (shares > 0) {
                    txApp.db()
                        .newQuery("UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:amt} WHERE id = {:id}")
                        .bind({ amt: shares, id: pos.getString("user") })
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
// resultado) a razón de 1 punto por acción, igual de simple que resolve — evita el caso
// ambiguo de tener que sumar el historial completo de compras/ventas de cada usuario
// para calcular un neto "justo".
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
                const shares = pos.getInt("shares");
                if (shares > 0) {
                    txApp.db()
                        .newQuery("UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:amt} WHERE id = {:id}")
                        .bind({ amt: shares, id: pos.getString("user") })
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
