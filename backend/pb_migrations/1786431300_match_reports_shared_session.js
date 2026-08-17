/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("match_reports");

    // Ya no es "un informe por partido+árbitro" — ahora es una sesión de arbitraje
    // COMPARTIDA por partido: cualquier cantidad de personas que tengan el código
    // pueden agregar eventos a la misma. `referee` pasa a significar "quién la inició"
    // (crédito informativo, ya no exclusividad); `code` es lo que da acceso a escribir.
    // hidden:true — nunca viaja en las respuestas normales de la API de colecciones
    // (list/view), solo lo devuelven las rutas de match_arbitration.pb.js cuando
    // corresponde (al crear la sesión, nunca al simplemente leerla).
    collection.fields.add(new Field({
        name: "code",
        type: "text",
        required: true,
        max: 6,
        min: 6,
        hidden: true
    }));

    // notes — el "informe arbitral": una caja de texto libre, compartida, sin
    // estructura (a diferencia de `events`, que sí se valida y deriva).
    collection.fields.add(new Field({
        name: "notes",
        type: "text",
        required: false,
        max: 5000
    }));

    collection.indexes = ["CREATE UNIQUE INDEX idx_match_reports_unique ON match_reports (match)"];

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("match_reports");
    collection.fields.removeByName("code");
    collection.fields.removeByName("notes");
    collection.indexes = ["CREATE UNIQUE INDEX idx_match_reports_unique ON match_reports (match, referee)"];
    app.save(collection);
});
