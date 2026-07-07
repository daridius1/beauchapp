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

// 1.5. Proteger campo type (solo admins reales de PocketBase pueden modificarlo)
onRecordUpdateRequest((e) => {
    const original = e.record.originalCopy();
    if (e.record.get("type") !== original.get("type")) {
        if (!e.auth || !e.auth.isSuperuser()) {
            e.record.set("type", original.get("type"));
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

// 8. Control de acceso para team_members
onRecordCreateRequest((e) => {
    console.log("team_members CREATE hook triggered!");
    
    const checkTeamPermsLocal = (ev) => {
        try {
            if (!ev.auth) return { allowed: false, reason: "No auth" };
            if (ev.auth.isSuperuser()) return { allowed: true };
            const teamId = ev.record.getString("team");
            if (!teamId) return { allowed: false, reason: "No teamId" };
            let team = null;
            try {
                team = $app.findRecordById("teams", teamId);
            } catch(err) {
                 return { allowed: false, reason: "Team not found" };
            }
            if (team && team.getString("owner_org") === ev.auth.id) return { allowed: true };
            const adminMemberships = $app.findRecordsByFilter(
                "team_members",
                "team = {:team} && user = {:user} && role = 'admin' && status = 'active'",
                "",
                1,
                0,
                { team: teamId, user: ev.auth.id }
            );
            if (adminMemberships.length > 0) return { allowed: true };
            return { allowed: false, reason: "Not owner nor admin." };
        } catch (err) {
            return { allowed: false, reason: "Exception: " + err.message };
        }
    };

    const res = checkTeamPermsLocal(e);
    console.log("checkTeamPerms result:", JSON.stringify(res));
    if (!res.allowed) {
        throw new ApiError(400, "No tienes permisos. Razón: " + res.reason);
    }

    const userId = e.record.getString("user");
    if (!userId) {
        throw new ApiError(400, "El campo 'user' es requerido.");
    }

    try {
        $app.findRecordById("users", userId);
    } catch(err) {
        throw new ApiError(400, "El usuario no existe.");
    }

    const teamId = e.record.getString("team");
    if (!teamId) {
        throw new ApiError(400, "El campo 'team' es requerido.");
    }

    const existing = $app.findRecordsByFilter(
        "team_members",
        "team = {:team} && user = {:user}",
        "",
        1,
        0,
        { team: teamId, user: userId }
    );
    if (existing.length > 0) {
        throw new ApiError(400, "El usuario ya es miembro de este equipo.");
    }

    return e.next();
}, "team_members");

onRecordUpdateRequest((e) => {
    const checkTeamPermsLocal = (ev) => {
        try {
            if (!ev.auth) return { allowed: false, reason: "No auth" };
            if (ev.auth.isSuperuser()) return { allowed: true };
            const teamId = ev.record.getString("team");
            if (!teamId) return { allowed: false, reason: "No teamId" };
            let team = null;
            try {
                team = $app.findRecordById("teams", teamId);
            } catch(err) {
                 return { allowed: false, reason: "Team not found" };
            }
            if (team && team.getString("owner_org") === ev.auth.id) return { allowed: true };
            const adminMemberships = $app.findRecordsByFilter(
                "team_members",
                "team = {:team} && user = {:user} && role = 'admin' && status = 'active'",
                "",
                1,
                0,
                { team: teamId, user: ev.auth.id }
            );
            if (adminMemberships.length > 0) return { allowed: true };
            return { allowed: false, reason: "Not owner nor admin." };
        } catch (err) {
            return { allowed: false, reason: "Exception: " + err.message };
        }
    };

    const res = checkTeamPermsLocal(e);
    if (!res.allowed) {
        throw new ApiError(400, "No tienes permisos para modificar. Razón: " + res.reason);
    }
    return e.next();
}, "team_members");

onRecordDeleteRequest((e) => {
    const checkTeamPermsLocal = (ev) => {
        try {
            if (!ev.auth) return { allowed: false, reason: "No auth" };
            if (ev.auth.isSuperuser()) return { allowed: true };
            
            // Allow user to delete their own membership (leave the team)
            const userId = ev.record.getString("user");
            if (userId && userId === ev.auth.id) return { allowed: true };

            const teamId = ev.record.getString("team");
            if (!teamId) return { allowed: false, reason: "No teamId" };
            let team = null;
            try {
                team = $app.findRecordById("teams", teamId);
            } catch(err) {
                 return { allowed: false, reason: "Team not found" };
            }
            if (team && team.getString("owner_org") === ev.auth.id) return { allowed: true };
            const adminMemberships = $app.findRecordsByFilter(
                "team_members",
                "team = {:team} && user = {:user} && role = 'admin' && status = 'active'",
                "",
                1,
                0,
                { team: teamId, user: ev.auth.id }
            );
            if (adminMemberships.length > 0) return { allowed: true };
            return { allowed: false, reason: "Not owner, admin, nor the member itself." };
        } catch (err) {
            return { allowed: false, reason: "Exception: " + err.message };
        }
    };

    const res = checkTeamPermsLocal(e);
    if (!res.allowed) {
        throw new ApiError(400, "No tienes permisos para eliminar este miembro. Razón: " + res.reason);
    }
    return e.next();
}, "team_members");
