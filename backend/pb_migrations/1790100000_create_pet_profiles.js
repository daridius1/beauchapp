/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");

  // Mascotas nació sin colección de perfil aparte porque cada mascota ya trae su propio
  // nombre y descripción (ver 1789500000_rework_pets_for_match.js). Ahora se agrega
  // también una descripción a nivel de PERFIL (qué tipo de mascotas te gustan, no de una
  // mascota puntual) — mismo patrón que movie_profiles/song_profiles/book_profiles.
  const bothDirections = (field) =>
    `${field}.id != @request.auth.blocked_users_via_blocker.blocked.id && ` +
    `${field}.id != @request.auth.blocked_users_via_blocked.blocker.id`;
  const appendClause = (baseRule, clause) => {
    const trimmed = (baseRule || "").trim();
    return trimmed ? `${trimmed} && ${clause}` : clause;
  };

  const profiles = new Collection({
    name: "pet_profiles",
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
    indexes: ["CREATE UNIQUE INDEX idx_pet_profiles_user ON pet_profiles (user)"],
  });
  app.save(profiles);
}, (app) => {
  const coll = app.findCollectionByNameOrId("pet_profiles");
  if (coll) app.delete(coll);
});
