/// <reference path="../pb_data/types.d.ts" />

// La escala real de calificación de bloques es 1 (Muy mala) a 5 (Excelente) — ver
// AvailabilityGrid.tsx (MIN_LEVEL/MAX_LEVEL) y la validación de team_schedule.pb.js
// (v < 1 || v > 5). Los campos happinessA/happinessB de league_matches y
// horario_matches se crearon con max:4 por error, así que guardar un partido donde
// algún equipo calificó el bloque como "Excelente" (5) rechazaba el registro entero
// con "Must be less or equal than 4" — se vio al aceptar una sugerencia del algoritmo
// en /admin/liga.
migrate((app) => {
    for (const collName of ["league_matches", "horario_matches"]) {
        const coll = app.findCollectionByNameOrId(collName);
        coll.fields.getByName("happinessA").max = 5;
        coll.fields.getByName("happinessB").max = 5;
        app.save(coll);
    }
}, (app) => {
    for (const collName of ["league_matches", "horario_matches"]) {
        const coll = app.findCollectionByNameOrId(collName);
        coll.fields.getByName("happinessA").max = 4;
        coll.fields.getByName("happinessB").max = 4;
        app.save(coll);
    }
});
