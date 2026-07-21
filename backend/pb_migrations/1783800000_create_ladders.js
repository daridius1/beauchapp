/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    // 1. Colección 'ladders' (Deportes y Rankings disponibles)
    const ladders = new Collection({
        name: "ladders",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != '' && @request.auth.isSuperadmin = true",
        updateRule: "@request.auth.id != '' && @request.auth.isSuperadmin = true",
        deleteRule: "@request.auth.id != '' && @request.auth.isSuperadmin = true",
        fields: [
            {
                name: "name",
                type: "text",
                required: true
            },
            {
                name: "slug",
                type: "text",
                required: true
            },
            {
                name: "icon",
                type: "text",
                required: false
            },
            {
                name: "description",
                type: "text",
                required: false
            },
            {
                name: "max_score",
                type: "number",
                required: false
            },
            {
                name: "allowed_modes",
                type: "json",
                required: false
            },
            {
                name: "is_active",
                type: "bool",
                required: false
            }
        ]
    });
    app.save(ladders);

    // Obtener la colección guardada para acceder a su ID real
    const savedLadders = app.findCollectionByNameOrId("ladders");
    const usersColl = app.findCollectionByNameOrId("users");

    // 2. Colección 'ladder_ranks' (Rating OpenSkill por Usuario y Deporte)
    const ladderRanks = new Collection({
        name: "ladder_ranks",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && @request.auth.isSuperadmin = true",
        deleteRule: null,
        fields: [
            {
                name: "ladder",
                type: "relation",
                required: true,
                collectionId: savedLadders.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "user",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "mu",
                type: "number",
                required: false
            },
            {
                name: "sigma",
                type: "number",
                required: false
            },
            {
                name: "ordinal_rating",
                type: "number",
                required: false
            },
            {
                name: "matches_played",
                type: "number",
                required: false
            },
            {
                name: "wins",
                type: "number",
                required: false
            },
            {
                name: "losses",
                type: "number",
                required: false
            },
            {
                name: "draws",
                type: "number",
                required: false
            }
        ]
    });
    app.save(ladderRanks);

    // 3. Colección 'ladder_matches' (Historial e Arbitraje de Partidos)
    const ladderMatches = new Collection({
        name: "ladder_matches",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: null, // Los partidos nunca se eliminan
        fields: [
            {
                name: "ladder",
                type: "relation",
                required: true,
                collectionId: savedLadders.id,
                cascadeDelete: false,
                maxSelect: 1
            },
            {
                name: "arbiter",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: false,
                maxSelect: 1
            },
            {
                name: "mode",
                type: "text",
                required: true
            },
            {
                name: "team_red",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: false,
                maxSelect: 2
            },
            {
                name: "team_blue",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: false,
                maxSelect: 2
            },
            {
                name: "score_red",
                type: "number",
                required: true
            },
            {
                name: "score_blue",
                type: "number",
                required: true
            },
            {
                name: "goal_history",
                type: "json",
                required: false
            },
            {
                name: "status",
                type: "text",
                required: true
            },
            {
                name: "confirmations",
                type: "json",
                required: false
            },
            {
                name: "openskill_changes",
                type: "json",
                required: false
            }
        ]
    });
    app.save(ladderMatches);

}, (app) => {
    try {
        app.delete(app.findCollectionByNameOrId("ladder_matches"));
    } catch (e) {}
    try {
        app.delete(app.findCollectionByNameOrId("ladder_ranks"));
    } catch (e) {}
    try {
        app.delete(app.findCollectionByNameOrId("ladders"));
    } catch (e) {}
});
