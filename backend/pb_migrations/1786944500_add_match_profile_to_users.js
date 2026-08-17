/// <reference path="../pb_data/types.d.ts" />

// Perfil de jugador (usuarios normales) / perfil de equipo (organizaciones subtype=team):
// por ahora solo alias + foto, usados en vistas de partidos y tablas como el "escudo"
// del equipo o el apodo del jugador — separado del avatar/nombre social genérico
// porque no siempre es la misma imagen (ej. un escudo con fondo transparente).
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");

    users.fields.add(new Field({
        name: "matchAlias",
        type: "text",
        required: false,
        max: 40,
    }));

    users.fields.add(new Field({
        name: "matchPhoto",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
        thumbs: ["100x100", "300x300"],
    }));

    app.save(users);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("matchAlias");
    users.fields.removeByName("matchPhoto");
    app.save(users);
});
