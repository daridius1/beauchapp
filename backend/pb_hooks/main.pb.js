// Beauchapp PocketBase Hooks
// Lógica de negocio del lado del servidor - Compatible con PocketBase v0.23+

// 1. Filtro de exclusividad universitaria
// Interceptar el registro de usuarios para validar el correo institucional @ing.uchile.cl
onRecordCreateRequest((e) => {
    const type = e.record.getString("type");

    if (type === "organization") {
        // Only superusers (admins) can create an organization
        if (!e.auth || !e.auth.isSuperuser()) {
            throw new BadRequestError("No tienes permisos para crear una cuenta de organización.");
        }
        // Organizations bypass email requirements and are auto-verified
        e.record.set("verified", true);
        return;
    }

    // For everyone else, enforce student type
    e.record.set("type", "student");

    const email = e.record.getString("email");
    if (!email) {
        throw new BadRequestError("El correo electrónico es requerido para estudiantes.");
    }
    
    if (!email.endsWith("@ing.uchile.cl")) {
        throw new BadRequestError("Acceso denegado. Solo se permiten correos con el dominio @ing.uchile.cl");
    }
}, "users");

// 1.5. Proteger campos type y subtype (solo admins reales de PocketBase pueden modificarlos)
onRecordUpdateRequest((e) => {
    const original = e.record.originalCopy();
    if (e.record.get("type") !== original.get("type")) {
        if (!e.auth || !e.auth.isSuperuser()) {
            e.record.set("type", original.get("type"));
        }
    }
    if (e.record.get("subtype") !== original.get("subtype")) {
        if (!e.auth || !e.auth.isSuperuser()) {
            e.record.set("subtype", original.get("subtype"));
        }
    }
}, "users");



// 6. Lógica de Árboles Estilo Reddit para Posts (Lógica inyectada directamente en los hooks)

onRecordCreateRequest((e) => {
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
                console.log("Error in root hook:", err);
            }
        }

        // Inicializar conteo
        e.record.set("commentCount", 0);
    } catch (outerErr) {
        console.log("OUTER ERROR in posts create hook:", outerErr);
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

// 8. Validación de tipos para organization_members
onRecordCreateRequest((e) => {
    const userId = e.record.getString("user");
    const orgId = e.record.getString("organization");

    if (!userId || !orgId) {
        throw new ApiError(400, "Los campos 'user' y 'organization' son requeridos.");
    }

    try {
        const userRec = $app.findRecordById("users", userId);
        if (userRec.getString("type") !== "student") {
            throw new Error("El integrante debe ser una cuenta de estudiante.");
        }
    } catch(err) {
        throw new ApiError(400, err.message || "El usuario no existe.");
    }

    try {
        const orgRec = $app.findRecordById("users", orgId);
        if (orgRec.getString("type") !== "organization") {
            throw new Error("El destino debe ser una cuenta de organización.");
        }
    } catch(err) {
        throw new ApiError(400, err.message || "La organización no existe.");
    }

    const existing = $app.findRecordsByFilter(
        "organization_members",
        "organization = {:orgId} && user = {:userId}",
        "",
        1,
        0,
        { orgId: orgId, user: userId }
    );
    if (existing.length > 0) {
        throw new ApiError(400, "El usuario ya participa en esta organización.");
    }

    return e.next();
}, "organization_members");

onRecordUpdateRequest((e) => {
    const original = e.record.originalCopy();
    if (e.record.get("user") !== original.get("user") || e.record.get("organization") !== original.get("organization")) {
        throw new ApiError(400, "No se pueden modificar los campos 'user' u 'organization' una vez creados.");
    }
    return e.next();
}, "organization_members");
