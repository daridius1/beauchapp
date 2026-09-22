/// <reference path="../pb_data/types.d.ts" />

// La asignación se dirige a la cuenta del equipo, que es la única autorizada para
// cargar el resultado. Sus integrantes activos reciben una copia informativa con el
// mismo enlace al partido; una invitación pendiente no da acceso a estos avisos.
onRecordAfterCreateSuccess((e) => {
    const source = e.record;
    const type = source.getString("type");
    if (type !== "league_referee_assignment" && type !== "league_referee_result") return;

    try {
        const teamId = source.getString("user");
        const team = $app.findRecordById("users", teamId);
        if (team.getString("type") !== "organization" || team.getString("subtype") !== "team") return;

        const teamName = team.getString("name") || team.getString("username") || "tu equipo";
        const originalBody = source.getString("body");
        const body = type === "league_referee_assignment" && originalBody.indexOf("Tu equipo fue asignado a arbitrar ") === 0
            ? "Tu equipo " + teamName + " debe arbitrar " + originalBody.slice("Tu equipo fue asignado a arbitrar ".length)
            : "Tu equipo " + teamName + ": " + originalBody;
        const notifications = $app.findCollectionByNameOrId("notifications");
        const notified = new Set([teamId]);
        const pageSize = 100;
        let offset = 0;
        while (true) {
            const members = $app.findRecordsByFilter(
                "organization_members",
                "organization = {:team} && status = 'active'",
                "created", pageSize, offset, { team: teamId }
            );
            members.forEach((member) => {
                const userId = member.getString("user");
                if (!userId || notified.has(userId)) return;
                notified.add(userId);
                try {
                    const notification = new Record(notifications);
                    notification.set("user", userId);
                    notification.set("sender", source.getString("sender"));
                    // Tipo separado para que una cuenta de organización invitada como
                    // integrante no vuelva a repartir el aviso a sus propios miembros.
                    notification.set("type", type === "league_referee_assignment"
                        ? "league_referee_member_assignment" : "league_referee_member_result");
                    notification.set("title", source.getString("title"));
                    notification.set("body", body);
                    notification.set("read", false);
                    notification.set("relatedId", source.getString("relatedId"));
                    $app.save(notification);
                } catch (err) {
                    console.error("[Notifications] No se pudo avisar a un integrante del equipo árbitro:", err);
                }
            });
            if (members.length < pageSize) break;
            offset += pageSize;
        }
    } catch (err) {
        console.error("[Notifications] No se pudo avisar a los integrantes del equipo árbitro:", err);
    }
}, "notifications");

// 17. Notificaciones: Auto-crear notificaciones cuando ocurre un match en Tinder Beauchef
// (Queda async/onRecordAfterCreateSuccess a propósito: es puramente informativo y el match
// en tinder_matches en sí ya se crea de forma síncrona en tinder.pb.js.)
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
    } catch (err) {
        console.error("[Notifications] Error creating match notifications:", err.message || err);
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
            console.error("[Notifications] Organization user not found:", orgId);
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
    } catch (err) {
        console.error("[Notifications] Error creating activity notifications:", err.message || err);
    }
}, "activities");

