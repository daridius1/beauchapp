/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    try {
        const postsCollection = app.findCollectionByNameOrId("posts");
        
        // 1. actionType: 'post', 'repost', 'quote', 'reply'
        if (!postsCollection.fields.find((f) => f.name === "actionType")) {
            postsCollection.fields.add(
                new SchemaField({
                    name: "actionType",
                    type: "text",
                    required: false,
                })
            );
        }

        // 2. targetType: 'post', 'problem', 'match', etc.
        if (!postsCollection.fields.find((f) => f.name === "targetType")) {
            postsCollection.fields.add(
                new SchemaField({
                    name: "targetType",
                    type: "text",
                    required: false,
                })
            );
        }

        // 3. targetId: ID del registro citado o respondido
        if (!postsCollection.fields.find((f) => f.name === "targetId")) {
            postsCollection.fields.add(
                new SchemaField({
                    name: "targetId",
                    type: "text",
                    required: false,
                })
            );
        }

        // 4. targetMeta: JSON de respaldo desnormalizado
        if (!postsCollection.fields.find((f) => f.name === "targetMeta")) {
            postsCollection.fields.add(
                new SchemaField({
                    name: "targetMeta",
                    type: "json",
                    required: false,
                })
            );
        }

        app.save(postsCollection);
        console.log("[Migration] Se añadieron los campos polimórficos actionType, targetType, targetId, targetMeta a posts.");
    } catch (err) {
        console.error("Error al agregar campos polimórficos a posts:", err);
    }
}, (app) => {
    // Revertir no requiere acción destructiva
});
