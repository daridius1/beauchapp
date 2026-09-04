/// <reference path="../pb_data/types.d.ts" />

// Videojuegos: categoría de "Conoce Beauchef" con like/match tipo Tinder
// Beauchef. Es el mismo mecanismo (like recíproco → match), calcado de tinder.pb.js, con
// dos diferencias de comportamiento a propósito:
//   1. Para dar like hace falta tener al menos 1 videojuego subido (acá sí se refuerza en el
//      backend — en Tinder Beauchef esa regla vive solo en la pantalla).
//   2. No hay concepto de perfil "activo/inactivo": alcanza con tener 1 ítem para aparecer
//      en el descubrimiento de los demás.

// 1. Tope de 5 videojuegos por usuario — el createRule de PocketBase no puede expresar un
// conteo, así que se refuerza acá.
onRecordCreateRequest((e) => {
    const userId = e.record.getString("user");
    const existing = $app.findRecordsByFilter(
        "game_items",
        "user = {:user} && deleted = false",
        "", 5, 0,
        { user: userId }
    );
    if (existing.length >= 5) {
        throw new BadRequestError("Ya subiste el máximo de 5 videojuegos.");
    }
    return e.next();
}, "game_items");

// 2. Detección y creación automática de matches al dar like (mismo patrón sync que
// tinder.pb.js, para que un chequeo inmediato tras dar like ya encuentre el match).
onRecordCreateRequest((e) => {
    const like = e.record;
    const fromUser = like.getString("fromUser");
    const toUser = like.getString("toUser");

    // Bloqueo de usuarios, fuera del try/catch para que el error se propague y rechace la
    // request (mismo motivo que tinder.pb.js:82-101).
    let isBlocked = false;
    try {
        $app.findFirstRecordByFilter(
            "blocked_users",
            "(blocker = {:fromUser} && blocked = {:toUser}) || (blocker = {:toUser} && blocked = {:fromUser})",
            { fromUser: fromUser, toUser: toUser }
        );
        isBlocked = true;
    } catch (err) {
        // No hay bloqueo entre ambos usuarios
    }
    if (isBlocked) {
        throw new BadRequestError("No puedes interactuar con este usuario.");
    }

    // Regla nueva (no existe en Tinder Beauchef): hace falta tener al menos 1 videojuego
    // subida para poder dar like. También fuera del try/catch para que se propague.
    let hasOwnItem = false;
    try {
        $app.findFirstRecordByFilter(
            "game_items",
            "user = {:user} && deleted = false",
            { user: fromUser }
        );
        hasOwnItem = true;
    } catch (err) {
        // No tiene ningún videojuego subido
    }
    if (!hasOwnItem) {
        throw new BadRequestError("Necesitas subir al menos un videojuego a tu perfil antes de poder dar like.");
    }

    try {
        if (!like.getBool("liked")) {
            return e.next(); // Los pases no gatillan matches
        }

        let hasReciprocal = false;
        try {
            const reciprocal = $app.findFirstRecordByFilter(
                "game_likes",
                "fromUser = {:toUser} && toUser = {:fromUser} && liked = true",
                { toUser: toUser, fromUser: fromUser }
            );
            if (reciprocal) {
                hasReciprocal = true;
            }
        } catch (err) {
            // No existe like recíproco aún
        }

        if (hasReciprocal) {
            const matchesCollection = $app.findCollectionByNameOrId("game_matches");
            const match = new Record(matchesCollection);

            const userA = fromUser < toUser ? fromUser : toUser;
            const userB = fromUser > toUser ? fromUser : toUser;

            match.set("userA", userA);
            match.set("userB", userB);

            $app.save(match);
        }
    } catch (err) {
        console.error("[Games Match] Error al procesar match:", err);
    }
    return e.next();
}, "game_likes");

// 3. Limpieza de likes al deshacer un match (marcar 'unmatched' o borrar). Lógica
// duplicada entre ambos callbacks a propósito — mismo motivo documentado en
// tinder.pb.js:142-148: el runtime JSVM de PocketBase no conserva referencias a
// funciones de nivel de archivo dentro de estos closures.
onRecordAfterUpdateSuccess((e) => {
    try {
        const status = e.record.getString("status");
        if (status === "unmatched") {
            const userA = e.record.getString("userA");
            const userB = e.record.getString("userB");

            try {
                const likeAB = $app.findFirstRecordByFilter(
                    "game_likes",
                    "fromUser = {:userA} && toUser = {:userB}",
                    { userA: userA, userB: userB }
                );
                if (likeAB) $app.delete(likeAB);
            } catch (err) {}

            try {
                const likeBA = $app.findFirstRecordByFilter(
                    "game_likes",
                    "fromUser = {:userB} && toUser = {:userA}",
                    { userA: userA, userB: userB }
                );
                if (likeBA) $app.delete(likeBA);
            } catch (err) {}
        }
    } catch (err) {
        console.error("[Games Match] Error in onRecordAfterUpdateSuccess:", err.message || err);
    }
    return e.next();
}, "game_matches");

onRecordAfterDeleteSuccess((e) => {
    try {
        const userA = e.record.getString("userA");
        const userB = e.record.getString("userB");

        try {
            const likeAB = $app.findFirstRecordByFilter(
                "game_likes",
                "fromUser = {:userA} && toUser = {:userB}",
                { userA: userA, userB: userB }
            );
            if (likeAB) $app.delete(likeAB);
        } catch (err) {}

        try {
            const likeBA = $app.findFirstRecordByFilter(
                "game_likes",
                "fromUser = {:userB} && toUser = {:userA}",
                { userA: userA, userB: userB }
            );
            if (likeBA) $app.delete(likeBA);
        } catch (err) {}
    } catch (err) {
        console.error("[Games Match] Error cleaning up likes on delete:", err.message || err);
    }
}, "game_matches");

// 4. Feed de descubrimiento pre-armado en el servidor, mismo espíritu que
// /api/tinder/discover (tinder.pb.js:214-315): candidato = cualquier usuario con al menos
// 1 videojuego no borrado, ya filtrado por match/bloqueo y ya marcado si le di like.
routerAdd("GET", "/api/games/discover", (e) => {
    try {
        const currentUserId = e.auth.id;

        const items = $app.findRecordsByFilter(
            "game_items",
            "deleted = false && user != {:me}",
            "-created", 1000, 0,
            { me: currentUserId }
        );

        const matches = $app.findRecordsByFilter(
            "game_matches",
            "userA = {:me} || userB = {:me}",
            "-created", 500, 0,
            { me: currentUserId }
        );
        const matchedUserIds = {};
        matches.forEach((m) => {
            const a = m.getString("userA");
            const b = m.getString("userB");
            matchedUserIds[a === currentUserId ? b : a] = true;
        });

        // $app.findRecordsByFilter ignora listRule/viewRule (solo se aplican en la API REST
        // estándar) — el bloqueo bidireccional hay que repetirlo a mano acá, mismo motivo
        // que tinder.pb.js:238-242.
        const blocks = $app.findRecordsByFilter(
            "blocked_users",
            "blocker = {:me} || blocked = {:me}",
            "", 500, 0,
            { me: currentUserId }
        );
        const blockedUserIds = {};
        blocks.forEach((b) => {
            const blocker = b.getString("blocker");
            const blocked = b.getString("blocked");
            blockedUserIds[blocker === currentUserId ? blocked : blocker] = true;
        });

        const myLikes = $app.findRecordsByFilter(
            "game_likes",
            "fromUser = {:me} && liked = true",
            "-created", 500, 0,
            { me: currentUserId }
        );
        const likeIdByUser = {};
        myLikes.forEach((l) => {
            likeIdByUser[l.getString("toUser")] = l.id;
        });

        // Agrupar game_items por usuario, excluyendo ya acá los que hicieron match o están
        // bloqueados (para no perder tiempo armando datos de gente que no se va a mostrar).
        const itemsByUser = {};
        items.forEach((it) => {
            const userId = it.getString("user");
            if (matchedUserIds[userId] || blockedUserIds[userId]) return;
            if (!itemsByUser[userId]) itemsByUser[userId] = [];
            if (itemsByUser[userId].length < 5) {
                itemsByUser[userId].push({
                    id: it.id,
                    title: it.getString("title"),
                    year: it.getInt("year") || null,
                    director: it.getString("director"),
                    genero: it.getString("genero"),
                    image: it.get("image") || "",
                    igdbId: it.getString("igdbId") || "",
                    coverUrl: it.getString("coverUrl") || "",
                    collectionId: it.collection().id,
                    collectionName: "game_items",
                });
            }
        });
        const userIds = Object.keys(itemsByUser);

        const profileRecords = userIds.length > 0
            ? $app.findRecordsByFilter(
                "game_profiles",
                userIds.map((id) => `user = "${id}"`).join(" || "),
                "", userIds.length, 0
              )
            : [];
        const descriptionByUser = {};
        profileRecords.forEach((p) => {
            descriptionByUser[p.getString("user")] = p.getString("description");
        });

        const { pickChipUserFields } = require(`${__hooks}/lib/chipFields.js`);

        let usersById = {};
        if (userIds.length > 0) {
            const idFilter = userIds.map((id) => `id = "${id}"`).join(" || ");
            const users = $app.findRecordsByFilter("users", `(${idFilter})`, "-created", userIds.length, 0);
            users.forEach((u) => {
                usersById[u.id] = pickChipUserFields(u);
            });
        }

        const result = userIds.map((userId) => ({
            user: userId,
            description: descriptionByUser[userId] || "",
            items: itemsByUser[userId],
            expand: { user: usersById[userId] || null },
            isLiked: !!likeIdByUser[userId],
            likeId: likeIdByUser[userId] || null,
        }));

        return e.json(200, { profiles: result });
    } catch (err) {
        console.error("[Games Discover Route] Error:", err.message || err);
        return e.json(500, { error: "No se pudo cargar el feed de descubrimiento." });
    }
}, $apis.requireAuth("users"));
