/// <reference path="../pb_data/types.d.ts" />

// ---------------------------------------------------------------------------------
// Ciclo de vida de la invitación a una organización — separado de auth.pb.js (que es
// solo validación de tipos de cuenta) porque esto es comportamiento nuevo: notificar
// al invitado y darle una ruta para aceptar/rechazar. Toda fila de organization_members
// nace en status='pending' (forzado en auth.pb.js sin importar qué mande el cliente);
// esto es lo que la convierte en una invitación real en vez de una alta instantánea.
// ---------------------------------------------------------------------------------

// Notifica al estudiante invitado apenas se crea la fila pendiente. Mismo patrón que
// las notificaciones de tinder_matches/activities en notifications.pb.js.
onRecordAfterCreateSuccess((e) => {
    try {
        const member = e.record;
        if (member.getString("status") !== "pending") return;

        const userId = member.getString("user");
        const orgId = member.getString("organization");

        const org = $app.findRecordById("users", orgId);
        const orgName = org.getString("name") || org.getString("username") || "Una organización";

        const notifCollection = $app.findCollectionByNameOrId("notifications");
        const notif = new Record(notifCollection);
        notif.set("user", userId);
        notif.set("sender", orgId);
        notif.set("type", "org_invite");
        notif.set("title", "Invitación a una organización");
        notif.set("body", orgName + " te invitó a unirte.");
        notif.set("read", false);
        notif.set("relatedId", orgId);
        $app.save(notif);
    } catch (err) {
        console.error("[organizations.pb.js] Error creando notificación de invitación:", err.message || err);
    }
}, "organization_members");

// Aceptar/rechazar una invitación pendiente — el propio estudiante invitado, autenticado
// con su cuenta. Usa $app.save/$app.delete a propósito (evita el onRecordUpdateRequest
// de auth.pb.js que bloquea a cualquier CLIENTE mover status a 'active' por la API
// normal) — esta ruta es la única vía legítima para activar una membresía.
routerAdd("POST", "/api/org-invites/respond", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const organizationId = String(body.organizationId || "");
        const decision = String(body.decision || "");
        if (!organizationId) throw new BadRequestError("Falta organizationId.");
        if (decision !== "accept" && decision !== "reject") {
            throw new BadRequestError("decision debe ser 'accept' o 'reject'.");
        }

        let invite;
        try {
            invite = $app.findFirstRecordByFilter(
                "organization_members",
                "organization = {:org} && user = {:user} && status = 'pending'",
                { org: organizationId, user: e.auth.id }
            );
        } catch (err) {
            throw new BadRequestError("No tienes ninguna invitación pendiente de esa organización.");
        }

        if (decision === "accept") {
            invite.set("status", "active");
            $app.save(invite);
        } else {
            $app.delete(invite);
        }

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[organizations.pb.js] Error en POST /api/org-invites/respond:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo responder la invitación." });
    }
}, $apis.requireAuth("users"));
