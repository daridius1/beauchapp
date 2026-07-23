/// <reference path="../pb_data/types.d.ts" />

// Hook para actualización directa del árbol de comentarios (replyTo / root)

console.log("[LOAD] forum.pb.js hook loaded!");

onRecordCreateRequest((e) => {
    console.log("[DEBUG] onRecordCreateRequest triggered for post ID:", e.record.id || "new");

    try {
        const parentId = e.record.getString("replyTo");

        if (parentId) {
            // Es una respuesta: limpiar tags
            e.record.set("tags", []);

            // Buscar el root
            try {
                const parent = $app.findRecordById("posts", parentId);
                let rootId = parent.getString("root");
                if (!rootId) {
                    rootId = parent.id; // El padre es la raíz
                }
                e.record.set("root", rootId);
                console.log(`[DEBUG] Asignado rootId ${rootId} a la respuesta`);
            } catch (err) {
                console.log("[DEBUG] Error buscando root en create hook:", err);
            }
        }

        // Inicializar conteo propio en 0
        e.record.set("commentCount", 0);
        return e.next();
    } catch (outerErr) {
        console.log("[DEBUG] OUTER ERROR in posts create hook:", outerErr);
    }
}, "posts");

// Incrementar commentCount en toda la cadena de ancestros (replyTo) al crear una respuesta
onRecordAfterCreateSuccess((e) => {
    console.log("[DEBUG] forum.pb.js onRecordAfterCreateSuccess triggered for post ID:", e.record.id);
    const parentId = e.record.getString("replyTo");

    if (parentId) {
        let curr = parentId;
        const visited = new Set();
        let depth = 0;

        while (curr && depth < 20 && !visited.has(curr)) {
            visited.add(curr);
            try {
                const parent = $app.findRecordById("posts", curr);
                const currentCount = parent.getInt("commentCount") || 0;
                parent.set("commentCount", currentCount + 1);
                $app.save(parent);
                console.log(`[DEBUG] Incrementado commentCount para ${curr}: ${currentCount} -> ${currentCount + 1}`);

                curr = parent.getString("replyTo");
            } catch (err) {
                console.log(`[DEBUG] Error actualizando commentCount para ancestro ${curr}:`, err);
                break;
            }
            depth++;
        }
    }
}, "posts");

// Decrementar commentCount en toda la cadena de ancestros (replyTo) al eliminar una respuesta
onRecordAfterDeleteSuccess((e) => {
    console.log("[DEBUG] forum.pb.js onRecordAfterDeleteSuccess triggered for post ID:", e.record.id);
    const parentId = e.record.getString("replyTo");

    if (parentId) {
        let curr = parentId;
        const visited = new Set();
        let depth = 0;

        while (curr && depth < 20 && !visited.has(curr)) {
            visited.add(curr);
            try {
                const parent = $app.findRecordById("posts", curr);
                const currentCount = parent.getInt("commentCount") || 0;
                const newCount = Math.max(0, currentCount - 1);
                parent.set("commentCount", newCount);
                $app.save(parent);
                console.log(`[DEBUG] Decrementado commentCount para ${curr}: ${currentCount} -> ${newCount}`);

                curr = parent.getString("replyTo");
            } catch (err) {
                console.log(`[DEBUG] Error decrementando commentCount para ancestro ${curr}:`, err);
                break;
            }
            depth++;
        }
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
