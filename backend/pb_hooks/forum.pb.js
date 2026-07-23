/// <reference path="../pb_data/types.d.ts" />

// Hook para creación y recuento polimórfico de comentarios/respuestas

onRecordCreateRequest((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const replyTo = e.record.getString("replyTo");
        const targetType = e.record.getString("targetType");
        const targetId = e.record.getString("targetId");

        // Si es una respuesta por replyTo legacy, asegurar que actionType sea 'reply' y targetType 'post'
        if (replyTo && !actionType) {
            e.record.set("actionType", "reply");
            if (!targetType) e.record.set("targetType", "post");
            if (!targetId) e.record.set("targetId", replyTo);
        }

        // Si es un comentario/respuesta, limpiar tags
        if (e.record.getString("actionType") === "reply") {
            e.record.set("tags", []);
        }

        // Inicializar conteo
        e.record.set("commentCount", 0);
        return e.next();
    } catch (outerErr) {
        console.log("[DEBUG] ERROR in posts create hook:", outerErr);
    }
}, "posts");

onRecordAfterCreateSuccess((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const targetType = e.record.getString("targetType") || (e.record.getString("replyTo") ? "post" : "");
        const targetId = e.record.getString("targetId") || e.record.getString("replyTo");

        if ((actionType === "reply" || e.record.getString("replyTo")) && targetId) {
            if (targetType === "post") {
                $app.db().newQuery(
                    "UPDATE posts SET commentCount = (SELECT COUNT(*) FROM posts WHERE (targetId = {:tId} OR replyTo = {:tId}) AND (actionType = 'reply' OR replyTo != '') AND deleted = false) WHERE id = {:tId}"
                ).bind({ "tId": targetId }).execute();
            }
        }
    } catch (err) {
        console.log("[forum.pb.js] Error updating comment count after create:", err);
    }
}, "posts");

onRecordAfterDeleteSuccess((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const targetType = e.record.getString("targetType") || (e.record.getString("replyTo") ? "post" : "");
        const targetId = e.record.getString("targetId") || e.record.getString("replyTo");

        if ((actionType === "reply" || e.record.getString("replyTo")) && targetId) {
            if (targetType === "post") {
                $app.db().newQuery(
                    "UPDATE posts SET commentCount = (SELECT COUNT(*) FROM posts WHERE (targetId = {:tId} OR replyTo = {:tId}) AND (actionType = 'reply' OR replyTo != '') AND deleted = false) WHERE id = {:tId}"
                ).bind({ "tId": targetId }).execute();
            }
        }
    } catch (err) {
        console.log("[forum.pb.js] Error updating comment count after delete:", err);
    }
}, "posts");

// Redactar posts/comentarios eliminados para no administradores
onRecordEnrich((e) => {
    if (e.record.getBool("deleted")) {
        const isAdmin = e.requestInfo && e.requestInfo.admin;
        if (!isAdmin) {
            e.record.set("content", "[post/comentario eliminado]");
            e.record.set("photo", "");
            e.record.set("author", "");
            try {
                const expand = e.record.expand();
                if (expand && expand["author"]) {
                    delete expand["author"];
                }
            } catch (err) {}
        }
    }
    return e.next();
}, "posts");
