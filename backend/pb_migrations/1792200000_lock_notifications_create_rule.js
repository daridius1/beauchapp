/// <reference path="../pb_data/types.d.ts" />

// Las notificaciones son mensajes de confianza: permitir crearlas por la API dejaba
// que cualquier cuenta autenticada suplantara a otra y le escribiera a un tercero.
// Todos los productores legítimos viven en hooks o rutas del servidor, que no pasan
// por las API rules de clientes.
migrate((app) => {
    const collection = app.findCollectionByNameOrId("notifications");
    collection.createRule = null;
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("notifications");
    // La reversión conserva la regla previa para que una reversión puntual no cambie
    // silenciosamente el comportamiento histórico de la colección.
    collection.createRule = "@request.auth.id != ''";
    app.save(collection);
});
