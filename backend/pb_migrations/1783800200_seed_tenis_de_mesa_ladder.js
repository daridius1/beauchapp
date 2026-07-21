/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const laddersColl = app.findCollectionByNameOrId("ladders");
    
    // Verificar si ya existe
    try {
        app.findFirstRecordByFilter("ladders", "slug = 'tenis-de-mesa'");
        return; // Ya existe
    } catch (err) {}

    const pingPong = new Record(laddersColl);
    pingPong.set("id", "tenisdemesalad1");
    pingPong.set("name", "Tenis de Mesa Beauchef");
    pingPong.set("slug", "tenis-de-mesa");
    pingPong.set("icon", "activity");
    pingPong.set("description", "Ranking oficial de Tenis de Mesa (Ping Pong) FCFM. Partidos 1v1 o 2v2 al mejor de sets.");
    pingPong.set("max_score", 11);
    pingPong.set("allowed_modes", JSON.stringify(["1v1", "2v2"]));
    pingPong.set("is_active", true);

    app.save(pingPong);
}, (app) => {
    try {
        const record = app.findFirstRecordByFilter("ladders", "slug = 'tenis-de-mesa'");
        if (record) {
            app.delete(record);
        }
    } catch (e) {}
});
