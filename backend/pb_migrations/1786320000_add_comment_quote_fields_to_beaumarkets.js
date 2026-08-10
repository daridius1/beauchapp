/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    // Habilita que un mercado de Beaumarket sea "citable"/"comentable" por el sistema
    // polimórfico de posts (mismo patrón ya usado por problems/activities/courses/etc.
    // en forum.pb.js, targetType = "beaumarket").
    const collection = app.findCollectionByNameOrId("beaumarkets");

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
    const collection = app.findCollectionByNameOrId("beaumarkets");
    collection.fields.removeByName("commentCount");
    collection.fields.removeByName("quoteCount");
    app.save(collection);
});
