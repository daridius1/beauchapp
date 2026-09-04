/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");

  // Libros: misma estructura que Películas/Videojuegos (like/match tipo Tinder Beauchef,
  // hasta 5 ítems por usuario en su propia colección + una colección aparte solo para la
  // descripción del perfil). A diferencia de esas dos, nace directo con elección por
  // búsqueda (Open Library, gratis y sin API key — a diferencia de Spotify/TMDB/IGDB) en
  // vez de subida manual: no hace falta un campo "image" de archivo ni director/genero,
  // solo lo que devuelve la búsqueda.
  const bothDirections = (field) =>
    `${field}.id != @request.auth.blocked_users_via_blocker.blocked.id && ` +
    `${field}.id != @request.auth.blocked_users_via_blocked.blocker.id`;
  const appendClause = (baseRule, clause) => {
    const trimmed = (baseRule || "").trim();
    return trimmed ? `${trimmed} && ${clause}` : clause;
  };

  // 1. book_items: hasta 5 libros por usuario (tope reforzado en el hook).
  const items = new Collection({
    name: "book_items",
    type: "base",
    listRule: appendClause("@request.auth.id != '' && deleted = false", bothDirections("user")),
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
      { name: "title", type: "text", required: true },
      { name: "author", type: "text", required: false },
      { name: "year", type: "number", min: 0, noDecimal: true, required: false },
      { name: "openLibraryId", type: "text", required: false },
      { name: "coverUrl", type: "text", required: false },
      { name: "deleted", type: "bool", required: false },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(items);

  // 2. book_profiles: 1 por usuario, solo la descripción.
  const profiles = new Collection({
    name: "book_profiles",
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
    indexes: ["CREATE UNIQUE INDEX idx_book_profiles_user ON book_profiles (user)"],
  });
  app.save(profiles);

  // 3. book_likes: persona a persona, calco de movie_likes.
  const likes = new Collection({
    name: "book_likes",
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
    indexes: ["CREATE UNIQUE INDEX idx_book_from_to ON book_likes (fromUser, toUser)"],
  });
  app.save(likes);

  // 4. book_matches: calco de movie_matches.
  const matches = new Collection({
    name: "book_matches",
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
    indexes: ["CREATE UNIQUE INDEX idx_book_match_users ON book_matches (userA, userB)"],
  });
  app.save(matches);
}, (app) => {
  ["book_matches", "book_likes", "book_profiles", "book_items"].forEach((name) => {
    const coll = app.findCollectionByNameOrId(name);
    if (coll) app.delete(coll);
  });
});
