/// <reference path="../pb_data/types.d.ts" />

// Trazabilidad de las correcciones a un informe arbitral ya oficial.
//
// `referee` guarda a quien ABRIÓ la sesión de arbitraje (el primer push), y no cambia
// nunca. Hasta ahora era el único rastro de autoría, así que toda corrección posterior
// a un partido cerrado quedaba anónima. Estos dos campos registran la última enmienda.
// Ver auditoria-2026-08-19.md §4.4.
migrate((app) => {
    const collection = app.findCollectionByNameOrId("match_reports");

    collection.fields.add(new Field({
        name: "amendedBy",
        type: "relation",
        required: false,
        presentable: false,
        collectionId: app.findCollectionByNameOrId("users").id,
        cascadeDelete: false,
        maxSelect: 1,
    }));

    collection.fields.add(new Field({
        name: "amendedAt",
        type: "text",
        required: false,
        presentable: false,
    }));

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("match_reports");
    collection.fields.removeByName("amendedBy");
    collection.fields.removeByName("amendedAt");
    app.save(collection);
});
