/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");

    // league_stages — "etapas" dentro de una liga (ej. "Fase de grupos", "Playoffs").
    // `league` es directamente la cuenta de organización de tipo liga (no existe una
    // colección "leagues" separada: la cuenta de usuario ES la liga). Se administra
    // solo desde /admin/liga, autenticado con las credenciales de esa misma cuenta.
    const leagueStages = new Collection({
        name: "league_stages",
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
                name: "name",
                type: "text",
                required: true,
                max: 100
            },
            { id: "lst_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "lst_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE INDEX idx_league_stages_league ON league_stages (league)"
        ]
    });
    app.save(leagueStages);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("league_stages")); } catch (e) {}
});
