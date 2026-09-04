/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("news");
    collection.fields.add(new Field({
        // "Bajada" — el resumen de una línea bajo el título, además del cuerpo. La
        // genera la IA junto con título/cuerpo (ver parseAiResponse en lib/newsGen.js) y
        // se puede editar aparte en /admin/noticias, no queda mezclada dentro del cuerpo.
        name: "subtitle",
        type: "text",
        required: false,
        max: 300,
    }));
    collection.fields.add(new Field({
        // Contexto libre que el editor escribe a mano antes de generar (ej. "es el
        // regreso de un jugador lesionado") — se manda tal cual a la IA como una fuente
        // más, sin estructura fija. Se guarda para que quede trazable qué se le dio a la
        // IA además de las fuentes automáticas.
        name: "editorContext",
        type: "text",
        required: false,
        max: 3000,
    }));
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("news");
    collection.fields.removeByName("subtitle");
    collection.fields.removeByName("editorContext");
    app.save(collection);
});
