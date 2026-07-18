/// <reference path="../pb_data/types.d.ts" />

// 6. Lógica de Árboles Estilo Reddit para Posts (Lógica inyectada directamente en los hooks)

onRecordCreateRequest((e) => {
    console.log("[DEBUG] onRecordCreateRequest triggered for posts");
    console.log("[DEBUG] Auth user ID:", e.auth ? e.auth.id : "null");
    console.log("[DEBUG] Record author field:", e.record.get("author"));
    console.log("[DEBUG] Is superuser auth:", e.hasSuperuserAuth());

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
            } catch (err) {
                console.log("[DEBUG] Error in root hook:", err);
            }
        }

        // Inicializar conteo
        e.record.set("commentCount", 0);
        console.log("[DEBUG] Posts check passed, calling e.next()...");
        return e.next();
    } catch (outerErr) {
        console.log("[DEBUG] OUTER ERROR in posts create hook:", outerErr);
    }
}, "posts");

onRecordAfterCreateSuccess((e) => {
    const rootId = e.record.getString("root");
    if (rootId) {
        try {
            const rows = arrayOf(new DynamicModel({ "id": "", "replyTo": "", "commentCount": 0 }));
            $app.db().select("id", "replyTo", "commentCount").from("posts").where(
                $dbx.or($dbx.hashExp({ "root": rootId }), $dbx.hashExp({ "id": rootId }))
            ).all(rows);
            
            const childrenMap = {};
            for (let j = 0; j < rows.length; j++) {
                const r = rows[j];
                if (r.replyTo) {
                    if (!childrenMap[r.replyTo]) childrenMap[r.replyTo] = [];
                    childrenMap[r.replyTo].push(r.id);
                }
            }
            
            function countDescendants(postId) {
                const kids = childrenMap[postId] || [];
                let count = kids.length;
                for (let i = 0; i < kids.length; i++) {
                    count += countDescendants(kids[i]);
                }
                return count;
            }
            
            for (let j = 0; j < rows.length; j++) {
                const r = rows[j];
                const newCount = countDescendants(r.id);
                if (r.commentCount !== newCount) {
                    $app.db().newQuery("UPDATE posts SET commentCount = {:count} WHERE id = {:id}").bind({
                        "count": newCount,
                        "id": r.id,
                    }).execute();
                }
            }
        } catch (err) {
            console.log("Error recalcTree create:", err);
        }
    }

}, "posts");

onRecordAfterDeleteSuccess((e) => {
    const rootId = e.record.getString("root");
    if (rootId) {
        try {
            const rows = arrayOf(new DynamicModel({ "id": "", "replyTo": "", "commentCount": 0 }));
            $app.db().select("id", "replyTo", "commentCount").from("posts").where(
                $dbx.or($dbx.hashExp({ "root": rootId }), $dbx.hashExp({ "id": rootId }))
            ).all(rows);
            
            const childrenMap = {};
            for (let j = 0; j < rows.length; j++) {
                const r = rows[j];
                if (r.replyTo) {
                    if (!childrenMap[r.replyTo]) childrenMap[r.replyTo] = [];
                    childrenMap[r.replyTo].push(r.id);
                }
            }
            
            function countDescendants(postId) {
                const kids = childrenMap[postId] || [];
                let count = kids.length;
                for (let i = 0; i < kids.length; i++) {
                    count += countDescendants(kids[i]);
                }
                return count;
            }
            
            for (let j = 0; j < rows.length; j++) {
                const r = rows[j];
                const newCount = countDescendants(r.id);
                if (r.commentCount !== newCount) {
                    $app.db().newQuery("UPDATE posts SET commentCount = {:count} WHERE id = {:id}").bind({
                        "count": newCount,
                        "id": r.id,
                    }).execute();
                }
            }
        } catch (err) {
            console.log("Error recalcTree delete:", err);
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

