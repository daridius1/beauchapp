/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const collection = app.findCollectionByNameOrId("reports");
    if (!collection.fields.find((f) => f.name === "title")) {
        collection.fields.add(new Field({
            name: "title",
            type: "text",
            required: true,
        }));
        app.save(collection);
    }
}, (app) => {
    try {
        const collection = app.findCollectionByNameOrId("reports");
        collection.fields.removeByName("title");
        app.save(collection);
    } catch (e) {}
});
