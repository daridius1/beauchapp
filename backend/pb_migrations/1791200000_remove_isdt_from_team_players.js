/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // isDT quedó redundante con role='coach': el equipo admite un solo DT (hace
    // cumplir team_players.pb.js) y desde que existe `role` nunca hubo forma de tener
    // un role='coach' sin isDT=true ni viceversa — dos campos cargando el mismo bit.
    const collection = app.findCollectionByNameOrId("team_players");
    collection.fields.removeByName("isDT");
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("team_players");
    collection.fields.add(new Field({
        name: "isDT",
        type: "bool",
        required: false,
        presentable: false,
    }));
    app.save(collection);
});
