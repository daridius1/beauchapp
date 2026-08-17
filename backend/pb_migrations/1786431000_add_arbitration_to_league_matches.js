/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");
    const collection = app.findCollectionByNameOrId("league_matches");

    // events — bitácora completa y ordenada de todo lo que pasó en el partido (goles,
    // autogoles, tarjetas, penales, inicio/fin de cada tiempo, convocatoria). El marcador
    // y las tarjetas NUNCA se guardan sueltos mientras se arbitra — se recalculan siempre
    // a partir de este arreglo (ver lib/matchEvents.js), así "deshacer" es solo sacar el
    // último elemento y todo lo demás se re-deriva solo. También es lo que hace el
    // arbitraje resiliente: cada acción reescribe este campo completo en el servidor.
    collection.fields.add(new Field({
        name: "events",
        type: "json",
        required: false,
        maxSize: 500000
    }));

    // refereeId — quién está (o quedó) arbitrando. Cualquier cuenta autenticada puede
    // tomar un partido pendiente; una vez tomado, solo esa cuenta puede seguir agregando
    // eventos (evita que dos personas arbitren el mismo partido a la vez y se pisen).
    collection.fields.add(new Field({
        name: "refereeId",
        type: "relation",
        required: false,
        collectionId: usersColl.id,
        cascadeDelete: false,
        maxSelect: 1
    }));

    // scoreA/scoreB — el marcador final, recién se completan cuando el admin de la liga
    // aprueba el arbitraje (antes de eso el resultado no es público, se deriva en vivo
    // desde `events` solo para quien está arbitrando).
    collection.fields.add(new Field({
        name: "scoreA",
        type: "number",
        required: false,
        min: 0,
        noDecimal: true
    }));
    collection.fields.add(new Field({
        name: "scoreB",
        type: "number",
        required: false,
        min: 0,
        noDecimal: true
    }));

    const statusField = collection.fields.getByName("status");
    statusField.values = ["confirmed", "pending_review", "played", "cancelled"];

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("league_matches");
    collection.fields.removeByName("events");
    collection.fields.removeByName("refereeId");
    collection.fields.removeByName("scoreA");
    collection.fields.removeByName("scoreB");
    const statusField = collection.fields.getByName("status");
    statusField.values = ["confirmed", "played", "cancelled"];
    app.save(collection);
});
