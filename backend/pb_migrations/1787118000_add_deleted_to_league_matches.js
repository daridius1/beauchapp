/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("league_matches");
    collection.fields.add(new Field({
        name: "deleted",
        type: "bool",
        required: false,
        presentable: false,
    }));
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("league_matches");
    collection.fields.removeByName("deleted");
    app.save(collection);
});
