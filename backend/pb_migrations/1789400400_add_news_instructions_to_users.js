/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("users");
    collection.fields.add(new Field({
        // Instrucciones editoriales adicionales para /admin/noticias — solo tiene
        // sentido para cuentas subtype=media, pero se guarda como cualquier otro campo
        // de perfil de organización (mismo patrón que chip_text/description). Se
        // AGREGAN al prompt base (que sí tiene las reglas no negociables de privacidad y
        // formato, fijas en el código) — nunca lo reemplazan. El límite de tamaño es la
        // defensa contra abuso: alcanza para hartas instrucciones de tono/estilo, no
        // para inflar el costo de cada generación sin límite.
        name: "newsInstructions",
        type: "text",
        required: false,
        max: 2000,
    }));
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("users");
    collection.fields.removeByName("newsInstructions");
    app.save(collection);
});
