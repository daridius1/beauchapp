/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("news");
    collection.fields.add(new Field({
        // Cancha donde se jugó — el arbitraje/liga no registra esto hoy, así que se
        // elige a mano en /admin/noticias al generar. Lista cerrada a propósito (ver
        // VENUE_LABELS en lib/newsGen.js): son las dos únicas canchas del campus.
        name: "venue",
        type: "select",
        required: false,
        maxSelect: 1,
        values: ["multicancha_850", "futsal_menos3"],
    }));
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("news");
    collection.fields.removeByName("venue");
    app.save(collection);
});
