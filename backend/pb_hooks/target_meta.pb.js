/// <reference path="../pb_data/types.d.ts" />

// Asegurar que posts sin texto escrito contengan al menos " " para pasar validaciones del esquema
onRecordCreate((e) => {
    try {
        const content = e.record.getString("content");
        if (!content || content.trim() === "") {
            e.record.set("content", " ");
        }
    } catch (err) {}
    return e.next();
}, "posts");

// Auto-generar snapshot `targetMeta` para citas/reposts al crear una publicación
onRecordAfterCreateSuccess((e) => {
    try {
        const post = e.record;
        const targetType = post.getString("targetType");
        const targetId = post.getString("targetId");
        const existingMetaStr = post.getString("targetMeta");

        if (!targetType || !targetId || (existingMetaStr && existingMetaStr !== "{}" && existingMetaStr !== "null")) {
            return;
        }

        let meta = null;

        if (targetType === "post") {
            try {
                const targetRecord = $app.findRecordById("posts", targetId);
                const authorId = targetRecord.getString("author");
                let authorName = "Usuario";
                let authorUsername = "";
                let authorAvatar = "";

                if (authorId) {
                    try {
                        const authorRecord = $app.findRecordById("users", authorId);
                        authorName = authorRecord.getString("name");
                        authorUsername = authorRecord.getString("username");
                        authorAvatar = authorRecord.getString("avatar");
                    } catch (err) {}
                }

                meta = {
                    authorName: authorName,
                    authorUsername: authorUsername,
                    authorAvatar: authorAvatar,
                    content: targetRecord.getString("content"),
                    photo: targetRecord.getString("photo"),
                    created: targetRecord.getString("created"),
                };
            } catch (err) {
                console.log("[Target Meta] Target post not found:", err);
            }
        } else if (targetType === "problem") {
            try {
                const targetRecord = $app.findRecordById("problems", targetId);
                const parentId = targetRecord.getString("parent");
                meta = {
                    title: targetRecord.getString("title"),
                    subtitle: parentId ? "Pauta" : "Enunciado",
                    ramo: targetRecord.getString("ramo"),
                    instancia: targetRecord.getString("instancia"),
                };
            } catch (err) {
                console.log("[Target Meta] Target problem not found:", err);
            }
        } else if (targetType === "match") {
            try {
                const targetRecord = $app.findRecordById("ladder_matches", targetId);
                let teamRed = [];
                let teamBlue = [];
                try {
                    const redIds = targetRecord.getStringSlice("team_red");
                    const blueIds = targetRecord.getStringSlice("team_blue");

                    for (let i = 0; i < redIds.length; i++) {
                        try {
                            const u = $app.findRecordById("users", redIds[i]);
                            teamRed.push(u.getString("name"));
                        } catch (err) {}
                    }
                    for (let i = 0; i < blueIds.length; i++) {
                        try {
                            const u = $app.findRecordById("users", blueIds[i]);
                            teamBlue.push(u.getString("name"));
                        } catch (err) {}
                    }
                } catch (e) {}

                meta = {
                    mode: targetRecord.getString("mode"),
                    scoreRed: targetRecord.getInt("score_red"),
                    scoreBlue: targetRecord.getInt("score_blue"),
                    teamRed: teamRed,
                    teamBlue: teamBlue,
                };
            } catch (err) {
                console.log("[Target Meta] Target match not found:", err);
            }
        }

        if (meta) {
            post.set("targetMeta", meta);
            $app.save(post);
            console.log("[Target Meta] Auto-poblado targetMeta para post", post.id, "targetType:", targetType);
        }
    } catch (err) {
        console.log("[Target Meta] Error en hook onRecordAfterCreateSuccess:", err);
    }
}, "posts");
