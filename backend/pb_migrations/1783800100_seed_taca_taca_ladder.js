/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const laddersColl = app.findCollectionByNameOrId("ladders");
    
    // Verificar si ya existe
    try {
        app.findFirstRecordByFilter("ladders", "slug = 'taca-taca'");
        return; // Ya existe
    } catch (err) {}

    const tacaTaca = new Record(laddersColl);
    tacaTaca.set("id", "tacatacaladder1");
    tacaTaca.set("name", "Taca Taca Beauchef");
    tacaTaca.set("slug", "taca-taca");
    tacaTaca.set("icon", "activity");
    tacaTaca.set("description", "Ranking oficial de Taca Taca en la FCFM. Partidos 2v2 a 5 goles.");
    tacaTaca.set("max_score", 5);
    tacaTaca.set("allowed_modes", JSON.stringify(["2v2"]));
    tacaTaca.set("is_active", true);

    app.save(tacaTaca);
}, (app) => {
    try {
        const record = app.findFirstRecordByFilter("ladders", "slug = 'taca-taca'");
        if (record) {
            app.delete(record);
        }
    } catch (e) {}
});
