/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");

    // team_players — el roster real de un equipo: nombre + foto propios, y
    // opcionalmente un vínculo a una cuenta real de Beauchapp (que debe ser
    // integrante ACTIVO de esa misma organización — validado en team_players.pb.js,
    // las reglas de acá no pueden expresar ese chequeo cruzado). Reemplaza el viejo
    // modelo donde el arbitraje sacaba nombres al vuelo de organization_members o
    // los aceptaba tipeados a mano.
    const teamPlayers = new Collection({
        name: "team_players",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.id = team",
        // El "no se puede reasignar `team` después de creado" se expresa acá, en la
        // regla misma (no en un hook) — probado a mano que combinar un hook de
        // onRecordUpdateRequest con más de una llamada a $app en el mismo handler
        // (para chequear el valor viejo de `team`) revienta con un 400 genérico en
        // esta versión de PocketBase, sin importar el orden ni si se usa
        // `e.record.original()` o un `findRecordById` aparte. La regla declarativa
        // evita el problema del todo.
        updateRule: "@request.auth.id = team && deleted = false && (@request.body.team:isset = false || @request.body.team = team)",
        deleteRule: null,
        fields: [
            {
                name: "team",
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
                max: 60
            },
            {
                name: "photo",
                type: "file",
                required: false,
                maxSelect: 1,
                maxSize: 5242880,
                mimeTypes: ["image/jpeg", "image/png", "image/webp"],
                thumbs: ["100x100", "300x300"]
            },
            {
                name: "user",
                type: "relation",
                required: false,
                collectionId: usersColl.id,
                cascadeDelete: false,
                maxSelect: 1
            },
            {
                name: "deleted",
                type: "bool",
                required: false,
                presentable: false
            },
            { id: "tpl_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "tpl_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE INDEX idx_team_players_team ON team_players (team)",
            "CREATE UNIQUE INDEX idx_team_players_team_user ON team_players (team, user) WHERE user != ''"
        ]
    });
    app.save(teamPlayers);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("team_players")); } catch (e) {}
});
