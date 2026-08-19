/// <reference path="../pb_data/types.d.ts" />

// "pending" — sumarse a una organización deja de ser instantáneo: agregar a alguien
// ahora crea una invitación pendiente (ver auth.pb.js, que fuerza status='pending' en
// cualquier creación sin importar lo que mande el cliente) que el estudiante invitado
// tiene que aceptar desde el perfil de la organización antes de quedar "active".
migrate((app) => {
    const collection = app.findCollectionByNameOrId("organization_members");
    const statusField = collection.fields.getByName("status");
    statusField.values = ["active", "inactive", "pending"];
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("organization_members");
    const statusField = collection.fields.getByName("status");
    statusField.values = ["active", "inactive"];
    app.save(collection);
});
