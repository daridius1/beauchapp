/// <reference path="../pb_data/types.d.ts" />

// matchPhoto (el escudo de un equipo) solo tenía habilitados los thumbs "100x100" y
// "300x300", ambos recorte al centro — para un escudo que no es cuadrado (más alto que
// ancho, o al revés) eso lo recortaba antes de llegar al cliente, sin importar que el
// frontend pida resizeMode="contain" después: el recorte ya pasó en el servidor. "f" es
// el sufijo de PocketBase para "fit" (reescala sin recortar). Si el tamaño pedido no
// está en esta lista, PocketBase sirve el archivo original sin procesar — por eso hacía
// falta agregarlo acá, no alcanzaba con pedirlo distinto desde el frontend.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    const matchPhotoField = users.fields.getByName("matchPhoto");
    if (matchPhotoField) {
        matchPhotoField.thumbs = ["100x100", "100x100f", "300x300"];
    }
    app.save(users);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    const matchPhotoField = users.fields.getByName("matchPhoto");
    if (matchPhotoField) {
        matchPhotoField.thumbs = ["100x100", "300x300"];
    }
    app.save(users);
});
