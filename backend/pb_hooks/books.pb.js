/// <reference path="../pb_data/types.d.ts" />

// Libros: mismo mecanismo de like/match tipo Tinder Beauchef que Películas/Videojuegos
// (calcado de movies.pb.js), con la elección apoyada en Open Library en vez de escribir a
// mano — a diferencia de Spotify/TMDB/IGDB, Open Library es pública y gratis sin API key,
// así que /api/books/search no necesita token ni cuenta de nada.

// 1. Tope de 5 libros por usuario.
onRecordCreateRequest((e) => {
    const userId = e.record.getString("user");
    const existing = $app.findRecordsByFilter(
        "book_items",
        "user = {:user} && deleted = false",
        "", 5, 0,
        { user: userId }
    );
    if (existing.length >= 5) {
        throw new BadRequestError("Ya subiste el máximo de 5 libros.");
    }
    return e.next();
}, "book_items");

// 2. Detección y creación automática de matches al dar like.
onRecordCreateRequest((e) => {
    const like = e.record;
    const fromUser = like.getString("fromUser");
    const toUser = like.getString("toUser");

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

    let hasOwnItem = false;
    try {
        $app.findFirstRecordByFilter(
            "book_items",
            "user = {:user} && deleted = false",
            { user: fromUser }
        );
        hasOwnItem = true;
    } catch (err) {
        // No tiene ningún libro subido
    }
    if (!hasOwnItem) {
        throw new BadRequestError("Necesitas subir al menos un libro a tu perfil antes de poder dar like.");
    }

    try {
        if (!like.getBool("liked")) {
            return e.next();
        }

        let hasReciprocal = false;
        try {
            const reciprocal = $app.findFirstRecordByFilter(
                "book_likes",
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
            const matchesCollection = $app.findCollectionByNameOrId("book_matches");
            const match = new Record(matchesCollection);

            const userA = fromUser < toUser ? fromUser : toUser;
            const userB = fromUser > toUser ? fromUser : toUser;

            match.set("userA", userA);
            match.set("userB", userB);

            $app.save(match);
        }
    } catch (err) {
        console.error("[Books Match] Error al procesar match:", err);
    }
    return e.next();
}, "book_likes");

// 3. Limpieza de likes al deshacer un match.
onRecordAfterUpdateSuccess((e) => {
    try {
        const status = e.record.getString("status");
        if (status === "unmatched") {
            const userA = e.record.getString("userA");
            const userB = e.record.getString("userB");

            try {
                const likeAB = $app.findFirstRecordByFilter(
                    "book_likes",
                    "fromUser = {:userA} && toUser = {:userB}",
                    { userA: userA, userB: userB }
                );
                if (likeAB) $app.delete(likeAB);
            } catch (err) {}

            try {
                const likeBA = $app.findFirstRecordByFilter(
                    "book_likes",
                    "fromUser = {:userB} && toUser = {:userA}",
                    { userA: userA, userB: userB }
                );
                if (likeBA) $app.delete(likeBA);
            } catch (err) {}
        }
    } catch (err) {
        console.error("[Books Match] Error in onRecordAfterUpdateSuccess:", err.message || err);
    }
    return e.next();
}, "book_matches");

onRecordAfterDeleteSuccess((e) => {
    try {
        const userA = e.record.getString("userA");
        const userB = e.record.getString("userB");

        try {
            const likeAB = $app.findFirstRecordByFilter(
                "book_likes",
                "fromUser = {:userA} && toUser = {:userB}",
                { userA: userA, userB: userB }
            );
            if (likeAB) $app.delete(likeAB);
        } catch (err) {}

        try {
            const likeBA = $app.findFirstRecordByFilter(
                "book_likes",
                "fromUser = {:userB} && toUser = {:userA}",
                { userA: userA, userB: userB }
            );
            if (likeBA) $app.delete(likeBA);
        } catch (err) {}
    } catch (err) {
        console.error("[Books Match] Error cleaning up likes on delete:", err.message || err);
    }
}, "book_matches");

// 4. Feed de descubrimiento pre-armado en el servidor.
routerAdd("GET", "/api/books/discover", (e) => {
    try {
        const currentUserId = e.auth.id;

        const items = $app.findRecordsByFilter(
            "book_items",
            "deleted = false && user != {:me}",
            "-created", 1000, 0,
            { me: currentUserId }
        );

        const matches = $app.findRecordsByFilter(
            "book_matches",
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
            "book_likes",
            "fromUser = {:me} && liked = true",
            "-created", 500, 0,
            { me: currentUserId }
        );
        const likeIdByUser = {};
        myLikes.forEach((l) => {
            likeIdByUser[l.getString("toUser")] = l.id;
        });

        const itemsByUser = {};
        items.forEach((it) => {
            const userId = it.getString("user");
            if (matchedUserIds[userId] || blockedUserIds[userId]) return;
            if (!itemsByUser[userId]) itemsByUser[userId] = [];
            if (itemsByUser[userId].length < 5) {
                itemsByUser[userId].push({
                    id: it.id,
                    title: it.getString("title"),
                    author: it.getString("author"),
                    year: it.getInt("year") || null,
                    openLibraryId: it.getString("openLibraryId") || "",
                    coverUrl: it.getString("coverUrl") || "",
                    collectionId: it.collection().id,
                    collectionName: "book_items",
                });
            }
        });
        const userIds = Object.keys(itemsByUser);

        const profileRecords = userIds.length > 0
            ? $app.findRecordsByFilter(
                "book_profiles",
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
        console.error("[Books Discover Route] Error:", err.message || err);
        return e.json(500, { error: "No se pudo cargar el feed de descubrimiento." });
    }
}, $apis.requireAuth("users"));

// 5. Búsqueda en Open Library — pública, sin token ni api_key.
routerAdd("GET", "/api/books/search", (e) => {
    const { parseSearchResults } = require(`${__hooks}/lib/openLibrary.js`);

    const q = (e.requestInfo().query["q"] || "").trim();
    if (!q) {
        throw new BadRequestError("Escribe algo para buscar.");
    }

    const searchRes = $http.send({
        url: "https://openlibrary.org/search.json?limit=10&fields=key,title,author_name,first_publish_year,cover_i&q=" + encodeURIComponent(q),
        method: "GET",
        timeout: 15,
    });
    if (searchRes.statusCode !== 200) {
        console.error("[books.pb.js] Error buscando:", searchRes.statusCode, searchRes.raw);
        throw new BadRequestError("No se pudo buscar en Open Library. Intenta de nuevo.");
    }

    return e.json(200, { items: parseSearchResults(searchRes.json) });
}, $apis.requireAuth("users"));
