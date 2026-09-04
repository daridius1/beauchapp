/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");

  // Categoría "Series" de "Conoce Beauchef", misma estructura que movie_items/movie_profiles/
  // movie_likes/movie_matches (backend/pb_migrations/1788900000_create_movies_collections.js)
  // — ver ese archivo para el razonamiento completo, acá solo cambian los nombres.

  const bothDirections = (field) =>
    `${field}.id != @request.auth.blocked_users_via_blocker.blocked.id && ` +
    `${field}.id != @request.auth.blocked_users_via_blocked.blocker.id`;
  const appendClause = (baseRule, clause) => {
    const trimmed = (baseRule || "").trim();
    return trimmed ? `${trimmed} && ${clause}` : clause;
  };

  const items = new Collection({
    name: "series_items",
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
      { name: "year", type: "number", min: 0, noDecimal: true, required: false },
      { name: "director", type: "text", required: false },
      { name: "genero", type: "text", required: false },
      {
        name: "image",
        type: "file",
        maxSelect: 1,
        maxSize: 15728640,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        required: false,
      },
      { name: "deleted", type: "bool", required: false },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(items);

  const profiles = new Collection({
    name: "series_profiles",
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
    indexes: ["CREATE UNIQUE INDEX idx_series_profiles_user ON series_profiles (user)"],
  });
  app.save(profiles);

  const likes = new Collection({
    name: "series_likes",
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
    indexes: ["CREATE UNIQUE INDEX idx_series_from_to ON series_likes (fromUser, toUser)"],
  });
  app.save(likes);

  const matches = new Collection({
    name: "series_matches",
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
    indexes: ["CREATE UNIQUE INDEX idx_series_match_users ON series_matches (userA, userB)"],
  });
  app.save(matches);
}, (app) => {
  ["series_matches", "series_likes", "series_profiles", "series_items"].forEach((name) => {
    const coll = app.findCollectionByNameOrId(name);
    if (coll) app.delete(coll);
  });
});
