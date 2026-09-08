/// <reference path="../pb_data/types.d.ts" />

// slotNumber — la posición PERMANENTE de un jugador en el plantel de su equipo, para
// el número de figurita del álbum (ver lib/album.js): equipo 01 + slot 19 = "0119". Se
// asigna una sola vez, al crear el jugador (team_players.pb.js), como
// MAX(slotNumber) + 1 de ese equipo — nunca se recalcula ni se reutiliza, así que
// borrar o agregar jugadores después no corre la numeración de nadie más. Los slots
// 00-03 de cada equipo son las cartas especiales de hoy (escudo, foto de equipo, DT,
// capitán) y 04-09 quedan reservados para las que vengan después, así que los
// jugadores arrancan recién en el 10 (FIRST_PLAYER_SLOT en lib/album.js — no se puede
// require() esa constante desde una migración, CLAUDE.md §2.7, por eso el número va
// escrito a mano acá).
//
// La updateRule ya bloqueaba reasignar `team` de la misma forma declarativa (ver
// 1787117500_create_team_players.js) — se anexa la misma protección para slotNumber,
// nunca sobreescribiendo la regla existente de un tirón (PRINCIPLES.md §4).
migrate((app) => {
    const collection = app.findCollectionByNameOrId("team_players");
    collection.fields.add(new Field({
        name: "slotNumber",
        type: "number",
        required: false,
        min: 0,
        noDecimal: true,
    }));
    collection.updateRule =
        "@request.auth.id = team && deleted = false && " +
        "(@request.body.team:isset = false || @request.body.team = team) && " +
        "(@request.body.slotNumber:isset = false || @request.body.slotNumber = slotNumber)";
    app.save(collection);

    // Backfill: a los jugadores (role='player') que ya existían nunca se les asignó
    // slot — se numeran acá por antigüedad (orden de creación), empezando en el 10.
    const teamIds = arrayOf(new DynamicModel({ team: "" }));
    app.db().newQuery("SELECT DISTINCT team FROM team_players WHERE role = 'player'").all(teamIds);
    teamIds.forEach((row) => {
        const rows = app.findRecordsByFilter(
            "team_players", "team = {:team} && role = 'player'", "created", 500, 0, { team: row.team }
        );
        rows.forEach((r, idx) => {
            r.set("slotNumber", 10 + idx);
            app.save(r);
        });
    });
}, (app) => {
    const collection = app.findCollectionByNameOrId("team_players");
    collection.fields.removeByName("slotNumber");
    collection.updateRule =
        "@request.auth.id = team && deleted = false && " +
        "(@request.body.team:isset = false || @request.body.team = team)";
    app.save(collection);
});
