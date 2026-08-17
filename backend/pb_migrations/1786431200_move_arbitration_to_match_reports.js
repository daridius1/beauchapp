/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("league_matches");

    // events/refereeId se mudan a match_reports (relación muchos a muchos entre
    // "arbitrar" y "partido"): un partido puede tener varios informes de árbitros
    // distintos en paralelo, así que ya no tiene sentido guardar UN evento log ni UN
    // árbitro sueltos en el propio partido. scoreA/scoreB se mantienen — siguen siendo
    // el resultado oficial, recién se completan cuando se aprueba un informe.
    collection.fields.removeByName("events");
    collection.fields.removeByName("refereeId");

    // Ya no existe "pending_review" a nivel de partido — ese estado ahora vive en
    // match_reports.status (in_progress/submitted/approved/rejected) por informe. El
    // partido solo pasa de "confirmed" a "played" cuando el admin aprueba UN informe.
    const statusField = collection.fields.getByName("status");
    statusField.values = ["confirmed", "played", "cancelled"];

    app.save(collection);
}, (app) => {
    const usersColl = app.findCollectionByNameOrId("users");
    const collection = app.findCollectionByNameOrId("league_matches");

    collection.fields.add(new Field({
        name: "events",
        type: "json",
        required: false,
        maxSize: 500000
    }));
    collection.fields.add(new Field({
        name: "refereeId",
        type: "relation",
        required: false,
        collectionId: usersColl.id,
        cascadeDelete: false,
        maxSelect: 1
    }));

    const statusField = collection.fields.getByName("status");
    statusField.values = ["confirmed", "pending_review", "played", "cancelled"];

    app.save(collection);
});
