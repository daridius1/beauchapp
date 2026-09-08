/// <reference path="../pb_data/types.d.ts" />

// Foto de equipo: la foto grupal real del plantel, distinta del escudo (avatar/
// matchPhoto, que es un ícono/insignia). Se muestra siempre a tamaño de figurita o
// mayor (nunca a ≤60px) así que sin `thumbs` — directo desde R2, sin pasar por el
// proxy de PocketBase (PRINCIPLES.md §2).
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new Field({
        name: "teamPhoto",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    }));
    app.save(users);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("teamPhoto");
    app.save(users);
});
