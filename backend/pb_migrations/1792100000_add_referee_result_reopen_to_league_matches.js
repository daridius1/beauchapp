/// <reference path="../pb_data/types.d.ts" />

// Un resultado enviado por un equipo árbitro queda cerrado para AMBOS árbitros. La
// liga puede abrir una corrección puntual cuando corresponda; el siguiente envío vuelve
// este campo a false dentro de la misma transacción, así que no se acumulan permisos.
// Los partidos 'confirmed' no necesitan marcarlo: su primera carga siempre está abierta.
migrate((app) => {
    const collection = app.findCollectionByNameOrId("league_matches");

    collection.fields.add(new Field({
        name: "refereeResultReopen",
        type: "bool",
        required: false,
        presentable: false,
    }));

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("league_matches");
    collection.fields.removeByName("refereeResultReopen");
    app.save(collection);
});
