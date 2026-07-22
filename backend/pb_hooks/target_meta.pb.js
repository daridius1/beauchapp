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
                const expand = targetRecord.expand();
                const author = expand ? expand["author"] : null;
                meta = {
                    authorName: author ? author.getString("name") : "Usuario",
                    authorUsername: author ? author.getString("username") : "",
                    authorAvatar: author ? author.getString("avatar") : "",
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
                    const expand = targetRecord.expand();
                    if (expand && expand["team_red"]) {
                        teamRed = expand["team_red"].map(u => u.getString("name"));
                    }
                    if (expand && expand["team_blue"]) {
                        teamBlue = expand["team_blue"].map(u => u.getString("name"));
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
