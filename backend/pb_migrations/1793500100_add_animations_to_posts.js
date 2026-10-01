/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const posts = app.findCollectionByNameOrId("posts");

    // Animación manual ya optimizada en el cliente. Un máximo de 1 MiB evita que un GIF
    // tradicional grande consuma la subida del homeserver; las descargas salen desde R2.
    posts.fields.add(new Field({
        name: "animation",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 1048576,
        mimeTypes: ["image/gif", "image/webp", "video/mp4"],
    }));
    posts.fields.add(new Field({
        name: "animationName",
        type: "text",
        required: false,
        max: 180,
    }));
    posts.fields.add(new Field({
        name: "animationMime",
        type: "select",
        required: false,
        maxSelect: 1,
        values: ["image/gif", "image/webp", "video/mp4"],
    }));
    posts.fields.add(new Field({
        // Instantánea mínima de la rendition y atribución elegidas en GIPHY. Guardarla
        // evita una petición API adicional cada vez que el post aparece en el feed.
        name: "giphy",
        type: "json",
        required: false,
        maxSize: 4000,
    }));

    ["animation", "animationName", "animationMime", "giphy"].forEach((field) => {
        const clause = ` && (@request.body.${field}:isset = false || @request.body.${field} = ${field})`;
        if (posts.updateRule.indexOf(`@request.body.${field}:isset`) === -1) posts.updateRule += clause;
    });
    app.save(posts);
}, (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    ["animation", "animationName", "animationMime", "giphy"].forEach((field) => {
        posts.updateRule = posts.updateRule.replace(
            ` && (@request.body.${field}:isset = false || @request.body.${field} = ${field})`,
            ""
        );
        posts.fields.removeByName(field);
    });
    app.save(posts);
});
