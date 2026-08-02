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

// Auto-crear notificaciones para los seguidores cuando una organización agenda una actividad
onRecordAfterCreateSuccess((e) => {
    try {
        const activity = e.record;
        const orgId = activity.getString("organization");
        if (!orgId) return;

        let orgUser = null;
        try {
            orgUser = $app.findRecordById("users", orgId);
        } catch (err) {
            console.log("[Notifications] Organization user not found:", orgId);
            return;
        }

        const orgName = orgUser.getString("name") || orgUser.getString("username") || "Una organización";
        const activityTitle = activity.getString("title") || "Nueva actividad";
        const activityDate = activity.getString("date") || "";

        // Buscar seguidores de la organización
        const follows = $app.findRecordsByFilter("follows", "following = {:orgId}", "-created", 1000, 0, { orgId: orgId });

        const notifCollection = $app.findCollectionByNameOrId("notifications");

        for (let i = 0; i < follows.length; i++) {
            const followerId = follows[i].getString("follower");
            if (!followerId || followerId === orgId) continue;

            const notif = new Record(notifCollection);
            notif.set("user", followerId);
            notif.set("sender", orgId);
            notif.set("type", "activity");
            notif.set("title", "Nueva actividad de " + orgName);
            notif.set("body", activityTitle + (activityDate ? " • " + activityDate : ""));
            notif.set("read", false);
            notif.set("relatedId", activity.id);

            $app.save(notif);
        }

        console.log("[Notifications] Activity notifications created for", follows.length, "followers of org", orgId);
    } catch (err) {
        console.log("[Notifications] Error creating activity notifications:", err.message || err);
    }
}, "activities");



