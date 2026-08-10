/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    // Habilita que el hilo de "hoy en Beaudle" (compartido por todos los jugadores del
    // día, vía beaudle_daily_stats — nunca beaudle_games, que es privado por usuario) sea
    // comentable/citable por el sistema polimórfico de posts (mismo patrón ya usado por
    // activities/courses/beaumarkets/etc. en forum.pb.js, targetType = "beaudle").
    const collection = app.findCollectionByNameOrId("beaudle_daily_stats");

    collection.fields.add(new Field({
        name: "commentCount",
        type: "number",
        min: 0,
        noDecimal: true,
        required: false
    }));

    collection.fields.add(new Field({
        name: "quoteCount",
        type: "number",
        min: 0,
        noDecimal: true,
        required: false
    }));

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("beaudle_daily_stats");
    collection.fields.removeByName("commentCount");
    collection.fields.removeByName("quoteCount");
    app.save(collection);
});
