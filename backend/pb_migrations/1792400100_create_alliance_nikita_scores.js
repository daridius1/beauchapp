/// <reference path="../pb_data/types.d.ts" />

// La alianza competitiva de Nikita Jump vive aparte del marco cosmético del perfil.
// Una fila por persona fija a qué alianza aporta y conserva solo su mejor puntaje.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    const scores = new Collection({
        name: "alliance_nikita_scores",
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
            {
                name: "alliance",
                type: "select",
                values: ["urbana", "pop", "gotico", "hiphop", "punk", "rock"],
                maxSelect: 1,
                required: true,
            },
            {
                name: "high_score",
                type: "number",
                min: 0,
                max: 10000000,
                noDecimal: true,
                required: false,
            },
            { name: "created", type: "autodate", onCreate: true },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_alliance_nikita_user ON alliance_nikita_scores (user)",
            "CREATE INDEX idx_alliance_nikita_alliance ON alliance_nikita_scores (alliance)",
        ],
    });
    app.save(scores);
}, (app) => {
    const scores = app.findCollectionByNameOrId("alliance_nikita_scores");
    if (scores) app.delete(scores);
});
