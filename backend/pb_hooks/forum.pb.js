/// <reference path="../pb_data/types.d.ts" />

// Hook para actualización directa y confiable del contador de comentarios (commentCount)

console.log("[LOAD] forum.pb.js hook loaded!");

onRecordCreateRequest((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const replyTo = e.record.getString("replyTo");
        const targetType = e.record.getString("targetType");
        const targetId = e.record.getString("targetId");

        // Sincronización bidireccional entre replyTo y targetId
        if (replyTo && !targetId) {
            e.record.set("actionType", "reply");
            if (!targetType) e.record.set("targetType", "post");
            e.record.set("targetId", replyTo);
        }
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

// Incrementar commentCount del post padre al crear una respuesta
onRecordAfterCreateSuccess((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const replyTo = e.record.getString("replyTo");
        const targetId = e.record.getString("targetId");
        const parentId = targetId || replyTo;

        if ((actionType === "reply" || replyTo) && parentId) {
            try {
                const parent = $app.findRecordById("posts", parentId);
                const currentCount = parent.getInt("commentCount") || 0;
                parent.set("commentCount", currentCount + 1);
                $app.save(parent);
                console.log(`[forum.pb.js] Incrementado commentCount de ${parentId}: ${currentCount} -> ${currentCount + 1}`);
            } catch (err) {
                console.log(`[forum.pb.js] No se encontró el padre ${parentId} para incrementar commentCount:`, err);
            }
        }
    } catch (err) {
        console.log("[forum.pb.js] Error in onRecordAfterCreateSuccess:", err);
    }
}, "posts");

// Decrementar commentCount del post padre al eliminar una respuesta
onRecordAfterDeleteSuccess((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const replyTo = e.record.getString("replyTo");
        const targetId = e.record.getString("targetId");
        const parentId = targetId || replyTo;

        if ((actionType === "reply" || replyTo) && parentId) {
            try {
                const parent = $app.findRecordById("posts", parentId);
                const currentCount = parent.getInt("commentCount") || 0;
                const newCount = Math.max(0, currentCount - 1);
                parent.set("commentCount", newCount);
                $app.save(parent);
                console.log(`[forum.pb.js] Decrementado commentCount de ${parentId}: ${currentCount} -> ${newCount}`);
            } catch (err) {
                console.log(`[forum.pb.js] No se encontró el padre ${parentId} para decrementar commentCount:`, err);
            }
        }
    } catch (err) {
        console.log("[forum.pb.js] Error in onRecordAfterDeleteSuccess:", err);
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
