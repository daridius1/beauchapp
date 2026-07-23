/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    try {
        const collections = ["posts", "problems", "ladder_matches"];
        
        collections.forEach((colName) => {
            try {
                const col = app.findCollectionByNameOrId(colName);
                if (!col.fields.find((f) => f.name === "quoteCount")) {
                    col.fields.add({
                        name: "quoteCount",
                        type: "number",
                        required: false,
                    });
                    app.save(col);
                    console.log(`[Migration] Campo quoteCount añadido a ${colName}`);
                }
            } catch (cErr) {
                console.error(`Error añadiendo quoteCount a ${colName}:`, cErr);
            }
        });
    } catch (err) {
        console.error("Error al agregar campo quoteCount:", err);
    }
}, (app) => {
    // Revertir no requiere acción destructiva
});
