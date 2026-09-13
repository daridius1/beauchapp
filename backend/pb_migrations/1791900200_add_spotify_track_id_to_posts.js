/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const postsCollection = app.findCollectionByNameOrId("posts");
    postsCollection.fields.add(new Field({
        // El id de track de Spotify (base62, 22 caracteres), mismo dato que
        // songs.spotifyTrackId — se valida en el frontend, no acá (mismo criterio que
        // pollOptions, ver 1786420000_add_poll_options_to_posts.js).
        name: "spotifyTrackId",
        type: "text",
        required: false,
        max: 64,
    }));
    app.save(postsCollection);
}, (app) => {
    const postsCollection = app.findCollectionByNameOrId("posts");
    postsCollection.fields.removeByName("spotifyTrackId");
    app.save(postsCollection);
});
