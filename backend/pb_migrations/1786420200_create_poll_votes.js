/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const postsColl = app.findCollectionByNameOrId("posts");
    const usersColl = app.findCollectionByNameOrId("users");

    // poll_votes — un voto por usuario por post con encuesta (posts.pollOptions). El
    // índice único (post, user) fuerza "un voto por usuario" a nivel de base de datos;
    // updateRule permite cambiar el voto sin crear una fila nueva.
    const pollVotes = new Collection({
        name: "poll_votes",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.id = user",
        updateRule: "@request.auth.id = user",
        deleteRule: "@request.auth.id = user",
        fields: [
            {
                name: "post",
                type: "relation",
                required: true,
                collectionId: postsColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "user",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                // required:false — la primera opción tiene índice 0 (un number required
                // en 0 falla "cannot be blank", mismo motivo que outcomeIndex en beaumarket).
                name: "optionIndex",
                type: "number",
                required: false,
                min: 0,
                noDecimal: true
            },
            { id: "pvt_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "pvt_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_poll_votes_unique ON poll_votes (post, user)"
        ]
    });
    app.save(pollVotes);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("poll_votes")); } catch (e) {}
});
