/// <reference path="../pb_data/types.d.ts" />

// Posición del jugador en la cancha (DEL/MED/DEF/POR) — solo tiene sentido para
// role='player', pero no vale la pena bloquear que un 'coach' la tenga seteada: la UI
// de EditTeamScreen.tsx simplemente no se la ofrece. Se usa únicamente para agrupar y
// pintar las láminas del álbum de figuritas (LeagueAlbumScreen.tsx) — no participa de
// slotNumber, numeración de figurita ni de ninguna otra lógica ya existente. Sin
// default: los jugadores que ya existían quedan sin posición hasta que alguien la
// asigne editando; el álbum los agrupa aparte mientras tanto.
migrate((app) => {
    const collection = app.findCollectionByNameOrId("team_players");
    collection.fields.add(new Field({
        name: "position",
        type: "select",
        values: ["POR", "DEF", "MED", "DEL"],
        maxSelect: 1,
        required: false,
    }));
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("team_players");
    collection.fields.removeByName("position");
    app.save(collection);
});
