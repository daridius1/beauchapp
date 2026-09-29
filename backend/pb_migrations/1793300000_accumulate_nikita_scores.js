/// <reference path="../pb_data/types.d.ts" />

// Desde esta versión cada partida aporta al total y el puntaje deja de ser
// lineal. La conversión queda copiada acá porque una migración debe conservar
// su comportamiento aunque la fórmula del juego cambie en el futuro.
migrate((app) => {
    function scoreFromLegacyScore(legacyScore) {
        const distance = Math.max(0, Number(legacyScore) || 0) / 10;
        return Math.floor(distance * Math.log(distance + 1) / Math.LN2);
    }

    const scores = app.findCollectionByNameOrId("alliance_nikita_scores");
    scores.fields.add(new NumberField({
        name: "total_score",
        min: 0,
        max: 1000000000000,
        noDecimal: true,
        required: false,
    }));
    app.save(scores);

    const pageSize = 200;
    let offset = 0;
    while (true) {
        const runs = app.findRecordsByFilter(
            "alliance_nikita_runs", "id != ''", "id", pageSize, offset
        );
        if (!runs || runs.length === 0) break;
        for (const run of runs) {
            run.set("score", scoreFromLegacyScore(run.getInt("score")));
            app.save(run);
        }
        offset += runs.length;
    }

    offset = 0;
    while (true) {
        const memberships = app.findRecordsByFilter(
            "alliance_nikita_scores", "id != ''", "id", pageSize, offset
        );
        if (!memberships || memberships.length === 0) break;
        for (const membership of memberships) {
            membership.set("high_score", scoreFromLegacyScore(membership.getInt("high_score")));
            app.save(membership);
        }
        offset += memberships.length;
    }

    // Cuando existe historial usamos la suma de las partidas registradas. Un
    // récord anterior a ese historial cuenta una vez como piso, no se pierde.
    app.db().newQuery(
        "UPDATE alliance_nikita_scores SET total_score = MAX(high_score, COALESCE((" +
        "SELECT SUM(r.score) FROM alliance_nikita_runs r " +
        "WHERE r.user = alliance_nikita_scores.user" +
        "), 0))"
    ).execute();
}, (app) => {
    // La conversión histórica de puntajes es irreversible a propósito: volver
    // a la escala vieja mezclaría partidas jugadas bajo dos fórmulas distintas.
    const scores = app.findCollectionByNameOrId("alliance_nikita_scores");
    scores.fields.removeByName("total_score");
    app.save(scores);
});
