/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Colección "pets": perfil único de mascota por usuario, para la sección
  // Comunidad > Conoce Beauchef > Mascotas. Mismo patrón que tinder_profiles
  // (un registro por usuario, fotos en campo file nativo -> R2) más
  // commentCount/quoteCount para participar del sistema polimórfico de posts
  // (targetType = "pet"), igual que problems/courses/activities/beaumarkets.
  const pets = new Collection({
    id: "pets_coll_01",
    name: "pets",
    type: "base",
    listRule: "@request.auth.id != '' && deleted = false",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.id = user",
    updateRule: "@request.auth.id != '' && @request.auth.id = user",
    deleteRule: "@request.auth.id != '' && @request.auth.id = user",
    fields: [
      {
        system: false,
        id: "pet_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        system: false,
        id: "pet_u1",
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
      {
        name: "user",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      {
        name: "name",
        type: "text",
        required: true,
      },
      {
        name: "description",
        type: "text",
        required: false,
      },
      {
        name: "photos",
        type: "file",
        maxSelect: 5,
        maxSize: 15728640, // 15MB, igual que tinder_profiles.photos
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        required: false,
      },
      {
        name: "deleted",
        type: "bool",
        required: false,
      },
      {
        name: "commentCount",
        type: "number",
        min: 0,
        noDecimal: true,
        required: false,
      },
      {
        name: "quoteCount",
        type: "number",
        min: 0,
        noDecimal: true,
        required: false,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_pets_user ON pets (user)"
    ]
  });

  app.save(pets);
}, (app) => {
  const pets = app.findCollectionByNameOrId("pets");
  if (pets) app.delete(pets);
});
