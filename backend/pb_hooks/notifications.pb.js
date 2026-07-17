/// <reference path="../pb_data/types.d.ts" />

// 17. Notificaciones: Auto-crear notificaciones cuando ocurre un match en Tinder Beauchef
onRecordAfterCreateSuccess((e) => {
    try {
        const match = e.record;
        const userAId = match.getString("userA");
        const userBId = match.getString("userB");

        const userA = $app.findRecordById("users", userAId);
        const userB = $app.findRecordById("users", userBId);

        const nameA = userA.getString("name") || "Alguien";
        const nameB = userB.getString("name") || "Alguien";

        const notifCollection = $app.findCollectionByNameOrId("notifications");

        // 1. Notificación para el Usuario A (con emisor/sender = Usuario B)
        const notifA = new Record(notifCollection);
        notifA.set("user", userAId);
        notifA.set("sender", userBId);
        notifA.set("type", "match");
        notifA.set("title", "¡Nuevo Match!");
        notifA.set("body", "Te has conectado con " + nameB + ". ¡Ponte en contacto!");
        notifA.set("read", false);
        notifA.set("relatedId", match.id);
        $app.save(notifA);

        // 2. Notificación para el Usuario B (con emisor/sender = Usuario A)
        const notifB = new Record(notifCollection);
        notifB.set("user", userBId);
        notifB.set("sender", userAId);
        notifB.set("type", "match");
        notifB.set("title", "¡Nuevo Match!");
        notifB.set("body", "Te has conectado con " + nameA + ". ¡Ponte en contacto!");
        notifB.set("read", false);
        notifB.set("relatedId", match.id);
        $app.save(notifB);

        console.log("[Notifications] Match notifications created successfully for match", match.id);
    } catch (err) {
        console.log("[Notifications] Error creating match notifications:", err.message || err);
    }
}, "tinder_matches");


