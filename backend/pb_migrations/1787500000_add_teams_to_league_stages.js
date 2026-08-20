/// <reference path="../pb_data/types.d.ts" />

// Participantes explícitos de una etapa.
//
// Hasta ahora quiénes participaban de una etapa se DEDUCÍA de sus partidos: la tabla de
// posiciones de una fase de grupos listaba solo a los equipos que ya habían jugado. Un
// grupo recién armado, entonces, se veía vacío hasta que se disputara el primer partido,
// que es justo cuando más se quiere mirar la tabla.
//
// Es una relación múltiple y no una colección aparte porque la lista es corta (los
// equipos de un grupo) y no lleva datos propios: no hay nada que guardar sobre el par
// (etapa, equipo) más que su existencia.
migrate((app) => {
    const collection = app.findCollectionByNameOrId("league_stages");
    const users = app.findCollectionByNameOrId("users");

    collection.fields.add(new Field({
        name: "teams",
        type: "relation",
        required: false,
        presentable: false,
        collectionId: users.id,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 64,
    }));

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("league_stages");
    collection.fields.removeByName("teams");
    app.save(collection);
});
