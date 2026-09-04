/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");

  // Categoría de referencia para "Conoce Beauchef" con mecánica de like/match tipo Tinder
  // Beauchef (a diferencia de pets/songs, que son un corazón simple sin reciprocidad). Acá
  // el "perfil" no vive en un solo registro con fotos anónimas como tinder_profiles: cada
  // película necesita su propio título/año, así que son dos colecciones separadas
  // (movie_items = hasta 5 filas por usuario, movie_profiles = 1 fila por usuario solo para
  // la descripción). Igual que Tinder Beauchef: sin perfil "activable" — apenas hay 1 ítem
  // subido, ya se es candidato en el descubrimiento de los demás.

  const bothDirections = (field) =>
    `${field}.id != @request.auth.blocked_users_via_blocker.blocked.id && ` +
    `${field}.id != @request.auth.blocked_users_via_blocked.blocker.id`;
  const appendClause = (baseRule, clause) => {
    const trimmed = (baseRule || "").trim();
    return trimmed ? `${trimmed} && ${clause}` : clause;
  };

  // 1. movie_items: hasta 5 películas por usuario (el tope de 5 se refuerza en el hook,
  // acá no hay índice único de "user" porque puede haber varias filas).
  const items = new Collection({
    name: "movie_items",
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
      {
        name: "image",
        type: "file",
        maxSelect: 1,
        maxSize: 15728640, // 15MB, igual que tinder_profiles.photos/pets.photos
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        required: false,
      },
      { name: "deleted", type: "bool", required: false },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(items);

  // 2. movie_profiles: 1 por usuario, solo la descripción del perfil (las películas en sí
  // viven en movie_items). Se crea sola la primera vez que la persona guarda su
  // descripción o su primer ítem, no hace falta "activarla".
  const profiles = new Collection({
    name: "movie_profiles",
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
    indexes: ["CREATE UNIQUE INDEX idx_movie_profiles_user ON movie_profiles (user)"],
  });
  app.save(profiles);

  // 3. movie_likes: calco de tinder_likes (persona a persona, no por película suelta).
  const likes = new Collection({
    name: "movie_likes",
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
    indexes: ["CREATE UNIQUE INDEX idx_movie_from_to ON movie_likes (fromUser, toUser)"],
  });
  app.save(likes);

  // 4. movie_matches: calco de tinder_matches, con status/unmatchedBy ya incluidos desde el
  // inicio (en Tinder se agregaron después, en una migración aparte).
  const matches = new Collection({
    name: "movie_matches",
    type: "base",
    listRule: "@request.auth.id != '' && (@request.auth.id = userA || @request.auth.id = userB)",
    viewRule: "@request.auth.id != '' && (@request.auth.id = userA || @request.auth.id = userB)",
    createRule: null, // Solo lo crea el hook backend
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
    indexes: ["CREATE UNIQUE INDEX idx_movie_match_users ON movie_matches (userA, userB)"],
  });
  app.save(matches);
}, (app) => {
  ["movie_matches", "movie_likes", "movie_profiles", "movie_items"].forEach((name) => {
    const coll = app.findCollectionByNameOrId(name);
    if (coll) app.delete(coll);
  });
});
