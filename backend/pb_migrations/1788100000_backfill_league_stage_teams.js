/// <reference path="../pb_data/types.d.ts" />

// Congela los participantes de las etapas que dependían del fallback "vacío = todo el
// roster de la liga" (ver 1787500000_add_teams_to_league_stages.js).
//
// Ese fallback hacía indistinguible una etapa vieja (sin el campo `teams` definido, se
// entendía que jugaba todo el roster) de una etapa nueva recién creada (todavía sin
// participantes marcados, se debería mostrar vacía). El código que consumía `teams` ya
// no hace ese fallback: a partir de ahora, `teams` vacío significa "sin participantes
// todavía". Para no dejar en blanco las etapas que ya estaban en uso, acá se les copia
// el roster de su liga tal cual estaba en el momento de esta migración — el mismo
// conjunto que el fallback les venía devolviendo hasta ahora.
migrate((app) => {
    const stages = app.findRecordsByFilter("league_stages", "deleted = false", "", 0, 0);
    stages.forEach((stage) => {
        const current = stage.get("teams") || [];
        if (current.length) return;

        const rosterRows = app.findRecordsByFilter(
            "league_teams",
            "league = {:league} && deleted = false",
            "", 0, 0,
            { league: stage.getString("league") }
        );
        if (!rosterRows.length) return;

        stage.set("teams", rosterRows.map((r) => r.getString("team")));
        app.save(stage);
    });
}, (app) => {
    // No hay vuelta atrás confiable: no se puede saber cuáles de estos valores ya
    // existían antes de la migración (una etapa creada con participantes explícitos
    // justo antes de correrla se ve idéntica a una que esta migración completó).
});
