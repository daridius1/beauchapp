/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const laddersColl = app.findCollectionByNameOrId("ladders");

    // Verificar si ya existe
    try {
        app.findFirstRecordByFilter("ladders", "slug = 'clash-royale'");
        return; // Ya existe
    } catch (err) {}

    const clashRoyale = new Record(laddersColl);
    clashRoyale.set("id", "clashroyalelad1");
    clashRoyale.set("name", "Clash Royale");
    clashRoyale.set("slug", "clash-royale");
    clashRoyale.set("icon", "crown");
    clashRoyale.set("description", "Ranking oficial de Clash Royale en la FCFM. El marcador registra las coronas con las que cada equipo terminó la partida.");
    clashRoyale.set("max_score", 3);
    clashRoyale.set("allowed_modes", JSON.stringify(["1v1", "2v2"]));
    clashRoyale.set("is_active", true);

    app.save(clashRoyale);
}, (app) => {
    try {
        const record = app.findFirstRecordByFilter("ladders", "slug = 'clash-royale'");
        if (record) {
            app.delete(record);
        }
    } catch (e) {}
});
