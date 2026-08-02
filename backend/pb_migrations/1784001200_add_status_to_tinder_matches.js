/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    try {
        const matches = app.findCollectionByNameOrId("tinder_matches");

        // 1. Agregar campo 'status' si no existe
        const existingStatus = matches.fields.find((f) => f.name === "status");
        if (!existingStatus) {
            matches.fields.add(
                new Field({
                    name: "status",
                    type: "text",
                    required: false,
                })
            );
        }

        // 2. Agregar campo 'unmatchedBy' si no existe
        const existingUnmatchedBy = matches.fields.find((f) => f.name === "unmatchedBy");
        if (!existingUnmatchedBy) {
            matches.fields.add(
                new Field({
                    name: "unmatchedBy",
                    type: "relation",
                    collectionId: "_pb_users_auth_",
                    cascadeDelete: false,
                    maxSelect: 1,
                    required: false,
                })
            );
        }

        // 3. Actualizar updateRule para permitir a los usuarios del match cambiar el estado a 'unmatched'
        matches.updateRule = "@request.auth.id != '' && (@request.auth.id = userA || @request.auth.id = userB)";

        app.save(matches);
    } catch (err) {
        console.error("Error al actualizar esquema de tinder_matches:", err);
    }
}, (app) => {
    // Reversión opcional
});
