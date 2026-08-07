/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");

    // 1. Colección 'reports' (reportes de contenido y sugerencias/bugs generales)
    const reports = new Collection({
        name: "reports",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "reporter",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: false,
                maxSelect: 1
            },
            {
                name: "targetType",
                type: "text",
                required: false
            },
            {
                name: "targetId",
                type: "text",
                required: false
            },
            {
                name: "message",
                type: "text",
                required: true
            },
            {
                id: "rpt_crea_01",
                name: "created",
                type: "autodate",
                onCreate: true,
                onUpdate: false
            },
            {
                id: "rpt_upd_01",
                name: "updated",
                type: "autodate",
                onCreate: true,
                onUpdate: true
            }
        ]
    });
    app.save(reports);

    // 2. Colección 'announcements' (anuncios del equipo, creados desde el dashboard de PocketBase)
    const announcements = new Collection({
        name: "announcements",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "title",
                type: "text",
                required: true
            },
            {
                name: "body",
                type: "text",
                required: true
            },
            {
                id: "anc_crea_01",
                name: "created",
                type: "autodate",
                onCreate: true,
                onUpdate: false
            },
            {
                id: "anc_upd_01",
                name: "updated",
                type: "autodate",
                onCreate: true,
                onUpdate: true
            }
        ]
    });
    app.save(announcements);

    // 3. Campo 'last_seen_announcement' en 'users' (id del último anuncio ya confirmado)
    const usersCollForEdit = app.findCollectionByNameOrId("users");
    if (!usersCollForEdit.fields.find((f) => f.name === "last_seen_announcement")) {
        usersCollForEdit.fields.add(new Field({
            name: "last_seen_announcement",
            type: "text",
            required: false,
        }));
        app.save(usersCollForEdit);
    }
}, (app) => {
    try {
        const usersColl = app.findCollectionByNameOrId("users");
        usersColl.fields.removeByName("last_seen_announcement");
        app.save(usersColl);
    } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("announcements")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("reports")); } catch (e) {}
});
