/// <reference path="../pb_data/types.d.ts" />

// Toda etapa es o "groups" (fase de grupos: se juega todos contra todos dentro de la
// etapa y la vista de Posiciones muestra una tabla con puntos) o "knockout"
// (enfrentamiento directo: eliminatoria, no tiene sentido una tabla de puntos — la
// vista de Posiciones para esa etapa muestra simplemente sus partidos).
migrate((app) => {
    const collection = app.findCollectionByNameOrId("league_stages");
    collection.fields.add(new Field({
        name: "type",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["groups", "knockout"],
    }));
    app.save(collection);

    // Las etapas ya existentes se crearon todas bajo el modelo de tabla de puntos —
    // "groups" es el equivalente exacto de su comportamiento actual.
    const existing = app.findRecordsByFilter("league_stages", "", "", 0, 0);
    existing.forEach((r) => {
        r.set("type", "groups");
        app.save(r);
    });
}, (app) => {
    const collection = app.findCollectionByNameOrId("league_stages");
    collection.fields.removeByName("type");
    app.save(collection);
});
