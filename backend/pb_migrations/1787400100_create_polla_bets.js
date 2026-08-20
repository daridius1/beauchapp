/// <reference path="../pb_data/types.d.ts" />

// Apuestas de la Beaupolla: una fila por (partido, persona).
//
// EL SECRETO ES LA REGLA, NO LA UI. Hasta que se cierran las apuestas de un partido,
// cada quien solo puede leer la suya; una vez cerradas, cualquiera ve las de todos.
// Eso se impone acá con `match.bettingClosesAt <= @now`, no filtrando en el cliente —
// si viviera en la app, bastaría con abrir la API a mano para espiar las apuestas
// ajenas antes de que empiece el partido, que es justamente lo único que hay que
// proteger en este juego.
//
// Escribir tiene la condición inversa (`> @now`): no se puede apostar ni cambiar la
// apuesta una vez cerrado. Los campos `user`, `match` y `league` quedan congelados tras
// la creación para que nadie mueva una apuesta vieja a otro partido.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    const leagueMatches = app.findCollectionByNameOrId("league_matches");

    const collection = new Collection({
        type: "base",
        name: "polla_bets",

        listRule: "@request.auth.id != '' && (user = @request.auth.id || match.bettingClosesAt <= @now)",
        viewRule: "@request.auth.id != '' && (user = @request.auth.id || match.bettingClosesAt <= @now)",
        createRule: "@request.auth.id != '' && user = @request.auth.id && match.bettingClosesAt > @now",
        updateRule: "@request.auth.id != '' && user = @request.auth.id && match.bettingClosesAt > @now"
            + " && (@request.body.user:isset = false || @request.body.user = user)"
            + " && (@request.body.match:isset = false || @request.body.match = match)"
            + " && (@request.body.league:isset = false || @request.body.league = league)",
        deleteRule: null,

        fields: [
            {
                name: "league",
                type: "relation",
                required: true,
                collectionId: users.id,
                cascadeDelete: false,
                maxSelect: 1,
            },
            {
                name: "match",
                type: "relation",
                required: true,
                collectionId: leagueMatches.id,
                cascadeDelete: true,
                maxSelect: 1,
            },
            {
                name: "user",
                type: "relation",
                required: true,
                collectionId: users.id,
                cascadeDelete: true,
                maxSelect: 1,
            },
            {
                name: "pick",
                type: "select",
                required: true,
                maxSelect: 1,
                values: ["home", "draw", "away"],
            },
            { name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],

        indexes: [
            "CREATE UNIQUE INDEX `idx_polla_match_user` ON `polla_bets` (`match`, `user`)",
            "CREATE INDEX `idx_polla_league_user` ON `polla_bets` (`league`, `user`)",
        ],
    });

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("polla_bets");
    app.delete(collection);
});
