/// <reference path="../pb_data/types.d.ts" />

// Hook onRecordEnrich para la colección "posts"
// Enriquece dinámicamente los posts que tienen targetType + targetId con los datos
// actualizados del recurso citado, eliminando la necesidad de requests adicionales
// del frontend.

console.log("[LOAD] enrich_targets.pb.js hook loaded!");

onRecordEnrich((e) => {
    try {
        let targetType = e.record.getString("targetType");
        let targetId = e.record.getString("targetId");
        const replyTo = e.record.getString("replyTo");

        // Si el post es una respuesta pero no tiene targetType/targetId seteado
        if (!targetType && replyTo) {
            targetType = "post";
            targetId = replyTo;
        } else if (!targetId && replyTo) {
            targetId = replyTo;
        }

        // Solo enriquecer posts que tienen una cita, comentario o respuesta
        if (!targetType || !targetId) {
            return e.next();
        }

        e.record.withCustomData(true);

        let collectionName = "";
        if (targetType === "post") {
            collectionName = "posts";
        } else if (targetType === "problem") {
            collectionName = "problems";
        } else if (targetType === "match") {
            collectionName = "ladder_matches";
        } else if (targetType === "marketplace_item" || targetType === "product") {
            collectionName = "marketplace_items";
        } else if (targetType === "seller_profile" || targetType === "seller") {
            collectionName = "seller_profiles";
        }

        if (!collectionName) {
            return e.next();
        }

        try {
            const targetRecord = $app.findRecordById(collectionName, targetId);
            let enriched = {};

            if (targetType === "post") {
                const isDeleted = targetRecord.getBool("deleted");
                if (isDeleted) {
                    enriched = {
                        id: targetRecord.id,
                        collectionId: targetRecord.collection().id,
                        deleted: true,
                    };
                } else {
                    let authorData = null;
                    const authorId = targetRecord.getString("author");
                    if (authorId) {
                        try {
                            const authorRecord = $app.findRecordById("users", authorId);
                            authorData = {
                                id: authorRecord.id,
                                name: authorRecord.getString("name"),
                                username: authorRecord.getString("username"),
                                avatar: authorRecord.getString("avatar"),
                                collectionId: authorRecord.collection().id,
                            };
                        } catch (err) {}
                    }

                    enriched = {
                        id: targetRecord.id,
                        collectionId: targetRecord.collection().id,
                        content: targetRecord.getString("content"),
                        photo: targetRecord.getString("photo"),
                        deleted: false,
                        created: targetRecord.getString("created"),
                        expand: authorData ? { author: authorData } : {},
                    };
                }
            } else if (targetType === "problem") {
                enriched = {
                    id: targetRecord.id,
                    collectionId: targetRecord.collection().id,
                    title: targetRecord.getString("title"),
                    parent: targetRecord.getString("parent"),
                    ramo: targetRecord.getString("ramo"),
                    instancia: targetRecord.getString("instancia"),
                    deleted: targetRecord.getBool("deleted"),
                };
            } else if (targetType === "match") {
                // Expandir datos del ladder y jugadores
                let ladderData = null;
                let teamRedData = [];
                let teamBlueData = [];

                const ladderId = targetRecord.getString("ladder");
                if (ladderId) {
                    try {
                        const ladderRecord = $app.findRecordById("ladders", ladderId);
                        ladderData = {
                            id: ladderRecord.id,
                            name: ladderRecord.getString("name"),
                            slug: ladderRecord.getString("slug"),
                        };
                    } catch (err) {}
                }

                const redIds = targetRecord.getStringSlice("team_red");
                for (let i = 0; i < redIds.length; i++) {
                    try {
                        const u = $app.findRecordById("users", redIds[i]);
                        teamRedData.push({ id: u.id, name: u.getString("name") });
                    } catch (err) {}
                }

                const blueIds = targetRecord.getStringSlice("team_blue");
                for (let i = 0; i < blueIds.length; i++) {
                    try {
                        const u = $app.findRecordById("users", blueIds[i]);
                        teamBlueData.push({ id: u.id, name: u.getString("name") });
                    } catch (err) {}
                }

                enriched = {
                    id: targetRecord.id,
                    collectionId: targetRecord.collection().id,
                    mode: targetRecord.getString("mode"),
                    score_red: targetRecord.getInt("score_red"),
                    score_blue: targetRecord.getInt("score_blue"),
                    status: targetRecord.getString("status"),
                    deleted: targetRecord.getBool("deleted"),
                    expand: {
                        ladder: ladderData,
                        team_red: teamRedData,
                        team_blue: teamBlueData,
                    },
                };
            } else if (targetType === "marketplace_item" || targetType === "product") {
                // Expandir seller -> user
                let sellerData = null;
                const sellerId = targetRecord.getString("seller");
                if (sellerId) {
                    try {
                        const sellerRecord = $app.findRecordById("seller_profiles", sellerId);
                        let sellerUserData = null;
                        const sellerUserId = sellerRecord.getString("user");
                        if (sellerUserId) {
                            try {
                                const sellerUser = $app.findRecordById("users", sellerUserId);
                                sellerUserData = {
                                    id: sellerUser.id,
                                    name: sellerUser.getString("name"),
                                    username: sellerUser.getString("username"),
                                };
                            } catch (err) {}
                        }
                        sellerData = {
                            id: sellerRecord.id,
                            expand: sellerUserData ? { user: sellerUserData } : {},
                        };
                    } catch (err) {}
                }

                enriched = {
                    id: targetRecord.id,
                    collectionId: targetRecord.collection().id,
                    title: targetRecord.getString("title"),
                    price: targetRecord.getInt("price"),
                    category: targetRecord.getString("category"),
                    deleted: targetRecord.getBool("deleted"),
                    expand: sellerData ? { seller: sellerData } : {},
                };
            } else if (targetType === "seller_profile" || targetType === "seller") {
                let userData = null;
                const userId = targetRecord.getString("user");
                if (userId) {
                    try {
                        const userRecord = $app.findRecordById("users", userId);
                        userData = {
                            id: userRecord.id,
                            name: userRecord.getString("name"),
                            username: userRecord.getString("username"),
                        };
                    } catch (err) {}
                }

                enriched = {
                    id: targetRecord.id,
                    collectionId: targetRecord.collection().id,
                    bio: targetRecord.getString("bio"),
                    deleted: targetRecord.getBool("deleted"),
                    expand: userData ? { user: userData } : {},
                };
            }

            e.record.set("expandedTarget", enriched);
        } catch (err) {
            // El target fue hard-deleted o no existe: marcar como no encontrado
            e.record.set("expandedTarget", { _notFound: true });
        }
    } catch (outerErr) {
        console.log("[enrich_targets.pb.js] Error:", outerErr);
    }

    return e.next();
}, "posts");
