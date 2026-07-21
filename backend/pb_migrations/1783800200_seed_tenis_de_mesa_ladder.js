/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const laddersColl = app.findCollectionByNameOrId("ladders");
    
    // Si ya existía el registro de tenis de mesa anterior, lo actualizamos o recreamos
    try {
        const existing = app.findFirstRecordByFilter("ladders", "slug = 'tenis-de-mesa'");
        if (existing) {
            existing.set("name", "Tenis de Mesa 1v1");
            existing.set("allowed_modes", JSON.stringify(["1v1"]));
            existing.set("description", "Ranking oficial de Tenis de Mesa (Ping Pong) FCFM en modalidad Individuales (1v1).");
            app.save(existing);
            return;
        }
    } catch (err) {}

    const pingPong = new Record(laddersColl);
    pingPong.set("id", "tenisdemesalad1");
    pingPong.set("name", "Tenis de Mesa 1v1");
    pingPong.set("slug", "tenis-de-mesa");
    pingPong.set("icon", "activity");
    pingPong.set("description", "Ranking oficial de Tenis de Mesa (Ping Pong) FCFM en modalidad Individuales (1v1).");
    pingPong.set("max_score", 11);
    pingPong.set("allowed_modes", JSON.stringify(["1v1"]));
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
