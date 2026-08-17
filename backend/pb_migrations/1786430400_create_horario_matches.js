/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");

    // horario_matches — partidos confirmados desde /admin/horarios. Sin relación a
    // "ronda" (ya no existe el concepto): blockCode es un bloque de fecha-hora real
    // ("YYYY-MM-DD-HH") tomado directamente de la ventana marcable vigente al confirmar.
    const horarioMatches = new Collection({
        name: "horario_matches",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
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
            { id: "hma_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "hma_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE INDEX idx_horario_matches_teamA ON horario_matches (teamA)",
            "CREATE INDEX idx_horario_matches_teamB ON horario_matches (teamB)"
        ]
    });
    app.save(horarioMatches);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("horario_matches")); } catch (e) {}
});
