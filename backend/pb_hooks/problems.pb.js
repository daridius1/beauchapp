/// <reference path="../pb_data/types.d.ts" />

// 12. Enlazado polimórfico: Auto-crear post al publicar un problema o pauta (con etiquetas unificadas)
onRecordAfterCreateSuccess((e) => {
    try {
        const problem = e.record;
        const authorId = problem.getString("author");
        const parentId = problem.getString("parent");
        const title = problem.getString("title");

        let isAnswer = !!parentId;
        let subtitle = isAnswer ? "Pauta" : "Enunciado";
        let contentText = "";

        // Build entityMeta
        const meta = {
            title: title,
            subtitle: subtitle,
        };

        let tags = [];
        if (!isAnswer) {
            const ramo = problem.getString("ramo");
            const semestre = problem.getString("semestre");
            const instancia = problem.getString("instancia");
            if (ramo) {
                meta.ramo = ramo;
                tags.push(ramo);
            }
            if (semestre) {
                tags.push(semestre);
            }
            if (instancia) {
                meta.instancia = instancia;
                tags.push(instancia);
            }
            // Get tags from the problem itself
            try {
                const tagsStr = problem.getString("tags");
                if (tagsStr) {
                    const tagsRaw = JSON.parse(tagsStr);
                    if (Array.isArray(tagsRaw)) {
                        tagsRaw.forEach(t => {
                            if (t && !tags.includes(t)) tags.push(t);
                        });
                    }
                }
            } catch (te) {}
        } else {
            // For answers, inherit tags from the parent problem (including its specials)
            try {
                const parentProblem = $app.findRecordById("problems", parentId);
                const ramo = parentProblem.getString("ramo");
                const semestre = parentProblem.getString("semestre");
                const instancia = parentProblem.getString("instancia");
                if (ramo) {
                    meta.ramo = ramo;
                    tags.push(ramo);
                }
                if (semestre) {
                    tags.push(semestre);
                }
                if (instancia) {
                    meta.instancia = instancia;
                    tags.push(instancia);
                }
                const parentTagsStr = parentProblem.getString("tags");
                if (parentTagsStr) {
                    const parentTags = JSON.parse(parentTagsStr);
                    if (Array.isArray(parentTags)) {
                        parentTags.forEach(t => {
                            if (t && !tags.includes(t)) tags.push(t);
                        });
                    }
                }
            } catch (pe) {
                console.log("[Entity Link] Error getting parent problem:", pe);
            }
        }

        // Create the linked post
        const postsCollection = $app.findCollectionByNameOrId("posts");
        const post = new Record(postsCollection);
        post.set("author", authorId);
        post.set("content", contentText);
        post.set("tags", tags);
        post.set("commentCount", 0);
        post.set("entityType", "problems");
        post.set("entityId", problem.id);
        post.set("entityMeta", meta);

        $app.save(post);
        console.log("[Entity Link] Created linked post", post.id, "for problem", problem.id);
    } catch (err) {
        console.log("[Entity Link] Error creating linked post:", err);
    }
}, "problems");

// 12.5. Enlazado polimórfico: Sincronizar actualizaciones (título, tags, soft-delete cascade)
onRecordAfterUpdateSuccess((e) => {
    try {
        const problem = e.record;
        const problemId = problem.id;
        const original = e.record.original();

        // 1. Soft-delete cascade (only soft-delete linked post, do NOT cascade to solutions)
        if (problem.getBool("deleted") && !original.getBool("deleted")) {
            // Soft-delete linked post
            try {
                const linkedPost = $app.findFirstRecordByFilter(
                    "posts",
                    "entityType = 'problems' && entityId = {:entityId}",
                    { entityId: problemId }
                );
                if (linkedPost && !linkedPost.getBool("deleted")) {
                    linkedPost.set("deleted", true);
                    $app.save(linkedPost);
                    console.log("[Entity Link] Soft-deleted linked post", linkedPost.id, "for problem", problemId);
                }
            } catch (err) {}
            return;
        }

        // 2. Sync updates (title, tags, ramo, semestre, instancia) to the linked post
        const parentId = problem.getString("parent");
        let isAnswer = !!parentId;
        let subtitle = isAnswer ? "Pauta" : "Enunciado";
        const title = problem.getString("title");
        let contentText = "";

        const meta = {
            title: title,
            subtitle: subtitle,
        };

        let tags = [];
        if (!isAnswer) {
            const ramo = problem.getString("ramo");
            const semestre = problem.getString("semestre");
            const instancia = problem.getString("instancia");
            if (ramo) {
                meta.ramo = ramo;
                tags.push(ramo);
            }
            if (semestre) tags.push(semestre);
            if (instancia) {
                meta.instancia = instancia;
                tags.push(instancia);
            }
            try {
                const tagsStr = problem.getString("tags");
                if (tagsStr) {
                    const tagsRaw = JSON.parse(tagsStr);
                    if (Array.isArray(tagsRaw)) {
                        tagsRaw.forEach(t => {
                            if (t && !tags.includes(t)) tags.push(t);
                        });
                    }
                }
            } catch (te) {}
        } else {
            try {
                const parentProblem = $app.findRecordById("problems", parentId);
                const ramo = parentProblem.getString("ramo");
                const semestre = parentProblem.getString("semestre");
                const instancia = parentProblem.getString("instancia");
                if (ramo) {
                    meta.ramo = ramo;
                    tags.push(ramo);
                }
                if (semestre) tags.push(semestre);
                if (instancia) {
                    meta.instancia = instancia;
                    tags.push(instancia);
                }
                const parentTagsStr = parentProblem.getString("tags");
                if (parentTagsStr) {
                    const parentTags = JSON.parse(parentTagsStr);
                    if (Array.isArray(parentTags)) {
                        parentTags.forEach(t => {
                            if (t && !tags.includes(t)) tags.push(t);
                        });
                    }
                }
            } catch (pe) {}
        }

        try {
            const linkedPost = $app.findFirstRecordByFilter(
                "posts",
                "entityType = 'problems' && entityId = {:entityId}",
                { entityId: problemId }
            );
            if (linkedPost) {
                linkedPost.set("content", contentText);
                linkedPost.set("tags", tags);
                linkedPost.set("entityMeta", meta);
                $app.save(linkedPost);
                console.log("[Entity Link] Updated linked post", linkedPost.id, "for problem", problemId);
            }
        } catch (err) {}
    } catch (err) {
        console.log("[Entity Link] Error in onRecordAfterUpdateSuccess problems:", err);
    }
}, "problems");

// 13. Limpieza: eliminar post enlazado al borrar un problema (hard-delete residual)
onRecordAfterDeleteSuccess((e) => {
    try {
        const problemId = e.record.id;
        const linkedPost = $app.findFirstRecordByFilter(
            "posts",
            "entityType = 'problems' && entityId = {:entityId}",
            { entityId: problemId }
        );
        if (linkedPost) {
            $app.delete(linkedPost);
            console.log("[Entity Link] Deleted linked post", linkedPost.id, "for problem", problemId);
        }
    } catch (err) {
        console.log("[Entity Link] Cleanup for problem delete:", err.message || err);
    }
}, "problems");

// 14. Enlazado polimórfico: Sincronizar soft-delete desde posts hacia problems
onRecordAfterUpdateSuccess((e) => {
    try {
        const post = e.record;
        const original = e.record.original();

        // Si se marca el post como deleted y antes no lo estaba
        if (post.getBool("deleted") && !original.getBool("deleted")) {
            // Verificar si está vinculado a un problema
            if (post.getString("entityType") === "problems" && post.getString("entityId")) {
                const problemId = post.getString("entityId");
                try {
                    const problem = $app.findRecordById("problems", problemId);
                    if (problem && !problem.getBool("deleted")) {
                        problem.set("deleted", true);
                        $app.save(problem);
                        console.log("[Entity Link] Soft-deleted linked problem", problemId, "for post", post.id);
                    }
                } catch (err) {
                    console.log("[Entity Link] Error soft-deleting problem from post:", err.message || err);
                }
            }
        }
    } catch (err) {
        console.log("[Entity Link] Error in post update hook:", err.message || err);
    }
}, "posts");
