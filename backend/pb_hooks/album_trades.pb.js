/// <reference path="../pb_data/types.d.ts" />

// Intercambios de figuritas: proponer, listar, aceptar/rechazar, cancelar. Aparte de
// album.pb.js a propósito — es un ciclo de vida completo (proponer → notificar →
// aceptar/rechazar) alrededor de una colección nueva (album_trades), no una extensión
// del checklist del álbum, mismo criterio que separó organizations.pb.js de
// auth.pb.js. Cada routerAdd corre en su propia VM aislada (CLAUDE.md §2.1): todo
// require() va DENTRO del handler.
//
// Solo se intercambian copias SUELTAS (sin pegar) — ver looseCount en lib/album.js:
// `count - (pasted ? 1 : 0)`. No existe (ni se va a construir) una forma de ver el
// inventario de OTRO usuario, así que proponer un intercambio no valida que el
// destinatario tenga la figurita pedida — si no la tiene, simplemente no podrá
// aceptar (el accept sí revalida ambos lados, ver más abajo).

// POST /api/album/trades — body {albumId, toUserId, offerCode, requestCode}.
routerAdd("POST", "/api/album/trades", (e) => {
    try {
        const { looseCount } = require(`${__hooks}/lib/album.js`);

        const body = e.requestInfo().body || {};
        const albumId = String(body.albumId || "");
        const toUserId = String(body.toUserId || "");
        const offerCode = String(body.offerCode || "");
        const requestCode = String(body.requestCode || "");
        if (!albumId || !toUserId || !offerCode || !requestCode) {
            throw new BadRequestError("Faltan datos.");
        }
        if (toUserId === e.auth.id) {
            throw new BadRequestError("No podés proponerte un intercambio a vos mismo.");
        }

        let album;
        try {
            album = $app.findRecordById("albums", albumId);
        } catch (err) {
            throw new BadRequestError("Ese álbum no existe.");
        }
        if (!album.getBool("enabled")) {
            throw new BadRequestError("Ese álbum no está disponible.");
        }

        let offerSticker;
        try {
            offerSticker = $app.findFirstRecordByFilter(
                "album_stickers", "album = {:a} && user = {:u} && code = {:c}",
                { a: albumId, u: e.auth.id, c: offerCode }
            );
        } catch (err) {
            offerSticker = null;
        }
        const loose = offerSticker ? looseCount(offerSticker.getInt("count"), offerSticker.getBool("pasted")) : 0;
        if (loose < 1) {
            throw new BadRequestError("No tenés una copia suelta de esa figurita para ofrecer.");
        }

        const trade = new Record($app.findCollectionByNameOrId("album_trades"));
        trade.set("album", albumId);
        trade.set("fromUser", e.auth.id);
        trade.set("toUser", toUserId);
        trade.set("offerCode", offerCode);
        trade.set("requestCode", requestCode);
        trade.set("status", "pending");
        $app.save(trade);

        try {
            const fromName = e.auth.getString("name") || e.auth.getString("username") || "Alguien";
            const notif = new Record($app.findCollectionByNameOrId("notifications"));
            notif.set("user", toUserId);
            notif.set("sender", e.auth.id);
            notif.set("type", "trade_proposed");
            notif.set("title", "Nueva propuesta de intercambio");
            notif.set("body", `${fromName} te ofrece una figurita a cambio de otra.`);
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

// GET /api/album/trades?albumId= — propuestas PENDIENTES del usuario actual, en
// ambas direcciones. No resuelve offerCode/requestCode a nombre/foto/equipo: el
// frontend ya tiene esa tabla completa desde GET /api/album y la cruza localmente
// (evitar una tercera copia de esa lógica de resolución, repartida en otra VM
// aislada más).
routerAdd("GET", "/api/album/trades", (e) => {
    try {
        const { publicAccount } = require(`${__hooks}/lib/publicLeague.js`);

        const albumId = String(e.requestInfo().query["albumId"] || "");
        if (!albumId) throw new BadRequestError("Falta el id del álbum.");

        const rows = $app.findRecordsByFilter(
            "album_trades",
            "album = {:a} && status = 'pending' && (fromUser = {:u} || toUser = {:u})",
            "-created", 500, 0, { a: albumId, u: e.auth.id }
        );

        const incoming = [];
        const outgoing = [];
        rows.forEach((r) => {
            const fromUserId = r.getString("fromUser");
            const toUserId = r.getString("toUser");
            const entry = {
                id: r.id,
                offerCode: r.getString("offerCode"),
                requestCode: r.getString("requestCode"),
                created: r.getString("created"),
            };
            if (toUserId === e.auth.id) {
                let counterparty = null;
                try { counterparty = publicAccount($app.findRecordById("users", fromUserId)); } catch (err) { /* borrado */ }
                incoming.push({ ...entry, counterparty });
            } else {
                let counterparty = null;
                try { counterparty = publicAccount($app.findRecordById("users", toUserId)); } catch (err) { /* borrado */ }
                outgoing.push({ ...entry, counterparty });
            }
        });

        return e.json(200, { incoming, outgoing });
    } catch (err) {
        console.error("[album_trades.pb.js] Error en GET /api/album/trades:", err);
        return e.json(400, { error: (err && err.message) || "No se pudieron cargar los intercambios." });
    }
}, $apis.requireAuth("users"));

// POST /api/album/trades/respond — body {tradeId, decision: "accept"|"reject"}, mismo
// shape que /api/org-invites/respond (auth.pb.js). Solo el destinatario (toUser)
// puede responder. Rechazar borra la fila directo, sin notificar (mismo precedente
// que org-invites). Aceptar intercambia dentro de una transacción, revalidando ambos
// lados por si algo cambió desde que se propuso (alguien ya pegó o ya intercambió esa
// copia por otro lado).
routerAdd("POST", "/api/album/trades/respond", (e) => {
    try {
        const { looseCount } = require(`${__hooks}/lib/album.js`);

        const body = e.requestInfo().body || {};
        const tradeId = String(body.tradeId || "");
        const decision = String(body.decision || "");
        if (!tradeId) throw new BadRequestError("Falta tradeId.");
        if (decision !== "accept" && decision !== "reject") {
            throw new BadRequestError("decision debe ser 'accept' o 'reject'.");
        }

        let trade;
        try {
            trade = $app.findFirstRecordByFilter(
                "album_trades", "id = {:id} && toUser = {:u} && status = 'pending'",
                { id: tradeId, u: e.auth.id }
            );
        } catch (err) {
            throw new BadRequestError("No tenés ninguna propuesta pendiente con ese id.");
        }

        if (decision === "reject") {
            $app.delete(trade);
            return e.json(200, { success: true });
        }

        const albumId = trade.getString("album");
        const fromUserId = trade.getString("fromUser");
        const toUserId = trade.getString("toUser");
        const offerCode = trade.getString("offerCode");
        const requestCode = trade.getString("requestCode");

        // Ajusta (o borra, si count llega a 0 — el campo tiene min:1, no se puede
        // guardar en 0) el count de `code` para `userId` en `delta` (+1/-1), dentro de
        // la transacción recibida.
        const applyDelta = (txApp, userId, code, delta) => {
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
                const newCount = (sticker ? sticker.getInt("count") : 0) + delta;
                if (!sticker) return;
                if (newCount <= 0) {
                    txApp.delete(sticker);
                } else {
                    sticker.set("count", newCount);
                    txApp.save(sticker);
                }
            }
        };

        $app.runInTransaction((txApp) => {
            let fromSticker, toSticker;
            try {
                fromSticker = txApp.findFirstRecordByFilter(
                    "album_stickers", "album = {:a} && user = {:u} && code = {:c}",
                    { a: albumId, u: fromUserId, c: offerCode }
                );
            } catch (err) { fromSticker = null; }
            try {
                toSticker = txApp.findFirstRecordByFilter(
                    "album_stickers", "album = {:a} && user = {:u} && code = {:c}",
                    { a: albumId, u: toUserId, c: requestCode }
                );
            } catch (err) { toSticker = null; }

            const fromLoose = fromSticker ? looseCount(fromSticker.getInt("count"), fromSticker.getBool("pasted")) : 0;
            if (fromLoose < 1) {
                throw new BadRequestError("Quien propuso el intercambio ya no tiene esa figurita disponible.");
            }
            const toLoose = toSticker ? looseCount(toSticker.getInt("count"), toSticker.getBool("pasted")) : 0;
            if (toLoose < 1) {
                throw new BadRequestError("Ya no tenés la figurita pedida disponible para intercambiar.");
            }

            applyDelta(txApp, fromUserId, offerCode, -1);
            applyDelta(txApp, fromUserId, requestCode, +1);
            applyDelta(txApp, toUserId, requestCode, -1);
            applyDelta(txApp, toUserId, offerCode, +1);

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
                notif.set("title", "Intercambio aceptado");
                notif.set("body", "Se completó un intercambio de figuritas.");
                notif.set("read", false);
                notif.set("relatedId", albumId);
                $app.save(notif);
            });
        } catch (err) {
            console.error("[album_trades.pb.js] Error creando notificación de aceptación:", err.message || err);
        }

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[album_trades.pb.js] Error en POST /api/album/trades/respond:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo responder el intercambio." });
    }
}, $apis.requireAuth("users"));

// POST /api/album/trades/cancel — body {tradeId}. Solo quien propuso puede cancelar
// su propia propuesta pendiente.
routerAdd("POST", "/api/album/trades/cancel", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const tradeId = String(body.tradeId || "");
        if (!tradeId) throw new BadRequestError("Falta tradeId.");

        let trade;
        try {
            trade = $app.findFirstRecordByFilter(
                "album_trades", "id = {:id} && fromUser = {:u} && status = 'pending'",
                { id: tradeId, u: e.auth.id }
            );
        } catch (err) {
            throw new BadRequestError("No tenés ninguna propuesta pendiente con ese id.");
        }

        $app.delete(trade);
        return e.json(200, { success: true });
    } catch (err) {
        console.error("[album_trades.pb.js] Error en POST /api/album/trades/cancel:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cancelar el intercambio." });
    }
}, $apis.requireAuth("users"));
