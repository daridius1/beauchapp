/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("team_players");
    collection.fields.add(new Field({
        // Cuántas personas puede tener el cuerpo técnico (role='coach') es libre — esto
        // marca cuál de ellas es EL director técnico. "Un solo DT" se hace cumplir en
        // team_players.pb.js (desmarca a cualquier otra al guardar), no acá: un campo
        // bool no puede expresar "único por equipo" por sí solo.
        name: "isDT",
        type: "bool",
        required: false,
        presentable: false,
    }));
    collection.fields.add(new Field({
        // Ídem para "un solo capitán", pero sobre jugadores (role='player').
        name: "isCaptain",
        type: "bool",
        required: false,
        presentable: false,
    }));
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("team_players");
    collection.fields.removeByName("isDT");
    collection.fields.removeByName("isCaptain");
    app.save(collection);
});
