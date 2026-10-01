/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const posts = app.findCollectionByNameOrId("posts");

    // Un único PDF breve por publicación o respuesta. El archivo sale desde R2/CDN y
    // no tiene thumbnails: en el feed solo se muestra una tarjeta de metadatos.
    posts.fields.add(new Field({
        name: "document",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 2097152,
        mimeTypes: ["application/pdf"],
    }));
    posts.fields.add(new Field({
        name: "documentName",
        type: "text",
        required: false,
        max: 180,
    }));
    // Otros usuarios pueden actualizar likes, pero nunca reemplazar adjuntos. Se incluye
    // también Spotify porque el campo ya existía y debe quedar congelado por la misma razón.
    const freezes = [
        "document",
        "documentName",
        "spotifyTrackId",
    ];
    freezes.forEach((field) => {
        const clause = ` && (@request.body.${field}:isset = false || @request.body.${field} = ${field})`;
        if (posts.updateRule.indexOf(`@request.body.${field}:isset`) === -1) {
            posts.updateRule += clause;
        }
    });

    app.save(posts);
}, (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    ["document", "documentName", "spotifyTrackId"].forEach((field) => {
        posts.updateRule = posts.updateRule.replace(
            ` && (@request.body.${field}:isset = false || @request.body.${field} = ${field})`,
            ""
        );
    });
    posts.fields.removeByName("document");
    posts.fields.removeByName("documentName");
    app.save(posts);
});
