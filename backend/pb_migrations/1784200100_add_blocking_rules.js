/// <reference path="../pb_data/types.d.ts" />

// Aplica la exclusión de usuarios bloqueados a nivel de regla de colección
// (no filtrado en cliente, no recómputo en hook) en cada colección con
// contenido/señales/relaciones ligadas a un usuario. Ver PRINCIPLES.md.
//
// PocketBase soporta traversal de relación inversa vía "<coleccion>_via_<campo>"
// en expresiones de regla (confirmado en backend/pb_data/types.d.ts) y también
// vía spike manual contra una copia aislada: una sola cláusula cubre ambas
// direcciones del bloqueo (yo lo bloqueé / me bloqueó) sin consulta extra
// desde el cliente.
migrate((app) => {
  const bothDirections = (field) =>
    `${field}.id != @request.auth.blocked_users_via_blocker.blocked.id && ` +
    `${field}.id != @request.auth.blocked_users_via_blocked.blocker.id`;

  const appendClause = (baseRule, clause) => {
    const trimmed = (baseRule || "").trim();
    return trimmed ? `${trimmed} && ${clause}` : clause;
  };

  // Grupo A: contenido con autor/dueño único (se oculta completo)
  // Grupo B: señales sobre contenido de otros (se oculta la fila, el
  //          contador incremental en el registro relacionado no se toca)
  // Grupo D: notificaciones (por remitente)
  // Grupo E (parcial): ladder_ranks
  const singleFieldTargets = [
    { collection: "posts", field: "author" },
    { collection: "problems", field: "author" },
    { collection: "marketplace_items", field: "user" },
    { collection: "seller_profiles", field: "user" },
    { collection: "tinder_profiles", field: "user" },
    { collection: "activities", field: "organization" },
    { collection: "attachments", field: "author" },
    { collection: "activity_likes", field: "user" },
    { collection: "activity_attendees", field: "user" },
    { collection: "seller_recommendations", field: "user" },
    { collection: "problem_ratings", field: "user" },
    { collection: "notifications", field: "sender" },
    { collection: "ladder_ranks", field: "user" },
  ];

  for (const { collection, field } of singleFieldTargets) {
    const coll = app.findCollectionByNameOrId(collection);
    const clause = bothDirections(field);
    coll.listRule = appendClause(coll.listRule, clause);
    coll.viewRule = appendClause(coll.viewRule, clause);
    app.save(coll);
  }

  // La propia colección "users": se filtra por el id del registro, no por
  // una relación — así un bloqueado desaparece de directorio/búsqueda/
  // autocomplete y no se puede visitar por getOne directo.
  const usersColl = app.findCollectionByNameOrId("users");
  const usersClause =
    "id != @request.auth.blocked_users_via_blocker.blocked.id && " +
    "id != @request.auth.blocked_users_via_blocked.blocker.id";
  usersColl.listRule = appendClause(usersColl.listRule, usersClause);
  usersColl.viewRule = appendClause(usersColl.viewRule, usersClause);
  app.save(usersColl);

  // Grupo C: relaciones entre 2 usuarios — hay que excluir si CUALQUIERA
  // de los campos de la relación es alguien bloqueado (en cualquier
  // dirección), no solo el que coincide con @request.auth.
  const twoFieldTargets = [
    { collection: "follows", fields: ["follower", "following"] },
    { collection: "tinder_likes", fields: ["fromUser", "toUser"] },
    { collection: "tinder_matches", fields: ["userA", "userB"] },
    { collection: "organization_members", fields: ["user"] },
  ];

  for (const { collection, fields } of twoFieldTargets) {
    const coll = app.findCollectionByNameOrId(collection);
    const clause = fields.map(bothDirections).join(" && ");
    coll.listRule = appendClause(coll.listRule, clause);
    coll.viewRule = appendClause(coll.viewRule, clause);
    app.save(coll);
  }

  // Grupo E: ladder_matches — 2 equipos multi-relación (hasta 2 c/u) + árbitro.
  // El rating OpenSkill ya aplicado no se toca (decisión explícita), solo se
  // oculta el registro del historial cuando participa alguien bloqueado.
  const ladderMatches = app.findCollectionByNameOrId("ladder_matches");
  const ladderClause = ["team_red", "team_blue", "arbiter"].map(bothDirections).join(" && ");
  ladderMatches.listRule = appendClause(ladderMatches.listRule, ladderClause);
  ladderMatches.viewRule = appendClause(ladderMatches.viewRule, ladderClause);
  app.save(ladderMatches);

  // createRule: impedir NUEVAS relaciones hacia/desde alguien bloqueado
  // (belt-and-suspenders — el flujo normal de la UI ya no permite verlos
  // para poder seguirlos/likearlos, pero esto cierra el bypass por API directa).
  const follows = app.findCollectionByNameOrId("follows");
  follows.createRule = appendClause(follows.createRule, bothDirections("following"));
  app.save(follows);

  const tinderLikes = app.findCollectionByNameOrId("tinder_likes");
  tinderLikes.createRule = appendClause(tinderLikes.createRule, bothDirections("toUser"));
  app.save(tinderLikes);
}, (app) => {
  // Down migration intencionalmente no-op: revertir 19 reglas a su string
  // exacto anterior es más riesgoso que dejarlas (pueden haber cambiado desde
  // que se escribió esta migración). Revertir el feature completo implica
  // también revertir 1784200000_create_blocked_users.js.
});
