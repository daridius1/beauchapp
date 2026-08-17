/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // El código de arbitraje es una propiedad del PARTIDO, no de la sesión de
    // arbitraje: existe desde que el partido se crea (lo genera la liga al agendarlo),
    // y hace falta desde el primer intento de arbitrarlo — no hay ningún "fundador"
    // que lo reciba gratis. hidden:true por el mismo motivo que antes: nunca viaja en
    // una lectura normal de la colección, solo lo devuelven las rutas de
    // league.pb.js/match_arbitration.pb.js cuando corresponde.
    const matches = app.findCollectionByNameOrId("league_matches");
    matches.fields.add(new Field({
        name: "code",
        type: "text",
        required: true,
        max: 6,
        min: 6,
        hidden: true
    }));
    app.save(matches);

    const reports = app.findCollectionByNameOrId("match_reports");
    reports.fields.removeByName("code");
    app.save(reports);
}, (app) => {
    const matches = app.findCollectionByNameOrId("league_matches");
    matches.fields.removeByName("code");
    app.save(matches);

    const reports = app.findCollectionByNameOrId("match_reports");
    reports.fields.add(new Field({
        name: "code",
        type: "text",
        required: true,
        max: 6,
        min: 6,
        hidden: true
    }));
    app.save(reports);
});
