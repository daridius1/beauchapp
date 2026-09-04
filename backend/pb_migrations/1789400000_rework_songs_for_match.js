/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");
  const songs = app.findCollectionByNameOrId("songs");

  // 1. Música pasa de "una canción por usuario" a hasta 5 (mismo tope reforzado en el hook
  // que movie_items) — hay que sacar el índice único de "user" para permitir varias filas.
  songs.indexes = [];

  // 2. Carátula por canción, mismas restricciones que la imagen de movie_items.
  if (!songs.fields.find((f) => f.name === "cover")) {
    songs.fields.add(new Field({
      name: "cover",
      type: "file",
      maxSelect: 1,
      maxSize: 15728640,
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      required: false,
    }));
  }

  // El campo "description" existente NO se toca: sigue existiendo por compatibilidad con
  // las citas del foro ya publicadas (target_meta.pb.js / enrich_targets.pb.js leen
  // songs.description directo). La pantalla nueva ya no lo edita por canción — la
  // descripción del perfil musical ahora vive en song_profiles (ver más abajo).
  app.save(songs);

  const bothDirections = (field) =>
    `${field}.id != @request.auth.blocked_users_via_blocker.blocked.id && ` +
    `${field}.id != @request.auth.blocked_users_via_blocked.blocker.id`;
  const appendClause = (baseRule, clause) => {
    const trimmed = (baseRule || "").trim();
    return trimmed ? `${trimmed} && ${clause}` : clause;
  };

  // 3. song_profiles: 1 por usuario, solo la descripción del perfil musical — mismo patrón
  // que movie_profiles.
  const profiles = new Collection({
    name: "song_profiles",
    type: "base",
    listRule: appendClause("@request.auth.id != ''", bothDirections("user")),
    viewRule: appendClause("@request.auth.id != ''", bothDirections("user")),
    createRule: "@request.auth.id != '' && @request.auth.id = user",
    updateRule: "@request.auth.id != '' && @request.auth.id = user",
    deleteRule: "@request.auth.id != '' && @request.auth.id = user",
    fields: [
      { name: "id", type: "text", primaryKey: true, autogeneratePattern: "[a-z0-9]{15}" },
      {
        name: "user",
        type: "relation",
        collectionId: usersColl.id,
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      { name: "description", type: "text", required: false },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_song_profiles_user ON song_profiles (user)"],
  });
  app.save(profiles);

  // 4. song_likes pasa de "like simple a una canción" (song + user, sin reciprocidad) a
  // like persona-a-persona con match, igual que movie_likes — se borra el viejo y se crea
  // de nuevo con la forma nueva (se pierden los corazones sueltos existentes, a propósito:
  // son un concepto distinto del match nuevo, no hay una migración 1:1 sensata entre
  // ambos).
  const oldLikes = app.findCollectionByNameOrId("song_likes");
  if (oldLikes) app.delete(oldLikes);

  const likes = new Collection({
    name: "song_likes",
    type: "base",
    listRule: "@request.auth.id != '' && @request.auth.id = fromUser",
    viewRule: "@request.auth.id != '' && @request.auth.id = fromUser",
    createRule: "@request.auth.id != '' && @request.auth.id = fromUser && fromUser != toUser",
    updateRule: null,
    deleteRule: "@request.auth.id != '' && @request.auth.id = fromUser",
    fields: [
      { name: "id", type: "text", primaryKey: true, autogeneratePattern: "[a-z0-9]{15}" },
      {
        name: "fromUser",
        type: "relation",
        collectionId: usersColl.id,
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      {
        name: "toUser",
        type: "relation",
        collectionId: usersColl.id,
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      { name: "liked", type: "bool", required: true, default: true },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_song_from_to ON song_likes (fromUser, toUser)"],
  });
  app.save(likes);

  // 5. song_matches, igual que movie_matches.
  const matches = new Collection({
    name: "song_matches",
    type: "base",
    listRule: "@request.auth.id != '' && (@request.auth.id = userA || @request.auth.id = userB)",
    viewRule: "@request.auth.id != '' && (@request.auth.id = userA || @request.auth.id = userB)",
    createRule: null,
    updateRule: "@request.auth.id != '' && (@request.auth.id = userA || @request.auth.id = userB)",
    deleteRule: "@request.auth.id != '' && (@request.auth.id = userA || @request.auth.id = userB)",
    fields: [
      { name: "id", type: "text", primaryKey: true, autogeneratePattern: "[a-z0-9]{15}" },
      {
        name: "userA",
        type: "relation",
        collectionId: usersColl.id,
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      {
        name: "userB",
        type: "relation",
        collectionId: usersColl.id,
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      { name: "status", type: "text", required: false },
      {
        name: "unmatchedBy",
        type: "relation",
        collectionId: usersColl.id,
        cascadeDelete: false,
        maxSelect: 1,
        required: false,
      },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_song_match_users ON song_matches (userA, userB)"],
  });
  app.save(matches);
}, (app) => {
  ["song_matches", "song_profiles"].forEach((name) => {
    const coll = app.findCollectionByNameOrId(name);
    if (coll) app.delete(coll);
  });

  // No se revierte song_likes a su forma vieja (song+user) ni se restaura el índice único
  // de songs.user — la reversión completa de este cambio de esquema no es reconstruible sin
  // los datos originales, igual que el resto de las migraciones de este proyecto que
  // reshapean colecciones existentes.
});
