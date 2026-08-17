/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");

    // league_teams — qué equipos participan en una liga (roster). Un row por
    // (league, team); se administra solo desde /admin/liga (toggle), autenticado con
    // las credenciales de la cuenta de la propia liga.
    const leagueTeams = new Collection({
        name: "league_teams",
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
                name: "team",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            { id: "ltm_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "ltm_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_league_teams_unique ON league_teams (league, team)"
        ]
    });
    app.save(leagueTeams);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("league_teams")); } catch (e) {}
});
