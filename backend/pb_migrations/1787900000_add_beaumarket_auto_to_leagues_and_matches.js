/// <reference path="../pb_data/types.d.ts" />

// Mercado automático de Beaumarket para partidos de liga — mismo patrón que la Beaupolla
// (ver 1787400000_add_polla_to_leagues_and_matches.js):
//
// `users.beaumarketAutoEnabled` — la liga (type=organization, subtype=league) la
// habilita. Es una opción aparte de `pollaEnabled`, no atada a ella: una liga puede
// querer la polla sin plata simulada de por medio, o el mercado sin la polla.
//
// `league_matches.beaumarketMarket` — el mercado que le corresponde a ESE partido en
// particular, creado automáticamente al agendarlo (ver POST /api/liga/matches/accept)
// si la liga tiene la opción prendida. Va en el partido y no al revés (un campo
// `match` en `beaumarkets` apuntando para acá) para que la vista de un partido pueda
// resolver "¿tiene mercado?" leyendo el propio registro que ya tiene en mano, sin una
// consulta aparte a `beaumarkets` filtrando por partido.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new Field({
        name: "beaumarketAutoEnabled",
        type: "bool",
        required: false,
        presentable: false,
    }));
    app.save(users);

    const matches = app.findCollectionByNameOrId("league_matches");
    const beaumarkets = app.findCollectionByNameOrId("beaumarkets");
    matches.fields.add(new Field({
        name: "beaumarketMarket",
        type: "relation",
        required: false,
        presentable: false,
        collectionId: beaumarkets.id,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1,
    }));
    app.save(matches);
}, (app) => {
    const matches = app.findCollectionByNameOrId("league_matches");
    matches.fields.removeByName("beaumarketMarket");
    app.save(matches);

    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("beaumarketAutoEnabled");
    app.save(users);
});
