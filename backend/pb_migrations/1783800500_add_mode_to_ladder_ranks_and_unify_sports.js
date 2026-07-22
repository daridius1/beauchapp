/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    // 1. Agregar campo 'mode' a la colección 'ladder_ranks'
    try {
        const ladderRanks = app.findCollectionByNameOrId("ladder_ranks");
        const existingModeField = ladderRanks.fields.find((f) => f.name === "mode");
        if (!existingModeField) {
            ladderRanks.fields.add(
                new SchemaField({
                    name: "mode",
                    type: "text",
                    required: false,
                })
            );
            app.save(ladderRanks);
        }
    } catch (err) {
        console.error("Error al modificar el esquema de ladder_ranks:", err);
    }

    // 2. Unificar los nombres y slugs de la colección 'ladders'
    const laddersColl = app.findCollectionByNameOrId("ladders");

    // Tenis de Mesa
    try {
        const pingPong = app.findFirstRecordByFilter("ladders", "slug ~ 'tenis-de-mesa'");
        if (pingPong) {
            pingPong.set("name", "Tenis de Mesa");
            pingPong.set("slug", "tenis-de-mesa");
            pingPong.set("allowed_modes", JSON.stringify(["1v1", "2v2"]));
            app.save(pingPong);
        }
    } catch (err) {}

    // Taca Taca
    try {
        const tacaTaca = app.findFirstRecordByFilter("ladders", "slug ~ 'taca-taca'");
        if (tacaTaca) {
            tacaTaca.set("name", "Taca Taca");
            tacaTaca.set("slug", "taca-taca");
            tacaTaca.set("allowed_modes", JSON.stringify(["1v1", "2v2"]));
            app.save(tacaTaca);
        }
    } catch (err) {}

    // TipTap
    try {
        const tiptap = app.findFirstRecordByFilter("ladders", "slug ~ 'tiptap'");
        if (tiptap) {
            tiptap.set("name", "TipTap");
            tiptap.set("slug", "tiptap");
            tiptap.set("allowed_modes", JSON.stringify(["1v1"]));
            app.save(tiptap);
        }
    } catch (err) {}

}, (app) => {
    // Revertir no requiere acción destructiva
});
