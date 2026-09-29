/// <reference path="../pb_data/types.d.ts" />

// La alianza se guarda como una clave estable y pequeña. Los marcos viven dentro del
// bundle del frontend, no en PocketBase ni en R2, para que el cliente los pueda cachear.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new Field({
        name: "alliance",
        type: "select",
        values: ["urbana", "pop", "gotico", "hiphop", "punk", "rock"],
        maxSelect: 1,
        required: false,
    }));
    app.save(users);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("alliance");
    app.save(users);
});
