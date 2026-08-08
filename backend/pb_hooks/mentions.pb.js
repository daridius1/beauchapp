/// <reference path="../pb_data/types.d.ts" />

// Lógica pura (testeada en lib/__tests__/mentions.test.js vía `node --test`).
// Nota: require() se llama dentro del hook (no una sola vez a nivel de archivo) porque el
// runtime JSVM de PocketBase no conserva referencias a `const`/`function` de nivel de archivo
// dentro de closures registrados via onRecordCreate/Update/Delete (produce
// "ReferenceError: ... is not defined" en tiempo de ejecución real, aunque el archivo cargue
// sin error). Mismo patrón ya usado en ladders.pb.js.
//
// OJO — verificado con un spike: PocketBase solo invoca UN handler onRecordAfterCreateSuccess
// por tag exacto ("posts"), aunque estén registrados en archivos .pb.js distintos; el resto se
// ignora en silencio (sin error en el log), sin importar el orden de carga de los archivos. Por
// eso la notificación de "te respondieron" vive acá adentro, en el único handler de "posts" que
// PocketBase efectivamente ejecuta, en vez de un onRecordAfterCreateSuccess(..., "posts") nuevo
// en notifications.pb.js (que se registraría pero nunca se llamaría). Si se necesita agregar
// más lógica de creación de posts a futuro, súmala también acá, no en un hook nuevo.
onRecordAfterCreateSuccess((e) => {
    // Notificar al autor de un post/comentario cuando alguien le responde (actionType "reply",
    // replyTo apuntando al post/comentario original). Cubre tanto respuestas a publicaciones
    // del muro como respuestas a comentarios dejados en problemas/partidos/actividades/ramos,
    // ya que ambos casos son el mismo tipo de registro en "posts" (ver forum.pb.js).
    //
    // OJO: va ANTES del bloque de mentions a propósito. Los `return` de más abajo (dentro del
    // try de mentions) salen de TODA esta función, no solo de ese bloque — si este código
    // quedara después, cualquier post sin @mención (la gran mayoría, incluida toda respuesta
    // normal) nunca llegaría a ejecutarlo. Verificado con un spike: sin este orden, la
    // notificación de respuesta simplemente no se crea nunca, sin ningún error en el log.
    try {
        const post = e.record;
        const actionType = post.getString("actionType");
        const replyTo = post.getString("replyTo");
        if (actionType === "reply" && replyTo) {
            const parent = $app.findRecordById("posts", replyTo);
            const parentAuthorId = parent.getString("author");
            const authorId = post.getString("author");
            if (parentAuthorId && parentAuthorId !== authorId) { // no notificarse a uno mismo
                let authorName = "Alguien";
                try {
                    authorName = $app.findRecordById("users", authorId).getString("name") || authorName;
                } catch (err) {}

                const notifCollection = $app.findCollectionByNameOrId("notifications");
                const notif = new Record(notifCollection);
                notif.set("user", parentAuthorId);
                notif.set("sender", authorId);
                notif.set("type", "reply");
                notif.set("title", authorName + " respondió tu comentario");
                notif.set("body", (post.getString("content") || "").slice(0, 140));
                notif.set("read", false);
                notif.set("relatedId", post.id);
                $app.save(notif);
            }
        }
    } catch (err) {
        console.error("[Reply Notification] Error:", err.message || err);
    }

    try {
        const { parseMentions } = require(`${__hooks}/lib/mentions.js`);
        const post = e.record;
        const content = post.getString("content");
        const authorId = post.getString("author");

        if (!content) {
            return;
        }

        const mentionedUsernames = parseMentions(content);

        if (mentionedUsernames.length === 0) {
            return;
        }

        const author = $app.findRecordById("users", authorId);
        const authorUsername = author.getString("username") || "alguien";

        const notifCollection = $app.findCollectionByNameOrId("notifications");

        mentionedUsernames.forEach((username) => {
            try {
                // Find user by username
                const targetUser = $app.findFirstRecordByFilter("users", "username = {:username}", { username: username });

                if (targetUser && targetUser.id !== authorId) {
                    // Create notification
                    const notif = new Record(notifCollection);
                    notif.set("user", targetUser.id);
                    notif.set("sender", authorId);
                    notif.set("type", "mention");
                    notif.set("title", "Te mencionaron");
                    notif.set("body", "@" + authorUsername + " te ha mencionado en una publicación.");
                    notif.set("read", false);
                    notif.set("relatedId", post.id);
                    $app.save(notif);
                }
            } catch (userErr) {
                console.error("[Mentions Hook] Error processing mention for " + username + ":", userErr.message || userErr);
            }
        });
    } catch (err) {
        console.error("[Mentions Hook] Outer error processing mentions:", err.message || err);
    }
}, "posts");
