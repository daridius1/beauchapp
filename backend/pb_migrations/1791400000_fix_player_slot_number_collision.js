/// <reference path="../pb_data/types.d.ts" />

// Corrige datos ya escritos por el bug real de team_players.pb.js (ver el comentario
// grande ahí, en la asignación de slotNumber): la consulta de "próximo slot" hacía
// MAX(slotNumber) de TODO el equipo sin filtrar por role — el DT nunca recibe un
// slotNumber propio (queda en el 0 por defecto del campo, no NULL), así que si un
// equipo ya tenía DT cuando se agregó su primer jugador, ese 0 se colaba en el MAX y
// el COALESCE(..., 9) no entraba en juego (el agregado daba 0 de verdad, no NULL) —
// los jugadores arrancaban en el slot 1 en vez del 10, invadiendo el rango 00-09
// reservado para las cartas especiales del álbum (escudo/foto/DT, ver lib/album.js).
// Un jugador con slotNumber=2 termina con el MISMO código de figurita que el DT
// (SLOT_DT=2) — comparten fila de album_stickers: pegar uno pega literalmente al
// otro.
//
// Acá se renumeran los jugadores mal asignados, equipo por equipo, respetando su
// orden relativo original (que refleja el orden en que se agregaron), a partir del
// primer slot >= 10 que esté realmente libre en ese equipo — nunca 10 a secas, por si
// alguno ya tenía un slotNumber bueno de antes.
migrate((app) => {
    const FIRST_PLAYER_SLOT = 10;
    const teamRows = arrayOf(new DynamicModel({ team: "" }));
    app.db()
        .newQuery("SELECT DISTINCT team FROM team_players WHERE role = 'player' AND slotNumber < " + FIRST_PLAYER_SLOT)
        .all(teamRows);

    teamRows.forEach((row) => {
        const players = app.findRecordsByFilter(
            "team_players", "team = {:team} && role = 'player'", "slotNumber", 500, 0, { team: row.team }
        );

        let next = FIRST_PLAYER_SLOT;
        players.forEach((p) => {
            if (p.getInt("slotNumber") >= FIRST_PLAYER_SLOT) {
                next = Math.max(next, p.getInt("slotNumber") + 1);
            }
        });

        players.forEach((p) => {
            if (p.getInt("slotNumber") < FIRST_PLAYER_SLOT) {
                p.set("slotNumber", next);
                app.save(p);
                next++;
            }
        });
    });
}, (app) => {
    // Sin vuelta atrás sensata: los valores viejos eran directamente un bug (colisión
    // de códigos de figurita), no una elección de diseño que valga la pena restaurar.
});
