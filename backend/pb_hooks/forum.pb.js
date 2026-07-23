/// <reference path="../pb_data/types.d.ts" />

// Hook para creación y recuento polimórfico de comentarios/respuestas

onRecordCreateRequest((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const replyTo = e.record.getString("replyTo");
        const targetType = e.record.getString("targetType");
        const targetId = e.record.getString("targetId");

        // Compatibilidad: si usa replyTo legacy sin actionType, mapear a polimórfico
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
        console.log("[forum.pb.js] ERROR in posts create hook:", outerErr);
    }
}, "posts");

// Recalcular commentCount del post padre después de crear una respuesta
onRecordAfterCreateSuccess((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const targetId = e.record.getString("targetId") || e.record.getString("replyTo");

        if ((actionType === "reply" || e.record.getString("replyTo")) && targetId) {
            recalcCommentCount(targetId);
        }
    } catch (err) {
        console.log("[forum.pb.js] Error updating comment count after create:", err);
    }
}, "posts");

// Recalcular commentCount del post padre después de eliminar una respuesta
onRecordAfterDeleteSuccess((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const targetId = e.record.getString("targetId") || e.record.getString("replyTo");

        if ((actionType === "reply" || e.record.getString("replyTo")) && targetId) {
            recalcCommentCount(targetId);
        }
    } catch (err) {
        console.log("[forum.pb.js] Error updating comment count after delete:", err);
    }
}, "posts");

// Función compartida: recalcular el commentCount de un post padre
function recalcCommentCount(parentPostId) {
    try {
        // Contar respuestas polimórficas (nuevo) + respuestas legacy (replyTo)
        const rows = arrayOf(new DynamicModel({ "total": 0 }));
        $app.db().newQuery(
            "SELECT COUNT(*) as total FROM posts WHERE ((actionType = 'reply' AND targetType = 'post' AND targetId = {:pid}) OR (replyTo = {:pid} AND (actionType IS NULL OR actionType = '' OR actionType = 'reply'))) AND deleted = false"
        ).bind({ "pid": parentPostId }).all(rows);

        const newCount = rows.length > 0 ? rows[0].total : 0;

        $app.db().newQuery(
            "UPDATE posts SET commentCount = {:count} WHERE id = {:pid}"
        ).bind({ "count": newCount, "pid": parentPostId }).execute();
    } catch (err) {
        console.log("[forum.pb.js] Error in recalcCommentCount:", err);
    }
}

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
