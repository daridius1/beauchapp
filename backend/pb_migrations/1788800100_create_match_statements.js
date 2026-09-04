/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");
    const matchesColl = app.findCollectionByNameOrId("league_matches");

    // match_statements — la "declaración" que cualquier autenticado (jugador o
    // espectador) puede dejar sobre un partido de liga. Nunca es pública: solo la ve
    // el propio autor y las cuentas de organización subtype=media, que la usan como
    // materia prima para escribir noticias (ver news.pb.js). Una por partido y por
    // persona (índice único), editable en el lugar — mismo criterio de upsert que
    // match_reports (match, referee).
    const matchStatements = new Collection({
        name: "match_statements",
        type: "base",
        listRule: "@request.auth.id = author || (@request.auth.type = 'organization' && @request.auth.subtype = 'media')",
        viewRule: "@request.auth.id = author || (@request.auth.type = 'organization' && @request.auth.subtype = 'media')",
        createRule: "@request.auth.id != '' && @request.auth.id = author",
        updateRule: "@request.auth.id = author",
        deleteRule: null,
        fields: [
            {
                name: "match",
                type: "relation",
                required: true,
                collectionId: matchesColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "author",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "content",
                type: "text",
                required: true,
                max: 2000
            },
            {
                name: "deleted",
                type: "bool",
                required: false,
                presentable: false
            },
            { id: "mst_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "mst_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_match_statements_unique ON match_statements (match, author)",
            "CREATE INDEX idx_match_statements_match ON match_statements (match)"
        ]
    });
    app.save(matchStatements);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("match_statements")); } catch (e) {}
});
