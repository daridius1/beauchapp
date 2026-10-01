/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const posts = app.findCollectionByNameOrId("posts");
    posts.fields.add(new Field({
        // Solo se guarda el enlace validado. El reproductor y el audio salen directo
        // desde el widget oficial de SoundCloud, sin pasar por el homeserver.
        name: "soundcloudUrl",
        type: "url",
        required: false,
        onlyDomains: ["soundcloud.com", "www.soundcloud.com", "m.soundcloud.com", "on.soundcloud.com"],
    }));
    const clause = " && (@request.body.soundcloudUrl:isset = false || @request.body.soundcloudUrl = soundcloudUrl)";
    if (posts.updateRule.indexOf("@request.body.soundcloudUrl:isset") === -1) posts.updateRule += clause;
    app.save(posts);
}, (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    posts.updateRule = posts.updateRule.replace(
        " && (@request.body.soundcloudUrl:isset = false || @request.body.soundcloudUrl = soundcloudUrl)",
        ""
    );
    posts.fields.removeByName("soundcloudUrl");
    app.save(posts);
});
