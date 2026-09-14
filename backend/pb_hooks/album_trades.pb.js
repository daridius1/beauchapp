/// <reference path="../pb_data/types.d.ts" />

// Intercambios de figuritas: proponer → contraofertar → confirmar. Aparte de
// album.pb.js a propósito — es un ciclo de vida completo alrededor de una colección
// propia (album_trades), no una extensión del checklist del álbum, mismo criterio que
// separó organizations.pb.js de auth.pb.js. Cada routerAdd corre en su propia VM
// aislada (CLAUDE.md §2.1): todo require() va DENTRO del handler.
//
// El flujo tiene tres pasos y dos decisiones humanas, a propósito: no hay matchmaking
// automático ni "intercambiar todo lo que sobre con un botón".
//
//   1. A elige a B y N láminas SUYAS sueltas, y las ofrece.        → pending
//   2. B ve lo ofrecido y elige N láminas SUYAS sueltas a cambio.  → countered
//   3. A mira lo que B puso y confirma (o descarta).               → accepted
//
// Que A no nombre lo que quiere recibir no es una simplificación: es lo que hace
// innecesario ver el inventario ajeno. El 1x1 anterior obligaba a pedir una figurita
// puntual sin forma de saber si el otro la tenía, y su propio comentario lo admitía
// como agujero. Acá cada uno solo ofrece de lo propio, y el único dato del otro que
// hace falta es cuáles le faltan — lo sirve /counterparty-stock, para que B no
// contraoferte algo que A ya tiene.
//
// Solo se intercambian copias SUELTAS (sin pegar) — ver looseCount en lib/album.js:
// `count - (pasted ? 1 : 0)`. Las láminas NO se reservan mientras la propuesta está
// abierta: la misma repetida puede estar comprometida en varias propuestas a la vez y
// gana la primera que se confirme, porque reservarlas dejaría láminas congeladas por
// propuestas que nadie va a contestar. Por eso el confirm revalida ambos lados DENTRO
// de la transacción y falla con un mensaje explícito en vez de dar por buena la foto
// del momento en que se propuso.
//
// Rechazar, cancelar y desistir son todos $app.delete directo (POST /cancel, que
// aceptan las dos partes): no se guarda un status "rejected"/"cancelled", mismo
// precedente que organization_members y que el 1x1 original.

// El inventario suelto (código → copias ofrecibles) se arma inline en cada handler que
// lo necesita en vez de en una función compartida: cada routerAdd corre en su propia VM
// (CLAUDE.md §2.1) y esto hace $app.*. La lógica pura — contar repetidas, validar la
// lista, cruzarla contra el inventario — sí vive en lib/album.js, con tests.

// POST /api/album/trades — body {albumId, toUserId, offerCodes: ["0113", ...]}.
// Solo se ofrece; no se pide nada a cambio (ver el comentario grande de arriba).
routerAdd("POST", "/api/album/trades", (e) => {
    try {
        const { looseCount, normalizeTradeCodes, uncoveredCodes, MAX_PENDING_TRADES } = require(`${__hooks}/lib/album.js`);

        const body = e.requestInfo().body || {};
        const albumId = String(body.albumId || "");
        const toUserId = String(body.toUserId || "");
        if (!albumId || !toUserId) throw new BadRequestError("Faltan datos.");
        if (toUserId === e.auth.id) {
            throw new BadRequestError("No puedes proponerte un intercambio a ti mismo.");
        }

        const normalized = normalizeTradeCodes(body.offerCodes);
        if (normalized.error) throw new BadRequestError(normalized.error);
        const offerCodes = normalized.codes;

        let album;
        try {
            album = $app.findRecordById("albums", albumId);
        } catch (err) {
            throw new BadRequestError("Ese álbum no existe.");
        }
        if (!album.getBool("enabled")) {
            throw new BadRequestError("Ese álbum no está disponible.");
        }

        try {
            $app.findRecordById("users", toUserId);
        } catch (err) {
            throw new BadRequestError("Esa persona no existe.");
        }

        // Bloqueo en cualquiera de las dos direcciones (mismo patrón que games.pb.js y
        // tinder.pb.js): un intercambio es una interacción dirigida, no contenido que
        // alcance con esconder por listRule.
        let isBlocked = false;
        try {
            $app.findFirstRecordByFilter(
                "blocked_users",
                "(blocker = {:a} && blocked = {:b}) || (blocker = {:b} && blocked = {:a})",
                { a: e.auth.id, b: toUserId }
            );
            isBlocked = true;
        } catch (err) {
            // No hay bloqueo entre ambos
        }
        if (isBlocked) throw new BadRequestError("No puedes interactuar con esta persona.");

        // Tope de propuestas abiertas: sin reserva de láminas, nada más impide dejar
        // cientos de filas colgadas ofreciendo la misma repetida (PRINCIPLES.md §1).
        const openTrades = $app.findRecordsByFilter(
            "album_trades", "fromUser = {:u} && status != 'accepted'", "", MAX_PENDING_TRADES + 1, 0, { u: e.auth.id }
        );
        if (openTrades.length >= MAX_PENDING_TRADES) {
            throw new BadRequestError(`Ya tienes ${MAX_PENDING_TRADES} propuestas abiertas. Cierra alguna antes de mandar otra.`);
        }

        const looseByCode = {};
        $app.findRecordsByFilter(
            "album_stickers", "album = {:a} && user = {:u}", "", 1000, 0, { a: albumId, u: e.auth.id }
        ).forEach((s) => {
            looseByCode[s.getString("code")] = looseCount(s.getInt("count"), s.getBool("pasted"));
        });
        if (uncoveredCodes(offerCodes, looseByCode).length > 0) {
            throw new BadRequestError("No tienes copias sueltas suficientes de alguna de las láminas que elegiste.");
        }

        const trade = new Record($app.findCollectionByNameOrId("album_trades"));
        trade.set("album", albumId);
        trade.set("fromUser", e.auth.id);
        trade.set("toUser", toUserId);
        trade.set("offerCodes", JSON.stringify(offerCodes));
        trade.set("counterCodes", JSON.stringify([]));
        trade.set("status", "pending");
        $app.save(trade);

        try {
            const fromName = e.auth.getString("name") || e.auth.getString("username") || "Alguien";
            const cuantas = offerCodes.length === 1 ? "una lámina" : `${offerCodes.length} láminas`;
            const notif = new Record($app.findCollectionByNameOrId("notifications"));
            notif.set("user", toUserId);
            notif.set("sender", e.auth.id);
            notif.set("type", "trade_proposed");
            notif.set("title", "Nueva propuesta de intercambio");
            notif.set("body", `${fromName} te ofrece ${cuantas} del álbum. Elige qué darle a cambio.`);
            notif.set("read", false);
            notif.set("relatedId", albumId);
            $app.save(notif);
        } catch (err) {
            console.error("[album_trades.pb.js] Error creando notificación de propuesta:", err.message || err);
        }

        return e.json(200, { success: true, tradeId: trade.id });
    } catch (err) {
        console.error("[album_trades.pb.js] Error en POST /api/album/trades:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo enviar la propuesta." });
    }
}, $apis.requireAuth("users"));

// GET /api/album/trades?albumId= — propuestas ABIERTAS del usuario actual (pending y
// countered), en ambas direcciones. No resuelve los códigos a nombre/foto/equipo: el
// frontend ya tiene esa tabla completa desde GET /api/album y la cruza localmente
// (evitar una tercera copia de esa lógica de resolución, repartida en otra VM aislada
// más). Las aceptadas no vuelven: las láminas ya se movieron y se ven en el álbum.
routerAdd("GET", "/api/album/trades", (e) => {
    try {
        const { publicAccount } = require(`${__hooks}/lib/publicLeague.js`);

        const albumId = String(e.requestInfo().query["albumId"] || "");
        if (!albumId) throw new BadRequestError("Falta el id del álbum.");

        const rows = $app.findRecordsByFilter(
            "album_trades",
            "album = {:a} && status != 'accepted' && (fromUser = {:u} || toUser = {:u})",
            "-created", 500, 0, { a: albumId, u: e.auth.id }
        );

        const incoming = [];
        const outgoing = [];
        rows.forEach((r) => {
            const fromUserId = r.getString("fromUser");
            const toUserId = r.getString("toUser");
            const mine = toUserId === e.auth.id ? incoming : outgoing;
            const otherId = toUserId === e.auth.id ? fromUserId : toUserId;

            let counterparty = null;
            try { counterparty = publicAccount($app.findRecordById("users", otherId)); } catch (err) { /* borrado */ }

            mine.push({
                id: r.id,
                status: r.getString("status"),
                offerCodes: JSON.parse(r.getString("offerCodes") || "[]"),
                counterCodes: JSON.parse(r.getString("counterCodes") || "[]"),
                created: r.getString("created"),
                counterparty,
            });
        });

        return e.json(200, { incoming, outgoing });
    } catch (err) {
        console.error("[album_trades.pb.js] Error en GET /api/album/trades:", err);
        return e.json(400, { error: (err && err.message) || "No se pudieron cargar los intercambios." });
    }
}, $apis.requireAuth("users"));

// GET /api/album/trades/counterparty-stock?tradeId= — códigos que la OTRA parte ya
// tiene en ese álbum. Lo pide B al armar la contraoferta: sin esto elegiría a ciegas y
// la mitad de los intercambios devolvería algo que el otro ya tenía. Se sirve lo que
// tiene (no lo que le falta) porque es el dato crudo y el payload más chico — el
// frontend ya conoce el checklist completo y saca el complemento solo. Solo las dos
// partes de una propuesta abierta pueden pedirlo: es información del álbum de alguien
// más, y lo que la habilita es que esa persona abrió el intercambio.
routerAdd("GET", "/api/album/trades/counterparty-stock", (e) => {
    try {
        const tradeId = String(e.requestInfo().query["tradeId"] || "");
        if (!tradeId) throw new BadRequestError("Falta tradeId.");

        let trade;
        try {
            trade = $app.findFirstRecordByFilter(
                "album_trades",
                "id = {:id} && status != 'accepted' && (fromUser = {:u} || toUser = {:u})",
                { id: tradeId, u: e.auth.id }
            );
        } catch (err) {
            throw new BadRequestError("No tienes ninguna propuesta abierta con ese id.");
        }

        const otherId = trade.getString("fromUser") === e.auth.id ? trade.getString("toUser") : trade.getString("fromUser");
        const ownedCodes = $app.findRecordsByFilter(
            "album_stickers", "album = {:a} && user = {:u}", "", 1000, 0,
            { a: trade.getString("album"), u: otherId }
        ).map((s) => s.getString("code"));

        return e.json(200, { ownedCodes });
    } catch (err) {
        console.error("[album_trades.pb.js] Error en GET /api/album/trades/counterparty-stock:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cargar el álbum de la otra persona." });
    }
}, $apis.requireAuth("users"));

// POST /api/album/trades/counter — body {tradeId, counterCodes: [...]}. Paso 2: solo el
// destinatario, solo sobre una propuesta pending, y con exactamente la misma cantidad
// de láminas que le ofrecieron. "La misma cantidad" y no "una parecida" para no tener
// que definir cuánto es parecido: un 5-por-1 es justo lo que la regla quería evitar.
routerAdd("POST", "/api/album/trades/counter", (e) => {
    try {
        const { looseCount, normalizeTradeCodes, uncoveredCodes } = require(`${__hooks}/lib/album.js`);

        const body = e.requestInfo().body || {};
        const tradeId = String(body.tradeId || "");
        if (!tradeId) throw new BadRequestError("Falta tradeId.");

        const normalized = normalizeTradeCodes(body.counterCodes);
        if (normalized.error) throw new BadRequestError(normalized.error);
        const counterCodes = normalized.codes;

        let trade;
        try {
            trade = $app.findFirstRecordByFilter(
                "album_trades", "id = {:id} && toUser = {:u} && status = 'pending'",
                { id: tradeId, u: e.auth.id }
            );
        } catch (err) {
            throw new BadRequestError("No tienes ninguna propuesta esperando tu respuesta con ese id.");
        }

        const offerCodes = JSON.parse(trade.getString("offerCodes") || "[]");
        if (counterCodes.length !== offerCodes.length) {
            const cuantas = offerCodes.length === 1 ? "1 lámina" : `${offerCodes.length} láminas`;
            throw new BadRequestError(`Tienes que ofrecer exactamente ${cuantas}, las mismas que te ofrecieron.`);
        }

        const looseByCode = {};
        $app.findRecordsByFilter(
            "album_stickers", "album = {:a} && user = {:u}", "", 1000, 0,
            { a: trade.getString("album"), u: e.auth.id }
        ).forEach((s) => {
            looseByCode[s.getString("code")] = looseCount(s.getInt("count"), s.getBool("pasted"));
        });
        if (uncoveredCodes(counterCodes, looseByCode).length > 0) {
            throw new BadRequestError("No tienes copias sueltas suficientes de alguna de las láminas que elegiste.");
        }

        trade.set("counterCodes", JSON.stringify(counterCodes));
        trade.set("status", "countered");
        $app.save(trade);

        try {
            const fromName = e.auth.getString("name") || e.auth.getString("username") || "Alguien";
            const notif = new Record($app.findCollectionByNameOrId("notifications"));
            notif.set("user", trade.getString("fromUser"));
            notif.set("sender", e.auth.id);
            notif.set("type", "trade_countered");
            notif.set("title", "Te respondieron un intercambio");
            notif.set("body", `${fromName} eligió qué darte a cambio. Confirma si te sirve.`);
            notif.set("read", false);
            notif.set("relatedId", trade.getString("album"));
            $app.save(notif);
        } catch (err) {
            console.error("[album_trades.pb.js] Error creando notificación de contraoferta:", err.message || err);
        }

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[album_trades.pb.js] Error en POST /api/album/trades/counter:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo responder la propuesta." });
    }
}, $apis.requireAuth("users"));

// POST /api/album/trades/confirm — body {tradeId}. Paso 3: solo quien propuso, solo
// sobre una propuesta countered. Acá recién se mueven las láminas, en una transacción
// que revalida los dos lados: como no hay reserva, entre el paso 1 y este cualquiera de
// los dos pudo pegar o intercambiar por otro lado las copias comprometidas.
routerAdd("POST", "/api/album/trades/confirm", (e) => {
    try {
        const { looseCount, countCodes, uncoveredCodes } = require(`${__hooks}/lib/album.js`);

        const body = e.requestInfo().body || {};
        const tradeId = String(body.tradeId || "");
        if (!tradeId) throw new BadRequestError("Falta tradeId.");

        let trade;
        try {
            trade = $app.findFirstRecordByFilter(
                "album_trades", "id = {:id} && fromUser = {:u} && status = 'countered'",
                { id: tradeId, u: e.auth.id }
            );
        } catch (err) {
            throw new BadRequestError("No tienes ninguna propuesta lista para confirmar con ese id.");
        }

        const albumId = trade.getString("album");
        const fromUserId = trade.getString("fromUser");
        const toUserId = trade.getString("toUser");
        const offerCodes = JSON.parse(trade.getString("offerCodes") || "[]");
        const counterCodes = JSON.parse(trade.getString("counterCodes") || "[]");

        // Inventario suelto de un usuario dentro de la transacción, para revalidar.
        const looseOf = (txApp, userId) => {
            const map = {};
            txApp.findRecordsByFilter(
                "album_stickers", "album = {:a} && user = {:u}", "", 1000, 0, { a: albumId, u: userId }
            ).forEach((s) => {
                map[s.getString("code")] = looseCount(s.getInt("count"), s.getBool("pasted"));
            });
            return map;
        };

        // Delta NETO por código antes de tocar nada: si alguien da y recibe la misma
        // figurita en el mismo intercambio, aplicarlo en dos pasos podría borrar la fila
        // (count llega a 0) y recrearla perdiendo el `pasted`. Con el neto, una fila que
        // sobrevive al intercambio nunca se borra.
        const netDeltas = (give, receive) => {
            const giveCounts = countCodes(give);
            const receiveCounts = countCodes(receive);
            const net = {};
            Object.keys(giveCounts).forEach((c) => { net[c] = (net[c] || 0) - giveCounts[c]; });
            Object.keys(receiveCounts).forEach((c) => { net[c] = (net[c] || 0) + receiveCounts[c]; });
            return net;
        };

        // Ajusta (o borra, si count llega a 0 — el campo tiene min:1, no se puede
        // guardar en 0) el count de `code` para `userId`, dentro de la transacción.
        const applyDelta = (txApp, userId, code, delta) => {
            if (delta === 0) return;
            let sticker;
            try {
                sticker = txApp.findFirstRecordByFilter(
                    "album_stickers", "album = {:a} && user = {:u} && code = {:c}",
                    { a: albumId, u: userId, c: code }
                );
            } catch (err) {
                sticker = null;
            }
            if (delta > 0) {
                if (sticker) {
                    sticker.set("count", sticker.getInt("count") + delta);
                    txApp.save(sticker);
                } else {
                    const fresh = new Record(txApp.findCollectionByNameOrId("album_stickers"));
                    fresh.set("album", albumId);
                    fresh.set("user", userId);
                    fresh.set("code", code);
                    fresh.set("count", delta);
                    txApp.save(fresh);
                }
            } else {
                if (!sticker) return;
                const newCount = sticker.getInt("count") + delta;
                if (newCount <= 0) {
                    txApp.delete(sticker);
                } else {
                    sticker.set("count", newCount);
                    txApp.save(sticker);
                }
            }
        };

        $app.runInTransaction((txApp) => {
            const fromLoose = looseOf(txApp, fromUserId);
            const toLoose = looseOf(txApp, toUserId);

            if (uncoveredCodes(offerCodes, fromLoose).length > 0) {
                throw new BadRequestError("Ya no tienes sueltas todas las láminas que ofreciste — alguna se pegó o se fue en otro intercambio.");
            }
            if (uncoveredCodes(counterCodes, toLoose).length > 0) {
                throw new BadRequestError("La otra persona ya no tiene sueltas todas las láminas que te ofreció.");
            }

            const fromNet = netDeltas(offerCodes, counterCodes);
            const toNet = netDeltas(counterCodes, offerCodes);
            Object.keys(fromNet).forEach((code) => applyDelta(txApp, fromUserId, code, fromNet[code]));
            Object.keys(toNet).forEach((code) => applyDelta(txApp, toUserId, code, toNet[code]));

            trade.set("status", "accepted");
            txApp.save(trade);
        });

        try {
            const notifCollection = $app.findCollectionByNameOrId("notifications");
            [{ user: fromUserId, sender: toUserId }, { user: toUserId, sender: fromUserId }].forEach((pair) => {
                const notif = new Record(notifCollection);
                notif.set("user", pair.user);
                notif.set("sender", pair.sender);
                notif.set("type", "trade_accepted");
                notif.set("title", "Intercambio confirmado");
                notif.set("body", "Las láminas ya están en tu álbum.");
                notif.set("read", false);
                notif.set("relatedId", albumId);
                $app.save(notif);
            });
        } catch (err) {
            console.error("[album_trades.pb.js] Error creando notificación de confirmación:", err.message || err);
        }

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[album_trades.pb.js] Error en POST /api/album/trades/confirm:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo confirmar el intercambio." });
    }
}, $apis.requireAuth("users"));

// POST /api/album/trades/cancel — body {tradeId}. Un solo endpoint para las tres
// formas de cerrar una propuesta sin intercambio (cancelarla, rechazarla, desistir de
// la contraoferta ya hecha): las dos partes pueden, en cualquier estado menos accepted,
// y en todos los casos es borrar la fila. Sin notificación, mismo precedente que
// org-invites: enterarse de que alguien no te quiso responder no le sirve a nadie.
routerAdd("POST", "/api/album/trades/cancel", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const tradeId = String(body.tradeId || "");
        if (!tradeId) throw new BadRequestError("Falta tradeId.");

        let trade;
        try {
            trade = $app.findFirstRecordByFilter(
                "album_trades",
                "id = {:id} && status != 'accepted' && (fromUser = {:u} || toUser = {:u})",
                { id: tradeId, u: e.auth.id }
            );
        } catch (err) {
            throw new BadRequestError("No tienes ninguna propuesta abierta con ese id.");
        }

        $app.delete(trade);
        return e.json(200, { success: true });
    } catch (err) {
        console.error("[album_trades.pb.js] Error en POST /api/album/trades/cancel:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cerrar el intercambio." });
    }
}, $apis.requireAuth("users"));
