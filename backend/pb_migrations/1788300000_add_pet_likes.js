/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");
  const petsColl = app.findCollectionByNameOrId("pets");

  // 1. like_count en pets (mismo patrón que activities.like_count)
  petsColl.fields.add(new Field({
    name: "like_count",
    type: "number",
    min: 0,
    noDecimal: true,
    required: false,
  }));

  // 2. Aplicar exclusión de usuarios bloqueados a "pets" (contenido de un dueño único,
  // mismo patrón que 1784200100_add_blocking_rules.js Grupo A, campo "user").
  const bothDirections = (field) =>
    `${field}.id != @request.auth.blocked_users_via_blocker.blocked.id && ` +
    `${field}.id != @request.auth.blocked_users_via_blocked.blocker.id`;
  const appendClause = (baseRule, clause) => {
    const trimmed = (baseRule || "").trim();
    return trimmed ? `${trimmed} && ${clause}` : clause;
  };
  const petsClause = bothDirections("user");
  petsColl.listRule = appendClause(petsColl.listRule, petsClause);
  petsColl.viewRule = appendClause(petsColl.viewRule, petsClause);
  app.save(petsColl);

  // 3. Colección pet_likes (mismo patrón que activity_likes)
  const likesColl = new Collection({
    name: "pet_likes",
    type: "base",
    listRule: appendClause("@request.auth.id != ''", bothDirections("user")),
    viewRule: appendClause("@request.auth.id != ''", bothDirections("user")),
    createRule: "@request.auth.id != '' && user = @request.auth.id",
    updateRule: null,
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      { name: "id", type: "text", primaryKey: true, autogeneratePattern: "[a-z0-9]{15}" },
      {
        name: "pet",
        type: "relation",
        required: true,
        collectionId: petsColl.id,
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
    app.db().newQuery("CREATE UNIQUE INDEX `idx_pet_like_user` ON `pet_likes` (`pet`, `user`)").execute();
  } catch (err) {
    console.log("[Migration 1788300000] Warning creating index:", err);
  }
}, (app) => {
  const likesColl = app.findCollectionByNameOrId("pet_likes");
  if (likesColl) app.delete(likesColl);

  const petsColl = app.findCollectionByNameOrId("pets");
  if (petsColl) {
    petsColl.fields.removeByName("like_count");
    app.save(petsColl);
  }
});
