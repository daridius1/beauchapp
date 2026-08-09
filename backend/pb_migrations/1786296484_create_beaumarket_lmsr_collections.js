/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    // Limpieza de las colecciones pari-mutuel viejas (creadas por las 3 migraciones que
    // se borraron de este directorio al cambiar a LMSR) — "beaumarkets" se vuelve a
    // crear más abajo con un esquema distinto, así que hace falta sacar la vieja primero
    // para no chocar por nombre repetido. Nada de esto llegó nunca a producción (era
    // data de prueba de esta sesión), así que no hay nada que migrar/preservar. Se
    // ignoran errores si el ambiente ya está limpio (ej. nunca se llegó a aplicar la
    // migración vieja).
    try { app.delete(app.findCollectionByNameOrId("beaumarket_bets")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("beaumarkets")); } catch (e) {}

    const usersColl = app.findCollectionByNameOrId("users");

    // 1. beaumarkets — un mercado de predicción con market maker automático (LMSR).
    // "b" es el parámetro de liquidez (lo elige el admin al crear, define qué tan fuerte
    // se mueve el precio por cada operación y la pérdida máxima teórica de la casa,
    // b*ln(n)). "q" es el vector de acciones netas en circulación por resultado — arranca
    // en ceros (precio uniforme 1/n) y lo actualizan las rutas de compra/venta dentro de
    // una transacción, nunca directo por REST (createRule/updateRule/deleteRule = null).
    const beaumarkets = new Collection({
        name: "beaumarkets",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "title",
                type: "text",
                required: true,
                max: 200
            },
            {
                name: "description",
                type: "text",
                required: false,
                max: 2000
            },
            {
                // ["Opción A", "Opción B", ...] — 2 a 10 resultados, validado en la ruta
                // de creación (no en el esquema).
                name: "outcomes",
                type: "json",
                required: true,
                maxSize: 4000
            },
            {
                name: "status",
                type: "select",
                required: true,
                maxSelect: 1,
                values: ["open", "closed", "resolved", "cancelled"]
            },
            {
                // Índice dentro de "outcomes". Se llena recién al resolver — nunca antes.
                name: "winningOutcomeIndex",
                type: "number",
                required: false,
                min: 0,
                noDecimal: true
            },
            {
                // Parámetro de liquidez LMSR. required:false por el mismo motivo de
                // siempre (un number required en 0 falla "cannot be blank"), aunque acá
                // en la práctica nunca es 0 — la ruta de creación exige 5..500.
                name: "b",
                type: "number",
                required: false,
                min: 1,
                noDecimal: true
            },
            {
                // [q0, q1, ...] — un valor por resultado, siempre enteros (solo se opera
                // en acciones enteras). Arranca en [0,0,...].
                name: "q",
                type: "json",
                required: false,
                maxSize: 4000
            },
            { id: "bmk_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "bmk_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE INDEX idx_beaumarkets_status ON beaumarkets (status)"
        ]
    });
    app.save(beaumarkets);
    const savedBeaumarkets = app.findCollectionByNameOrId("beaumarkets");

    // 2. beaumarket_trades — log de operaciones de compra/venta (reemplaza el viejo
    // "beaumarket_bets" pari-mutuel — ya no son apuestas fijas, son trades contra el
    // market maker). De acá se reconstruye el gráfico de precio en el tiempo, igual que
    // antes se reconstruía desde las apuestas. listRule/viewRule solo al dueño — el
    // precio agregado del mercado lo sirve GET /api/beaumarket/markets desde
    // beaumarkets.q directamente, sin necesitar leer las filas de otros usuarios.
    const beaumarketTrades = new Collection({
        name: "beaumarket_trades",
        type: "base",
        listRule: "@request.auth.id != '' && @request.auth.id = user",
        viewRule: "@request.auth.id != '' && @request.auth.id = user",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "market",
                type: "relation",
                required: true,
                collectionId: savedBeaumarkets.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "user",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                // required:false — el primer resultado tiene índice 0 (mismo motivo de
                // siempre: un number required en 0 falla "cannot be blank").
                name: "outcomeIndex",
                type: "number",
                required: false,
                min: 0,
                noDecimal: true
            },
            {
                // Positivo = compra, negativo = venta. Siempre entero, nunca 0.
                name: "sharesDelta",
                type: "number",
                required: true,
                noDecimal: true
            },
            {
                // Puntos que cambiaron de mano: positivo = el usuario pagó, negativo =
                // recibió. required:false porque en teoría podría redondear a 0 en un
                // trade minúsculo (no debería pasar con montos mínimos razonables, pero
                // no hay motivo para que el esquema lo prohíba).
                name: "cost",
                type: "number",
                required: false,
                noDecimal: true
            },
            { id: "bmt_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "bmt_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE INDEX idx_beaumarket_trades_market ON beaumarket_trades (market, created)",
            "CREATE INDEX idx_beaumarket_trades_market_user ON beaumarket_trades (market, user, created)"
        ]
    });
    app.save(beaumarketTrades);

    // 3. beaumarket_positions — cuántas acciones tiene ahora mismo cada usuario en cada
    // resultado de cada mercado. Una fila por posición (índice único), se actualiza en
    // el lugar en cada compra/venta dentro de la misma transacción que actualiza
    // beaumarkets.q — nunca queda desincronizada porque las escrituras van juntas.
    const beaumarketPositions = new Collection({
        name: "beaumarket_positions",
        type: "base",
        listRule: "@request.auth.id != '' && @request.auth.id = user",
        viewRule: "@request.auth.id != '' && @request.auth.id = user",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "market",
                type: "relation",
                required: true,
                collectionId: savedBeaumarkets.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "user",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "outcomeIndex",
                type: "number",
                required: false,
                min: 0,
                noDecimal: true
            },
            {
                // required:false porque nunca debería ser 0 en régimen (se borra la fila
                // si la posición llega a 0), pero podría pasar por una fracción de
                // segundo dentro de la transacción antes de decidir borrar o no.
                name: "shares",
                type: "number",
                required: false,
                min: 0,
                noDecimal: true
            },
            { id: "bmp_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "bmp_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_beaumarket_positions_unique ON beaumarket_positions (market, user, outcomeIndex)"
        ]
    });
    app.save(beaumarketPositions);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("beaumarket_positions")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("beaumarket_trades")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("beaumarkets")); } catch (e) {}
});
