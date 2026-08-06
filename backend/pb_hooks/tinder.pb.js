/// <reference path="../pb_data/types.d.ts" />

// 14. Tinder Beauchef: Protejo datos de contacto (Redacción de seguridad)
onRecordEnrich((e) => {
    try {
        const authUser = e.requestInfo && e.requestInfo.auth;
        const isAdmin = e.requestInfo && e.requestInfo.admin;
        if (isAdmin) {
            return e.next();
        }

        const profileUserId = e.record.getString("user");
        if (authUser && profileUserId === authUser.id) {
            // El propietario puede ver sus propios datos
            return e.next();
        }

        // Si no hay sesión iniciada, o no coincide el usuario, comprobar match
        let hasMatch = false;
        if (authUser) {
            const idA = authUser.id < profileUserId ? authUser.id : profileUserId;
            const idB = authUser.id > profileUserId ? authUser.id : profileUserId;
            try {
                const match = $app.findFirstRecordByFilter(
                    "tinder_matches",
                    "userA = {:idA} && userB = {:idB} && (status != 'unmatched' || status = '')",
                    { idA: idA, idB: idB }
                );
                if (match) {
                    hasMatch = true;
                }
            } catch (err) {
                // Sin match activo
            }
        }

        if (!hasMatch) {
            // Blanquear datos de contacto para proteger privacidad
            e.record.set("instagram", "");
            e.record.set("whatsapp", "");
            e.record.set("telegram", "");
            e.record.set("signal", "");
        }
    } catch (err) {
        console.error("[Tinder Security] Error enriching profile:", err);
    }
    return e.next();
}, "tinder_profiles");

// 15. Tinder Beauchef: Restricción de 24 horas para desactivar
onRecordUpdateRequest((e) => {
    const original = e.record.original();
    const wasActive = original.getBool("isActive");
    const isActive = e.record.getBool("isActive");

    if (wasActive && !isActive) {
        // Desactivando: verificar bloqueo de 24h
        const activatedAtStr = original.getString("activatedAt");
        if (activatedAtStr) {
            // Reemplazar espacios por T para parseo estándar de fecha
            const activatedTime = new Date(activatedAtStr.replace(" ", "T"));
            const diffHours = (new Date() - activatedTime) / (1000 * 60 * 60);
            if (diffHours < 24) {
                throw new BadRequestError("No puedes desactivar Tinder Beauchef hasta que pasen 24 horas desde la última activación.");
            }
        }
    } else if (!wasActive && isActive) {
        // Activando: actualizar timestamp
        e.record.set("activatedAt", new Date().toISOString());
    }
    return e.next();
}, "tinder_profiles");

// 16. Tinder Beauchef: Detección y creación automática de Matches.
// Sync (onRecordCreateRequest, antes de e.next()) en vez de onRecordAfterCreateSuccess (async)
// para que un chequeo inmediato de "¿hubo match?" tras dar like ya lo encuentre.
onRecordCreateRequest((e) => {
    const like = e.record;
    const fromUser = like.getString("fromUser");
    const toUser = like.getString("toUser");

    // Respaldo a nivel de hook del bloqueo de usuarios (independiente de que
    // tinder_likes.createRule ya lo impida) — si cualquiera de los dos bloqueó
    // al otro, ni el like/pase se registra ni, por lo tanto, puede haber match.
    // Fuera del try/catch de abajo a propósito: el BadRequestError debe
    // propagarse y rechazar la request, no quedar atrapado y logueado en
    // silencio como los errores inesperados del resto de la función.
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

    try {
        if (!like.getBool("liked")) {
            return e.next(); // Los pases no gatillan matches
        }

        let hasReciprocal = false;
        try {
            const reciprocal = $app.findFirstRecordByFilter(
                "tinder_likes",
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
            // Crear el match en tinder_matches
            const matchesCollection = $app.findCollectionByNameOrId("tinder_matches");
            const match = new Record(matchesCollection);

            // Ordenar lexicográficamente para consistencia
            const userA = fromUser < toUser ? fromUser : toUser;
            const userB = fromUser > toUser ? fromUser : toUser;

            match.set("userA", userA);
            match.set("userB", userB);

            $app.save(match);
        }
    } catch (err) {
        console.error("[Tinder Match] Error al procesar match:", err);
    }
    return e.next();
}, "tinder_likes");

// 17. Tinder Beauchef: Limpieza de likes al deshacer un match (al eliminar o al marcar como
// 'unmatched'). NOTA: la lógica está duplicada en los dos callbacks de abajo (en vez de
// compartirse vía una función de nivel de archivo) porque el runtime JSVM de PocketBase no
// conserva referencias a `function`/`const` de nivel de archivo dentro de closures
// registrados vía onRecordAfterUpdateSuccess/onRecordAfterDeleteSuccess (produce
// "ReferenceError: ... is not defined" en tiempo de ejecución real, aunque el archivo cargue
// sin error).
onRecordAfterUpdateSuccess((e) => {
    try {
        const status = e.record.getString("status");
        if (status === "unmatched") {
            const userA = e.record.getString("userA");
            const userB = e.record.getString("userB");

            try {
                const likeAB = $app.findFirstRecordByFilter(
                    "tinder_likes",
                    "fromUser = {:userA} && toUser = {:userB}",
                    { userA: userA, userB: userB }
                );
                if (likeAB) $app.delete(likeAB);
            } catch (err) {}

            try {
                const likeBA = $app.findFirstRecordByFilter(
                    "tinder_likes",
                    "fromUser = {:userB} && toUser = {:userA}",
                    { userA: userA, userB: userB }
                );
                if (likeBA) $app.delete(likeBA);
            } catch (err) {}
        }
    } catch (err) {
        console.error("[Tinder Match] Error in onRecordAfterUpdateSuccess:", err.message || err);
    }
    return e.next();
}, "tinder_matches");

onRecordAfterDeleteSuccess((e) => {
    try {
        const userA = e.record.getString("userA");
        const userB = e.record.getString("userB");

        try {
            const likeAB = $app.findFirstRecordByFilter(
                "tinder_likes",
                "fromUser = {:userA} && toUser = {:userB}",
                { userA: userA, userB: userB }
            );
            if (likeAB) $app.delete(likeAB);
        } catch (err) {}

        try {
            const likeBA = $app.findFirstRecordByFilter(
                "tinder_likes",
                "fromUser = {:userB} && toUser = {:userA}",
                { userA: userA, userB: userB }
            );
            if (likeBA) $app.delete(likeBA);
        } catch (err) {}
    } catch (err) {
        console.error("[Tinder Match] Error cleaning up likes on delete:", err.message || err);
    }
}, "tinder_matches");

// 18. Tinder Beauchef: Feed de descubrimiento pre-armado en el servidor.
// Antes el frontend hacía 3 consultas secuenciales (perfiles activos, mis matches, mis likes)
// solo para poder filtrar/marcar los perfiles a mostrar. Esta ruta hace ese trabajo acá y
// devuelve una sola respuesta lista para renderizar (perfiles ya filtrados por match, ya
// marcados como "ya di like", con el usuario ya expandido) — 1 request en vez de 3.
// Las "chips" (ladder_ranks/seller_profiles/organization_members) se siguen pidiendo aparte
// desde el cliente (en paralelo, no acá) porque son independientes de este feed.
routerAdd("GET", "/api/tinder/discover", (e) => {
    try {
        const currentUserId = e.auth.id;

        const profiles = $app.findRecordsByFilter(
            "tinder_profiles",
            "isActive = true && user != {:me}",
            "-created", 200, 0,
            { me: currentUserId }
        );

        const matches = $app.findRecordsByFilter(
            "tinder_matches",
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

        const myLikes = $app.findRecordsByFilter(
            "tinder_likes",
            "fromUser = {:me} && liked = true",
            "-created", 500, 0,
            { me: currentUserId }
        );
        const likeIdByUser = {};
        myLikes.forEach((l) => {
            likeIdByUser[l.getString("toUser")] = l.id;
        });

        const visibleProfiles = profiles.filter((p) => !matchedUserIds[p.getString("user")]);
        const userIds = visibleProfiles.map((p) => p.getString("user"));

        const { pickChipUserFields } = require(`${__hooks}/lib/chipFields.js`);

        let usersById = {};
        if (userIds.length > 0) {
            const idFilter = userIds.map((id) => `id = "${id}"`).join(" || ");
            const users = $app.findRecordsByFilter("users", `(${idFilter})`, "-created", userIds.length, 0);
            users.forEach((u) => {
                usersById[u.id] = pickChipUserFields(u);
            });
        }

        const result = visibleProfiles.map((p) => {
            const userId = p.getString("user");
            return {
                id: p.id,
                user: userId,
                description: p.getString("description"),
                isActive: p.getBool("isActive"),
                photos: p.get("photos") || [],
                instagram: p.getString("instagram"),
                whatsapp: p.getString("whatsapp"),
                telegram: p.getString("telegram"),
                signal: p.getString("signal"),
                favorite_song: p.getString("favorite_song"),
                favorite_book: p.getString("favorite_book"),
                zodiac_sign: p.getString("zodiac_sign"),
                favorite_drink: p.getString("favorite_drink"),
                favorite_food: p.getString("favorite_food"),
                favorite_subject: p.getString("favorite_subject"),
                hobbies: p.getString("hobbies"),
                collectionId: p.collection().id,
                collectionName: "tinder_profiles",
                expand: { user: usersById[userId] || null },
                isLiked: !!likeIdByUser[userId],
                likeId: likeIdByUser[userId] || null,
            };
        });

        return e.json(200, { profiles: result });
    } catch (err) {
        console.error("[Tinder Discover Route] Error:", err.message || err);
        return e.json(500, { error: "No se pudo cargar el feed de descubrimiento." });
    }
}, $apis.requireAuth("users"));
