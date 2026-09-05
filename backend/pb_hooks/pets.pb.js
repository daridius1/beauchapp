/// <reference path="../pb_data/types.d.ts" />

// Mascotas: reescritura de pet_likes/pet_matches al estilo Tinder
// Beauchef. Es el mismo mecanismo (like recíproco → match), calcado de tinder.pb.js, con
// una diferencia de comportamiento a propósito:
//   1. Para dar like hace falta tener al menos 1 foto subida en pet_profiles (acá sí se
//      refuerza en el backend — en Tinder Beauchef esa regla vive solo en la pantalla).
//   2. No hay concepto de perfil "activo/inactivo": alcanza con tener 1 foto para aparecer
//      en el descubrimiento de los demás.
//
// La colección "pets" (varias mascotas por persona, cada una con nombre/fotos propias) ya
// no recibe creaciones nuevas: un perfil de mascotas ahora es un solo registro en
// pet_profiles con nombre libre (para poner el nombre de una o varias mascotas) y hasta 10
// fotos, igual que tinder_profiles. Se deja la colección "pets" viva sin más porque hay
// citas/quotes viejas desde el feed que apuntan a mascotas puntuales ahí.

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

    // Regla nueva (no existe en Tinder Beauchef): hace falta tener al menos 1 foto subida
    // en el perfil para poder dar like. También fuera del try/catch para que se propague.
    let hasPhoto = false;
    try {
        const ownProfile = $app.findFirstRecordByFilter(
            "pet_profiles",
            "user = {:user}",
            { user: fromUser }
        );
        hasPhoto = (ownProfile.get("photos") || []).length > 0;
    } catch (err) {
        // No tiene perfil de mascotas todavía
    }
    if (!hasPhoto) {
        throw new BadRequestError("Necesitas subir al menos una foto a tu perfil antes de poder dar like.");
    }

    try {
        if (!like.getBool("liked")) {
            return e.next(); // Los pases no gatillan matches
        }

        let hasReciprocal = false;
        try {
            const reciprocal = $app.findFirstRecordByFilter(
                "pet_likes",
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
            const matchesCollection = $app.findCollectionByNameOrId("pet_matches");
            const match = new Record(matchesCollection);

            const userA = fromUser < toUser ? fromUser : toUser;
            const userB = fromUser > toUser ? fromUser : toUser;

            match.set("userA", userA);
            match.set("userB", userB);

            $app.save(match);
        }
    } catch (err) {
        console.error("[Pets Match] Error al procesar match:", err);
    }
    return e.next();
}, "pet_likes");

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
                    "pet_likes",
                    "fromUser = {:userA} && toUser = {:userB}",
                    { userA: userA, userB: userB }
                );
                if (likeAB) $app.delete(likeAB);
            } catch (err) {}

            try {
                const likeBA = $app.findFirstRecordByFilter(
                    "pet_likes",
                    "fromUser = {:userB} && toUser = {:userA}",
                    { userA: userA, userB: userB }
                );
                if (likeBA) $app.delete(likeBA);
            } catch (err) {}
        }
    } catch (err) {
        console.error("[Pets Match] Error in onRecordAfterUpdateSuccess:", err.message || err);
    }
    return e.next();
}, "pet_matches");

onRecordAfterDeleteSuccess((e) => {
    try {
        const userA = e.record.getString("userA");
        const userB = e.record.getString("userB");

        try {
            const likeAB = $app.findFirstRecordByFilter(
                "pet_likes",
                "fromUser = {:userA} && toUser = {:userB}",
                { userA: userA, userB: userB }
            );
            if (likeAB) $app.delete(likeAB);
        } catch (err) {}

        try {
            const likeBA = $app.findFirstRecordByFilter(
                "pet_likes",
                "fromUser = {:userB} && toUser = {:userA}",
                { userA: userA, userB: userB }
            );
            if (likeBA) $app.delete(likeBA);
        } catch (err) {}
    } catch (err) {
        console.error("[Pets Match] Error cleaning up likes on delete:", err.message || err);
    }
}, "pet_matches");

// 4. Feed de descubrimiento pre-armado en el servidor, mismo espíritu y misma forma que
// /api/tinder/discover (tinder.pb.js:214-315): candidato = cualquier pet_profiles con al
// menos 1 foto, ya filtrado por match/bloqueo y ya marcado si le di like.
routerAdd("GET", "/api/pets/discover", (e) => {
    try {
        const currentUserId = e.auth.id;

        const profiles = $app.findRecordsByFilter(
            "pet_profiles",
            "user != {:me}",
            "-created", 500, 0,
            { me: currentUserId }
        );

        const matches = $app.findRecordsByFilter(
            "pet_matches",
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
            "pet_likes",
            "fromUser = {:me} && liked = true",
            "-created", 500, 0,
            { me: currentUserId }
        );
        const likeIdByUser = {};
        myLikes.forEach((l) => {
            likeIdByUser[l.getString("toUser")] = l.id;
        });

        // Igual que Tinder Beauchef: "activo" acá es tener al menos 1 foto subida.
        const visibleProfiles = profiles.filter((p) => {
            const userId = p.getString("user");
            if (matchedUserIds[userId] || blockedUserIds[userId]) return false;
            return (p.get("photos") || []).length > 0;
        });
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
                name: p.getString("name"),
                description: p.getString("description"),
                photos: p.get("photos") || [],
                collectionId: p.collection().id,
                collectionName: "pet_profiles",
                expand: { user: usersById[userId] || null },
                isLiked: !!likeIdByUser[userId],
                likeId: likeIdByUser[userId] || null,
            };
        });

        return e.json(200, { profiles: result });
    } catch (err) {
        console.error("[Pets Discover Route] Error:", err.message || err);
        return e.json(500, { error: "No se pudo cargar el feed de descubrimiento." });
    }
}, $apis.requireAuth("users"));
