/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const postsCollection = app.findCollectionByNameOrId("posts");
    postsCollection.fields.add(new Field({
        // ["Opción A", "Opción B", ...] — 2 a 6 opciones, validado en el frontend, no en
        // el esquema (mismo patrón que beaumarkets.outcomes).
        name: "pollOptions",
        type: "json",
        required: false,
        maxSize: 4000,
    }));
    app.save(postsCollection);
}, (app) => {
    const postsCollection = app.findCollectionByNameOrId("posts");
    postsCollection.fields.removeByName("pollOptions");
    app.save(postsCollection);
});
