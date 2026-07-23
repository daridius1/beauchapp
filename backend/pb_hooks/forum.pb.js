/// <reference path="../pb_data/types.d.ts" />

// Hook para creación y recuento polimórfico de comentarios/respuestas

console.log("[LOAD] forum.pb.js hook loaded!");

onRecordCreateRequest((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const replyTo = e.record.getString("replyTo");
        const targetType = e.record.getString("targetType");
        const targetId = e.record.getString("targetId");

        // Compatibilidad bidireccional:
        // 1. Si viene replyTo legacy, asegurar actionType = reply y targetId = replyTo
        if (replyTo && !targetId) {
            e.record.set("actionType", "reply");
            if (!targetType) e.record.set("targetType", "post");
            e.record.set("targetId", replyTo);
        }
        // 2. Si viene targetId polimórfico en post, asegurar replyTo = targetId
        if (actionType === "reply" && targetType === "post" && targetId && !replyTo) {
            e.record.set("replyTo", targetId);
        }

        // Si es un comentario/respuesta, limpiar tags
        if (e.record.getString("actionType") === "reply" || replyTo) {
            e.record.set("tags", []);
        }

        // Inicializar conteo de comentarios propios en 0
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

// Función compartida: recalcular el commentCount de un post padre usando $app.countRecords
function recalcCommentCount(parentPostId) {
    if (!parentPostId) return;
    try {
        const count = $app.countRecords(
            "posts",
            `((targetId = "${parentPostId}" && actionType = "reply") || replyTo = "${parentPostId}") && deleted = false`
        );

        $app.db().newQuery(
            "UPDATE posts SET commentCount = {:count} WHERE id = {:pid}"
        ).bind({ "count": count, "pid": parentPostId }).execute();

        console.log(`[forum.pb.js] Updated commentCount for post ${parentPostId} -> ${count}`);
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
