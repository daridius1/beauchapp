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
        const { BEAUROK_USERNAME, stripMention, buildBeaurokPrompt, truncateReply } = require(`${__hooks}/lib/beaurok.js`);
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
        const authorName = author.getString("name") || authorUsername;

        const notifCollection = $app.findCollectionByNameOrId("notifications");

        mentionedUsernames.forEach((username) => {
            // BeauRok: en vez de notificar a un usuario real, genera una respuesta con
            // DeepSeek y la publica como reply — ver lib/beaurok.js. Todo en su propio
            // try/catch, y con `return` propio: una caída de DeepSeek (o que falte la
            // API key, ej. en local) nunca debe romper el post original ni las
            // notificaciones de otras menciones reales en el mismo texto.
            if (username === BEAUROK_USERNAME) {
                try {
                    const beaurokUser = $app.findFirstRecordByFilter("users", "username = {:u}", { u: BEAUROK_USERNAME });
                    if (authorId === beaurokUser.id) {
                        return; // el propio bot nunca se responde a sí mismo
                    }

                    const apiKey = $os.getenv("DEEPSEEK_API_KEY");
                    if (!apiKey) {
                        return; // no configurada (ej. ambiente local) — silencioso, a propósito
                    }

                    // Tope defensivo contra abuso de la API key: no más de N respuestas
                    // por cada 24 horas móviles (no por día calendario — más simple, no
                    // depende de huso horario).
                    const DAILY_REPLY_CAP = 200;
                    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                    const repliesLast24h = $app.findRecordsByFilter(
                        "posts", "author = {:a} && created >= {:d}", "", 0, 0, { a: beaurokUser.id, d: since24h }
                    );
                    if (repliesLast24h.length >= DAILY_REPLY_CAP) {
                        console.error("[BeauRok] Tope de respuestas en 24h alcanzado, se omite.");
                        return;
                    }

                    const stripped = stripMention(content);
                    const { system, user: userMsg } = buildBeaurokPrompt(stripped);

                    const res = $http.send({
                        url: "https://api.deepseek.com/chat/completions",
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
                        // thinking:disabled — deepseek-v4-flash piensa (reasoning_content)
                        // por defecto, y con max_tokens bajo el razonamiento se comía todo
                        // el presupuesto sin dejar nada para la respuesta final (probado en
                        // local: volvía content vacío, finish_reason "length"). Sin pensar
                        // responde directo, más barato y más rápido — justo lo que hace
                        // falta para una respuesta de una frase.
                        body: JSON.stringify({
                            model: "deepseek-v4-flash",
                            messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
                            max_tokens: 120,
                            temperature: 0.9,
                            thinking: { type: "disabled" },
                        }),
                        timeout: 25,
                    });

                    const data = res.json || JSON.parse(res.raw || "{}");
                    const rawReply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
                    if (!rawReply) {
                        console.error("[BeauRok] Respuesta de DeepSeek sin contenido:", res.statusCode, res.raw);
                        return;
                    }

                    const reply = new Record($app.findCollectionByNameOrId("posts"));
                    reply.set("content", truncateReply(rawReply));
                    reply.set("author", beaurokUser.id);
                    reply.set("actionType", "reply");
                    reply.set("targetType", "post");
                    reply.set("targetId", post.id);
                    reply.set("replyTo", post.id);
                    reply.set("targetMeta", JSON.stringify({ authorName, authorUsername, content }));
                    $app.save(reply);
                } catch (beaurokErr) {
                    console.error("[BeauRok] Error generando respuesta:", beaurokErr.message || beaurokErr);
                }
                return;
            }

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
