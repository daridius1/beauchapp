/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  users.fields.add(new Field({
    name: "deleted",
    type: "bool",
    required: false,
    presentable: false,
  }));
  users.fields.add(new Field({
    name: "deletedAt",
    type: "date",
    required: false,
  }));
  // Hash SHA-256 del correo original, calculado ANTES de vaciar el campo "email" al
  // eliminar la cuenta. No se guarda el correo en texto plano en ningún lado: este hash
  // solo sirve para el cooldown de 7 días de /register (ver lib/accountDeletion.js).
  users.fields.add(new Field({
    name: "deletedEmailHash",
    type: "text",
    required: false,
    presentable: false,
  }));

  // Bloquea el hard-delete real por API (mismo patrón que posts/problems/marketplace_items):
  // eliminar una cuenta hoy dispararía cascadas reales de PocketBase sobre partidos,
  // apuestas y notificaciones de terceros. Toda eliminación pasa por /api/account/delete
  // o el panel de admin, que anonimizan la fila en vez de borrarla.
  users.deleteRule = null;

  // Anexado con && sobre la regla existente (SECURITY_AND_MAINTENANCE.md §1): una cuenta
  // ya eliminada no puede seguir editándose por la vía normal. "deleted = false" (no
  // "!= true") sigue la misma convención que ya usa posts.updateRule.
  users.updateRule = "id = @request.auth.id && deleted = false";

  // Anexado con && sobre el authRule existente: una cuenta eliminada no puede volver a
  // autenticarse aunque alguien conserve un token válido (que además se invalida aparte
  // con record.refreshTokenKey() al momento de eliminar).
  users.authRule = "verified = true && deleted = false";

  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");

  users.fields.removeByName("deleted");
  users.fields.removeByName("deletedAt");
  users.fields.removeByName("deletedEmailHash");

  users.deleteRule = "id = @request.auth.id";
  users.updateRule = "id = @request.auth.id";
  users.authRule = "verified = true";

  app.save(users);
});
