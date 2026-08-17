/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");
    const stagesColl = app.findCollectionByNameOrId("league_stages");

    // league_matches — partidos aceptados uno por uno desde /admin/liga (a diferencia
    // de horario_matches, que confirma todo un lote de una vez). blockCode es un
    // bloque de fecha-hora real ("YYYY-MM-DD-HH"); una vez creado un partido acá (o en
    // horario_matches), ese bloque queda "ocupado" para cualquier otro emparejamiento
    // futuro, de liga o de horarios.
    const leagueMatches = new Collection({
        name: "league_matches",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "league",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "stage",
                type: "relation",
                required: true,
                collectionId: stagesColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "teamA",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "teamB",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "blockCode",
                type: "text",
                required: true,
                max: 20
            },
            {
                name: "happinessA",
                type: "number",
                required: false,
                min: 1,
                max: 4,
                noDecimal: true
            },
            {
                name: "happinessB",
                type: "number",
                required: false,
                min: 1,
                max: 4,
                noDecimal: true
            },
            {
                name: "gap",
                type: "number",
                required: false,
                min: 0
            },
            {
                name: "status",
                type: "select",
                required: true,
                maxSelect: 1,
                values: ["confirmed", "played", "cancelled"]
            },
            { id: "lma_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "lma_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE INDEX idx_league_matches_league ON league_matches (league)",
            "CREATE INDEX idx_league_matches_stage ON league_matches (stage)",
            "CREATE INDEX idx_league_matches_teamA ON league_matches (teamA)",
            "CREATE INDEX idx_league_matches_teamB ON league_matches (teamB)"
        ]
    });
    app.save(leagueMatches);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("league_matches")); } catch (e) {}
});
