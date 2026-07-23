/// <reference path="../pb_data/types.d.ts" />

// Hook para administración de árbol de posts (replyTo / root), citas polimórficas (quote), conteo de citas (quoteCount) y comentarios a objetos no-post (comment)

console.log("[LOAD] forum.pb.js hook loaded!");

onRecordCreateRequest((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const replyTo = e.record.getString("replyTo");
        const targetType = e.record.getString("targetType");
        const targetId = e.record.getString("targetId");

        // 1. Manejo de Respuestas a Posts (vía replyTo / root)
        if (replyTo || (actionType === "reply" && targetType === "post")) {
            e.record.set("actionType", "reply");
            if (!targetType) e.record.set("targetType", "post");
            if (replyTo && !targetId) e.record.set("targetId", replyTo);
            if (targetId && !replyTo) e.record.set("replyTo", targetId);

            e.record.set("tags", []);

            try {
                const parent = $app.findRecordById("posts", targetId || replyTo);
                let rootId = parent.getString("root") || parent.id;
                e.record.set("root", rootId);
            } catch (err) {
                console.log("[forum.pb.js] Error buscando root:", err);
            }
        } 
        // 2. Manejo de Comentarios Polimórficos a Objetos No-Post (Problemas, Partidos, etc.)
        else if (actionType === "comment" && targetType && targetType !== "post" && targetId) {
            e.record.set("replyTo", "");
            e.record.set("root", "");
            try {
                const collectionName = targetType === "problem" ? "problems" : (targetType === "match" ? "ladder_matches" : "posts");
                const targetRecord = $app.findRecordById(collectionName, targetId);
                const targetTags = targetRecord.get("tags") || [];
                e.record.set("tags", targetTags);
            } catch (err) {
                console.log(`[forum.pb.js] Error buscando tags de ${targetType} ${targetId}:`, err);
            }
        }

        e.record.set("commentCount", 0);
        e.record.set("quoteCount", 0);
        return e.next();
    } catch (outerErr) {
        console.log("[forum.pb.js] ERROR in posts create hook:", outerErr);
    }
}, "posts");

// Incrementar commentCount en ancestros y quoteCount en elemento objetivo al crear un registro
onRecordAfterCreateSuccess((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const replyTo = e.record.getString("replyTo");
        const targetType = e.record.getString("targetType");
        const targetId = e.record.getString("targetId");

        // Incrementar quoteCount si es una cita
        if (actionType === "quote" && targetId && targetType) {
            try {
                const collectionName = targetType === "problem" ? "problems" : (targetType === "match" ? "ladder_matches" : "posts");
                const targetRecord = $app.findRecordById(collectionName, targetId);
                const currentQuotes = targetRecord.getInt("quoteCount") || 0;
                targetRecord.set("quoteCount", currentQuotes + 1);
                $app.save(targetRecord);
                console.log(`[forum.pb.js] Incrementado quoteCount para ${targetType} ${targetId}: ${currentQuotes} -> ${currentQuotes + 1}`);
            } catch (err) {
                console.log(`[forum.pb.js] Error incrementando quoteCount para ${targetType} ${targetId}:`, err);
            }
        }

        // Incrementar commentCount para respuestas a posts
        let parentId = targetId || replyTo;
        if ((actionType === "reply" || replyTo) && parentId) {
            let depth = 0;
            const visited = new Set();

            while (parentId && depth < 20 && !visited.has(parentId)) {
                visited.add(parentId);
                try {
                    const parent = $app.findRecordById("posts", parentId);
                    const currentCount = parent.getInt("commentCount") || 0;
                    parent.set("commentCount", currentCount + 1);
                    $app.save(parent);
                    console.log(`[forum.pb.js] Incrementado commentCount para ${parentId}: ${currentCount} -> ${currentCount + 1}`);

                    curr = parent.getString("replyTo");
                } catch (err) {
                    console.log(`[forum.pb.js] Error actualizando commentCount para ancestro ${parentId}:`, err);
                    break;
                }
                depth++;
            }
        }
    } catch (err) {
        console.log("[forum.pb.js] Error in onRecordAfterCreateSuccess:", err);
    }
}, "posts");

// Decrementar commentCount y quoteCount al eliminar un registro
onRecordAfterDeleteSuccess((e) => {
    try {
        const actionType = e.record.getString("actionType");
        const replyTo = e.record.getString("replyTo");
        const targetType = e.record.getString("targetType");
        const targetId = e.record.getString("targetId");

        // Decrementar quoteCount si se elimina una cita
        if (actionType === "quote" && targetId && targetType) {
            try {
                const collectionName = targetType === "problem" ? "problems" : (targetType === "match" ? "ladder_matches" : "posts");
                const targetRecord = $app.findRecordById(collectionName, targetId);
                const currentQuotes = targetRecord.getInt("quoteCount") || 0;
                const newQuotes = Math.max(0, currentQuotes - 1);
                targetRecord.set("quoteCount", newQuotes);
                $app.save(targetRecord);
                console.log(`[forum.pb.js] Decrementado quoteCount para ${targetType} ${targetId}: ${currentQuotes} -> ${newQuotes}`);
            } catch (err) {
                console.log(`[forum.pb.js] Error decrementando quoteCount para ${targetType} ${targetId}:`, err);
            }
        }

        // Decrementar commentCount para respuestas a posts
        let parentId = targetId || replyTo;
        if ((actionType === "reply" || replyTo) && parentId) {
            let depth = 0;
            const visited = new Set();

            while (parentId && depth < 20 && !visited.has(parentId)) {
                visited.add(parentId);
                try {
                    const parent = $app.findRecordById("posts", parentId);
                    const currentCount = parent.getInt("commentCount") || 0;
                    const newCount = Math.max(0, currentCount - 1);
                    parent.set("commentCount", newCount);
                    $app.save(parent);
                    console.log(`[forum.pb.js] Decrementado commentCount para ${parentId}: ${currentCount} -> ${newCount}`);

                    curr = parent.getString("replyTo");
                } catch (err) {
                    console.log(`[forum.pb.js] Error decrementando commentCount para ancestro ${parentId}:`, err);
                    break;
                }
                depth++;
            }
        }
    } catch (err) {
        console.log("[forum.pb.js] Error in onRecordAfterDeleteSuccess:", err);
    }
}, "posts");

// Redactar posts eliminados para no administradores
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
