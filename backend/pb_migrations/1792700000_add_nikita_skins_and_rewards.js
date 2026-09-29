/// <reference path="../pb_data/types.d.ts" />

// Las compras y las partidas cobradas quedan en colecciones cerradas. Así el cliente
// nunca puede sumar Beautokens, inventar una compra ni volver a cobrar el mismo runId.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    const scores = app.findCollectionByNameOrId("alliance_nikita_scores");
    scores.fields.add(new Field({ name: "selected_skin", type: "text", required: false, max: 64 }));
    app.save(scores);

    const skins = new Collection({
        name: "alliance_nikita_skins",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "user",
                type: "relation",
                collectionId: users.id,
                cascadeDelete: true,
                maxSelect: 1,
                required: true,
            },
            { name: "skin", type: "text", required: true, max: 64 },
            { name: "created", type: "autodate", onCreate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_alliance_nikita_skin_user ON alliance_nikita_skins (user, skin)"],
    });
    app.save(skins);

    const runs = new Collection({
        name: "alliance_nikita_runs",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            { name: "run_id", type: "text", required: true, min: 24, max: 24 },
            {
                name: "user",
                type: "relation",
                collectionId: users.id,
                cascadeDelete: true,
                maxSelect: 1,
                required: true,
            },
            { name: "score", type: "number", min: 0, max: 10000000, noDecimal: true },
            { name: "reward", type: "number", min: 0, max: 8, noDecimal: true },
            { name: "created", type: "autodate", onCreate: true },
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_alliance_nikita_run_id ON alliance_nikita_runs (run_id)",
            "CREATE INDEX idx_alliance_nikita_runs_user ON alliance_nikita_runs (user, created)",
        ],
    });
    app.save(runs);
}, (app) => {
    const runs = app.findCollectionByNameOrId("alliance_nikita_runs");
    if (runs) app.delete(runs);
    const skins = app.findCollectionByNameOrId("alliance_nikita_skins");
    if (skins) app.delete(skins);
    const scores = app.findCollectionByNameOrId("alliance_nikita_scores");
    scores.fields.removeByName("selected_skin");
    app.save(scores);
});
