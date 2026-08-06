/// <reference path="../pb_data/types.d.ts" />

// Lógica pura (testeada en lib/__tests__/mentions.test.js vía `node --test`).
// Nota: require() se llama dentro del hook (no una sola vez a nivel de archivo) porque el
// runtime JSVM de PocketBase no conserva referencias a `const`/`function` de nivel de archivo
// dentro de closures registrados via onRecordCreate/Update/Delete (produce
// "ReferenceError: ... is not defined" en tiempo de ejecución real, aunque el archivo cargue
// sin error). Mismo patrón ya usado en ladders.pb.js.

onRecordAfterCreateSuccess((e) => {
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
