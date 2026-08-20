/// <reference path="../pb_data/types.d.ts" />

// La Beaupolla: cada persona apuesta quién gana cada partido de una liga.
//
// `users.pollaEnabled` — la liga (type=organization, subtype=league) la habilita. No
// hay colección "leagues": la cuenta de usuario ES la liga, igual que el resto del
// sistema (ver la cabecera de league.pb.js).
//
// `league_matches.bettingClosesAt` — el instante exacto en que se cierran las apuestas
// de ese partido. Un solo campo cubre las DOS condiciones de cierre:
//   1) 10 minutos antes de la hora del bloque agendado — se calcula al crear el partido,
//      porque el horario ya se conoce ahí;
//   2) cuando el partido efectivamente arranca en la vista de arbitraje — ahí el hook
//      adelanta el campo a "ahora", que siempre es anterior al valor original.
// Así "¿está cerrado?" es una sola comparación contra @now, y eso permite imponer el
// SECRETO de las apuestas en la propia regla de la colección en vez de confiar en el
// cliente. Ver polla.pb.js.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new Field({
        name: "pollaEnabled",
        type: "bool",
        required: false,
        presentable: false,
    }));
    app.save(users);

    const matches = app.findCollectionByNameOrId("league_matches");
    matches.fields.add(new Field({
        name: "bettingClosesAt",
        type: "date",
        required: false,
        presentable: false,
    }));
    app.save(matches);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("pollaEnabled");
    app.save(users);

    const matches = app.findCollectionByNameOrId("league_matches");
    matches.fields.removeByName("bettingClosesAt");
    app.save(matches);
});
