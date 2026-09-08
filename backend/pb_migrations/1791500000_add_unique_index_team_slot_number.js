/// <reference path="../pb_data/types.d.ts" />

// Cinturón y tirantes sobre el fix de team_players.pb.js (ver el comentario grande
// ahí, en la asignación de slotNumber): ese cálculo sigue siendo un "leer MAX, sumar
// 1, guardar" sin transacción — si dos altas de jugador para el MISMO equipo
// llegaran a competir en simultáneo, nada a nivel de aplicación impide que las dos
// lean el mismo MAX y terminen guardando el mismo slotNumber, dos jugadores
// compartiendo el mismo código de figurita (y la misma fila de album_stickers) —
// el mismo síntoma de fondo que causó la colisión jugador/DT que se corrigió en
// 1791400000_fix_player_slot_number_collision.js, solo que entre dos jugadores en
// vez de jugador+DT. Este índice lo hace directamente imposible en la base, sin
// importar la carrera.
//
// `WHERE role = 'player'` — mismo patrón que el índice team+user de
// 1787117500_create_team_players.js — porque el DT nunca tiene slotNumber propio
// (se queda en el 0 por defecto siempre) y un equipo puede tener más de una fila de
// DT a lo largo del tiempo (el actual + los que se dieron de baja): sin este filtro
// esas filas chocarían entre sí por una razón que no tiene nada que ver con el
// problema real que este índice previene.
migrate((app) => {
    const collection = app.findCollectionByNameOrId("team_players");
    collection.indexes = [
        ...collection.indexes,
        "CREATE UNIQUE INDEX idx_team_players_team_slot ON team_players (team, slotNumber) WHERE role = 'player'",
    ];
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("team_players");
    collection.indexes = collection.indexes.filter((i) => !i.includes("idx_team_players_team_slot"));
    app.save(collection);
});
