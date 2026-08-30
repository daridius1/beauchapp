/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");

  // Colección "songs": perfil de canción único por usuario (una por perfil, igual que
  // "pets"), para Comunidad > Conoce Beauchef > Música. El audio se sube ya comprimido
  // desde el cliente (mono, 64kbps) — acá solo se limita el peso como red de seguridad
  // server-side. Mismo patrón polimórfico que pets (targetType = "song") y mismo esquema
  // de likes públicos en colección propia (song_likes, no un array en el registro).
  const songs = new Collection({
    name: "songs",
    type: "base",
    listRule: "@request.auth.id != '' && deleted = false",
    viewRule: "@request.auth.id != ''",
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
      { name: "title", type: "text", required: true },
      { name: "author", type: "text", required: true },
      { name: "year", type: "number", min: 0, noDecimal: true, required: false },
      { name: "description", type: "text", required: false },
      {
        name: "audio",
        type: "file",
        maxSelect: 1,
        // A 64kbps mono (~8KB/s), 6MB cubre una canción de hasta ~12 minutos: de sobra
        // para cualquier canción real. Red de seguridad server-side; la compresión real
        // (mono + 64kbps) ocurre en el cliente antes de subir.
        maxSize: 6291456,
        mimeTypes: ["audio/mpeg", "audio/mp3"],
        required: false,
      },
      { name: "deleted", type: "bool", required: false },
      { name: "like_count", type: "number", min: 0, noDecimal: true, required: false },
      { name: "commentCount", type: "number", min: 0, noDecimal: true, required: false },
      { name: "quoteCount", type: "number", min: 0, noDecimal: true, required: false },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_songs_user ON songs (user)"],
  });
  app.save(songs);

  // Exclusión de usuarios bloqueados, mismo patrón que 1784200100_add_blocking_rules.js
  // (Grupo A, contenido de dueño único) y 1788300000_add_pet_likes.js.
  const bothDirections = (field) =>
    `${field}.id != @request.auth.blocked_users_via_blocker.blocked.id && ` +
    `${field}.id != @request.auth.blocked_users_via_blocked.blocker.id`;
  const appendClause = (baseRule, clause) => {
    const trimmed = (baseRule || "").trim();
    return trimmed ? `${trimmed} && ${clause}` : clause;
  };
  const songsClause = bothDirections("user");
  songs.listRule = appendClause(songs.listRule, songsClause);
  songs.viewRule = appendClause(songs.viewRule, songsClause);
  app.save(songs);

  // Colección song_likes: like público a la canción misma (mismo patrón que pet_likes).
  const likesColl = new Collection({
    name: "song_likes",
    type: "base",
    listRule: appendClause("@request.auth.id != ''", bothDirections("user")),
    viewRule: appendClause("@request.auth.id != ''", bothDirections("user")),
    createRule: "@request.auth.id != '' && user = @request.auth.id",
    updateRule: null,
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      { name: "id", type: "text", primaryKey: true, autogeneratePattern: "[a-z0-9]{15}" },
      {
        name: "song",
        type: "relation",
        required: true,
        collectionId: songs.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: usersColl.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { name: "created", type: "autodate", onCreate: true },
    ],
  });
  app.save(likesColl);

  try {
    app.db().newQuery("CREATE UNIQUE INDEX `idx_song_like_user` ON `song_likes` (`song`, `user`)").execute();
  } catch (err) {
    console.log("[Migration 1788400000] Warning creating index:", err);
  }
}, (app) => {
  const likesColl = app.findCollectionByNameOrId("song_likes");
  if (likesColl) app.delete(likesColl);

  const songs = app.findCollectionByNameOrId("songs");
  if (songs) app.delete(songs);
});
