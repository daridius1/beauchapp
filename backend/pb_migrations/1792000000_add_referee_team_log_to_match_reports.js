/// <reference path="../pb_data/types.d.ts" />

// Trazabilidad del arbitraje IN-APP hecho por el equipo asignado (ver
// POST /api/league-matches/team-result en match_result.pb.js): a diferencia del link de
// un solo uso (anónimo, sin cuenta) y de la enmienda de la liga (amendedBy/amendedAt,
// que solo guardan la ÚLTIMA corrección), acá los dos equipos árbitro de un mismo
// partido (league_matches.refereeTeams) pueden cargar o corregir el resultado desde su
// propia cuenta, así que hace falta un historial completo — no solo el último — para
// poder responder "¿qué equipo cargó este dato?" ante un error. Igual que `events`, es
// un registro que solo crece (nunca se reescribe una entrada vieja).
migrate((app) => {
    const collection = app.findCollectionByNameOrId("match_reports");

    collection.fields.add(new Field({
        name: "refereeTeamLog",
        type: "json",
        required: false,
        presentable: false,
        maxSize: 50000,
    }));

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("match_reports");
    collection.fields.removeByName("refereeTeamLog");
    app.save(collection);
});
