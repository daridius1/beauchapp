/// <reference path="../pb_data/types.d.ts" />

// "suspended" — la liga puede suspender un partido agendado (ej. cancha no disponible,
// clima) sin cancelarlo del todo: se saca de "por jugar" pero se puede reactivar más
// tarde a "confirmed" para reagendarlo. Distinto de "cancelled", que es terminal.
migrate((app) => {
    const collection = app.findCollectionByNameOrId("league_matches");
    const statusField = collection.fields.getByName("status");
    statusField.values = ["confirmed", "played", "cancelled", "suspended"];
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("league_matches");
    const statusField = collection.fields.getByName("status");
    statusField.values = ["confirmed", "played", "cancelled"];
    app.save(collection);
});
