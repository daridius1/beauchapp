/// <reference path="../pb_data/types.d.ts" />

// Secreto generado una sola vez para firmar partidas sin depender de configuración
// manual del servidor. La colección no tiene reglas públicas y nunca sale por la API.
migrate((app) => {
    const secrets = new Collection({
        name: "alliance_game_secrets",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            { name: "game", type: "text", required: true, max: 40 },
            { name: "secret", type: "text", required: true, min: 64, max: 64 },
            { name: "created", type: "autodate", onCreate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_alliance_game_secret_game ON alliance_game_secrets (game)"],
    });
    app.save(secrets);

    const nikita = new Record(secrets);
    nikita.set("game", "nikita-jump");
    nikita.set("secret", $security.randomString(64));
    app.save(nikita);
}, (app) => {
    const secrets = app.findCollectionByNameOrId("alliance_game_secrets");
    if (secrets) app.delete(secrets);
});
