/// <reference path="../pb_data/types.d.ts" />

// Eliminar cuenta (autoservicio). El endpoint admin-only que hace lo mismo para
// cualquier cuenta vive en admin_accounts.pb.js — comparten la secuencia de
// anonimización (comentada paso a paso acá) pero no pueden compartir una función:
// cada routerAdd corre en su propia VM (ver CLAUDE.md §2.1), así que se duplica.
//
// Principio de diseño: NUNCA $app.delete() sobre "users". Un hard-delete real
// dispararía las cascadas nativas de PocketBase sobre partidos, apuestas, hilos de
// foro y notificaciones de terceros (ver el registro de auditoría de esta feature).
// En su lugar, la fila se anonimiza in-place: se sobrescriben todos los campos
// identificables y se bloquea el login, pero id/type/subtype quedan intactos para no
// romper ninguna referencia. El contenido que la persona generó en otros lados queda,
// pero atribuido a "Cuenta eliminada".

routerAdd("POST", "/api/account/delete", (e) => {
    const { anonymizeUserRecord } = require(`${__hooks}/lib/accountDeletion.js`);

    const body = e.requestInfo().body;
    const password = body.password || "";
    if (!password) {
        return e.json(400, { error: "Debes ingresar tu contraseña para confirmar." });
    }

    const record = e.auth;
    if (!record.validatePassword(password)) {
        return e.json(400, { error: "Contraseña incorrecta." });
    }

    try {
        const email = record.getString("email");
        const emailHash = email ? $security.sha256(email.trim().toLowerCase()) : "";
        const usernamePlaceholder = "eliminado_" + record.id;
        const deletedAtIso = new Date().toISOString();

        anonymizeUserRecord(record, { emailHash, deletedAtIso, usernamePlaceholder });
        // Invalida cualquier sesión activa (esta y cualquier otro dispositivo/pestaña) y
        // cierra el login por password, además del bloqueo que ya impone authRule.
        record.setRandomPassword();
        record.refreshTokenKey();
        $app.save(record);

        // tinder_profiles es 100% perfil propio (fotos + contacto directo) sin valor
        // para terceros — se borra entero en vez de anonimizarse en el lugar.
        try {
            const tinderProfile = $app.findFirstRecordByFilter(
                "tinder_profiles", "user = {:id}", { id: record.id }
            );
            if (tinderProfile) $app.delete(tinderProfile);
        } catch (err) {
            // sin perfil de Tinder — camino normal
        }

        // seller_profiles sí queda (marketplace_items.seller lo referencia), pero se
        // vacían sus campos de contacto — mismo criterio que con users.
        try {
            const sellerProfile = $app.findFirstRecordByFilter(
                "seller_profiles", "user = {:id}", { id: record.id }
            );
            if (sellerProfile) {
                sellerProfile.set("bio", "");
                sellerProfile.set("wall_announcement", "");
                sellerProfile.set("wsp_phone", "");
                sellerProfile.set("instagram_handle", "");
                sellerProfile.set("contact_notes", "");
                $app.save(sellerProfile);
            }
        } catch (err) {
            // sin perfil de vendedor — camino normal
        }

        // Limpiar membresías/invitaciones de organización que dejarían de tener sentido.
        // Es metadata relacional, no contenido de terceros — no hay nada que preservar.
        try {
            const asMember = $app.findRecordsByFilter(
                "organization_members", "user = {:id}", "", 500, 0, { id: record.id }
            ) || [];
            for (let i = 0; i < asMember.length; i++) $app.delete(asMember[i]);
        } catch (err) {}
        try {
            const asOrg = $app.findRecordsByFilter(
                "organization_members", "organization = {:id}", "", 500, 0, { id: record.id }
            ) || [];
            for (let i = 0; i < asOrg.length; i++) $app.delete(asOrg[i]);
        } catch (err) {}
    } catch (err) {
        console.error("[account_deletion.pb.js] Error al eliminar cuenta:", err);
        return e.json(500, { error: "No se pudo eliminar la cuenta. Intenta de nuevo." });
    }

    return e.json(200, { success: true });
}, $apis.requireAuth("users"));
