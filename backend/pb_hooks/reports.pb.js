/// <reference path="../pb_data/types.d.ts" />

// Notificación opcional por Telegram cuando se crea un reporte. Puramente informativo (por
// eso onRecordAfterCreateSuccess, no bloquea ni afecta la respuesta al usuario que reportó):
// si TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no están configuradas (caso por defecto), el reporte
// igual queda guardado y solo se puede revisar desde el dashboard de PocketBase.
onRecordAfterCreateSuccess((e) => {
    try {
        const botToken = $os.getenv("TELEGRAM_BOT_TOKEN");
        const chatId = $os.getenv("TELEGRAM_CHAT_ID");
        if (!botToken || !chatId) {
            return;
        }

        const report = e.record;
        const reporterId = report.getString("reporter");
        let reporterLabel = "Alguien";
        try {
            const reporter = $app.findRecordById("users", reporterId);
            reporterLabel = reporter.getString("name") + " (@" + reporter.getString("username") + ")";
        } catch (err) {}

        const targetType = report.getString("targetType");
        const targetId = report.getString("targetId");
        const title = report.getString("title");
        const message = report.getString("message");

        // Mismo patrón de mapeo targetType -> colección + resumen legible que ya usan
        // forum.pb.js / target_meta.pb.js / enrich_targets.pb.js para el sistema de citas.
        // Se define adentro del callback (no a nivel de archivo): el runtime JSVM de
        // PocketBase no conserva funciones de nivel de archivo dentro de closures
        // registrados vía onRecord*, mismo caveat ya documentado en mentions.pb.js.
        let targetSummary = "(Sugerencia/bug general, sin contenido asociado)";
        let targetLink = null;

        if (targetType && targetId) {
            try {
                if (targetType === "post") {
                    const post = $app.findRecordById("posts", targetId);
                    let authorLabel = "Usuario";
                    try {
                        const author = $app.findRecordById("users", post.getString("author"));
                        authorLabel = author.getString("name") + " (@" + author.getString("username") + ")";
                    } catch (err) {}
                    const content = post.getString("content") || "";
                    targetSummary = "Publicación/comentario de " + authorLabel + ": \"" + content.slice(0, 200) + (content.length > 200 ? "..." : "") + "\"";
                } else if (targetType === "problem") {
                    const problem = $app.findRecordById("problems", targetId);
                    targetSummary = "Problema: \"" + problem.getString("title") + "\"" + (problem.getString("ramo") ? " (" + problem.getString("ramo") + ")" : "");
                    targetLink = "problems/" + targetId;
                } else if (targetType === "match") {
                    const match = $app.findRecordById("ladder_matches", targetId);
                    let ladderName = "Partido";
                    try {
                        ladderName = $app.findRecordById("ladders", match.getString("ladder")).getString("name");
                    } catch (err) {}
                    targetSummary = ladderName + " · " + match.getString("mode") + " · " + match.getInt("score_red") + "-" + match.getInt("score_blue");
                    targetLink = "ladders/matches/" + targetId;
                } else if (targetType === "marketplace_item" || targetType === "product") {
                    const item = $app.findRecordById("marketplace_items", targetId);
                    targetSummary = "Producto: \"" + item.getString("title") + "\" ($" + item.getInt("price") + ")";
                    targetLink = "marketplace/item/" + targetId;
                } else if (targetType === "user") {
                    const targetUser = $app.findRecordById("users", targetId);
                    targetSummary = "Perfil: " + targetUser.getString("name") + " (@" + targetUser.getString("username") + ")";
                    targetLink = "users/" + targetId;
                } else if (targetType === "course") {
                    const course = $app.findRecordById("courses", targetId);
                    targetSummary = "Ramo: " + course.getString("nombre") + " (" + course.getString("codigo") + ")";
                    targetLink = "reviews/course/" + targetId;
                } else if (targetType === "activity") {
                    const activity = $app.findRecordById("activities", targetId);
                    targetSummary = "Actividad: \"" + activity.getString("title") + "\"";
                    targetLink = "activities/" + targetId;
                } else {
                    targetSummary = "Contenido reportado: " + targetType + " (" + targetId + ")";
                }
            } catch (err) {
                targetSummary = "Contenido reportado (" + targetType + ", id " + targetId + ") ya no existe o no se pudo cargar.";
            }
        }

        // No hay una señal 100% confiable de "producción vs local" (--dev es opcional y no
        // se usa consistentemente en desarrollo local en este proyecto), así que en vez de
        // adivinar se muestra directamente qué APP_URL tiene configurada esta instancia:
        // si no hay ninguna (el caso típico de correr local sin .env), se marca como tal.
        const appUrl = $os.getenv("APP_URL");
        const envLabel = appUrl ? appUrl.replace(/\/$/, "") : "local (sin APP_URL configurada)";

        let text = "Nuevo reporte: " + title + "\n\nDe " + reporterLabel + ":\n" + message;
        text += "\n\n" + targetSummary;
        if (targetLink && appUrl) {
            text += "\nVer: " + appUrl.replace(/\/$/, "") + "/" + targetLink;
        }
        text += "\n\nEntorno: " + envLabel;

        $http.send({
            url: "https://api.telegram.org/bot" + botToken + "/sendMessage",
            method: "POST",
            body: JSON.stringify({ chat_id: chatId, text: text }),
            headers: { "Content-Type": "application/json" },
            timeout: 10,
        });
    } catch (err) {
        console.error("[reports.pb.js] Error enviando notificación de Telegram:", err.message || err);
    }
}, "reports");
