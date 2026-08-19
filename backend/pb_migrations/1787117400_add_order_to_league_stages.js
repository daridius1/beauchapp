/// <reference path="../pb_data/types.d.ts" />

// Orden explícito de las etapas dentro de una liga — antes se mostraban siempre en
// orden de creación (`sort: 'created'`), sin forma de reordenarlas después. `order` es
// simplemente un entero por etapa; la vista de liga y /admin/liga ordenan por este
// campo (no por fecha), y /admin/liga permite subir/bajar cada etapa un puesto.
migrate((app) => {
    const collection = app.findCollectionByNameOrId("league_stages");
    collection.fields.add(new Field({
        name: "order",
        type: "number",
        required: false,
    }));
    app.save(collection);

    // Las etapas ya existentes quedan numeradas según su orden de creación actual (0, 1,
    // 2...) por liga — así el orden visible no cambia para nadie al desplegar esto.
    const leagues = new Set(
        app.findRecordsByFilter("league_stages", "", "", 0, 0).map((r) => r.getString("league"))
    );
    leagues.forEach((leagueId) => {
        const stages = app.findRecordsByFilter("league_stages", "league = {:league}", "created", 0, 0, { league: leagueId });
        stages.forEach((r, idx) => {
            r.set("order", idx);
            app.save(r);
        });
    });
}, (app) => {
    const collection = app.findCollectionByNameOrId("league_stages");
    collection.fields.removeByName("order");
    app.save(collection);
});
