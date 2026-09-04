/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");
  const pets = app.findCollectionByNameOrId("pets");

  // Mascotas pasa de "una mascota por usuario" a hasta 5 (mismo tope reforzado en el hook
  // que movie_items/songs) — cada mascota sigue con sus propias 5 fotos, eso no cambia.
  pets.indexes = [];
  app.save(pets);

  // pet_likes pasa de "like simple a una mascota" (pet + user, sin reciprocidad) a like
  // persona-a-persona con match, igual que movie_likes/song_likes — se borra el viejo y se
  // crea de nuevo con la forma nueva (se pierden los corazones sueltos existentes, a
  // propósito: son un concepto distinto del match nuevo).
  const oldLikes = app.findCollectionByNameOrId("pet_likes");
  if (oldLikes) app.delete(oldLikes);

  const likes = new Collection({
    name: "pet_likes",
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
    indexes: ["CREATE UNIQUE INDEX idx_pet_from_to ON pet_likes (fromUser, toUser)"],
  });
  app.save(likes);

  const matches = new Collection({
    name: "pet_matches",
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
    indexes: ["CREATE UNIQUE INDEX idx_pet_match_users ON pet_matches (userA, userB)"],
  });
  app.save(matches);
}, (app) => {
  const matches = app.findCollectionByNameOrId("pet_matches");
  if (matches) app.delete(matches);
  // No se revierte pet_likes a su forma vieja (pet+user) ni se restaura el índice único de
  // pets.user, mismo motivo que 1789400000_rework_songs_for_match.js.
});
