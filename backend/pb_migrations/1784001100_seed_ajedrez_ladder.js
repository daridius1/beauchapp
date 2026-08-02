/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const laddersColl = app.findCollectionByNameOrId("ladders");
    
    // Verificar si ya existe
    try {
        app.findFirstRecordByFilter("ladders", "slug = 'ajedrez'");
        return; // Ya existe
    } catch (err) {}

    const ajedrez = new Record(laddersColl);
    ajedrez.set("id", "ajedrezladder10");
    ajedrez.set("name", "Ajedrez");
    ajedrez.set("slug", "ajedrez");
    ajedrez.set("icon", "chess-king");
    ajedrez.set("description", "Ranking oficial de Ajedrez en la FCFM. Demuestra tu estrategia y sube en la clasificación.");
    ajedrez.set("max_score", 1);
    ajedrez.set("allowed_modes", JSON.stringify(["1v1"]));
    ajedrez.set("is_active", true);

    app.save(ajedrez);
}, (app) => {
    try {
        const record = app.findFirstRecordByFilter("ladders", "slug = 'ajedrez'");
        if (record) {
            app.delete(record);
        }
    } catch (e) {}
});
