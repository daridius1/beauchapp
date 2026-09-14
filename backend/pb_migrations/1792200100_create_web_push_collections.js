/// <reference path="../pb_data/types.d.ts" />

// Las suscripciones pertenecen al dispositivo, no al perfil: una persona puede tener
// varios navegadores y cerrar sesión en cualquiera de ellos sin afectar los demás.
// La cola se mantiene separada de notifications para que el envío sea reintentable y
// no agregue una llamada saliente por cada seguidor dentro del hook que crea el aviso.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    const notifications = app.findCollectionByNameOrId("notifications");

    const subscriptions = new Collection({
        name: "push_subscriptions",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            { name: "user", type: "relation", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
            { name: "endpoint", type: "url", required: true, max: 2000 },
            { name: "p256dh", type: "text", required: true, max: 255 },
            { name: "auth", type: "text", required: true, max: 255 },
            { name: "userAgent", type: "text", required: false, max: 500 },
            { name: "disabled", type: "bool", required: true, default: false },
            { name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_push_subscriptions_endpoint ON push_subscriptions (endpoint)",
            "CREATE INDEX idx_push_subscriptions_user_active ON push_subscriptions (user, disabled)"
        ]
    });
    app.save(subscriptions);

    const outbox = new Collection({
        name: "push_outbox",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            { name: "notification", type: "relation", required: true, collectionId: notifications.id, cascadeDelete: true, maxSelect: 1 },
            { name: "attempts", type: "number", required: true, min: 0, noDecimal: true, default: 0 },
            { name: "status", type: "select", required: true, values: ["pending", "sent", "failed", "discarded"], maxSelect: 1, default: "pending" },
            { name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_push_outbox_notification ON push_outbox (notification)",
            "CREATE INDEX idx_push_outbox_pending ON push_outbox (status, attempts, created)"
        ]
    });
    app.save(outbox);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("push_outbox")); } catch (err) {}
    try { app.delete(app.findCollectionByNameOrId("push_subscriptions")); } catch (err) {}
});
