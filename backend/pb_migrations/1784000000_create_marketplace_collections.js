/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");

  // 1. Colección seller_profiles
  const sellerProfilesColl = new Collection({
    name: "seller_profiles",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "@request.auth.id != \"\"",
    updateRule: "user = @request.auth.id",
    deleteRule: "user = @request.auth.id",
    fields: [
      { name: "id", type: "text", primaryKey: true, autogeneratePattern: "[a-z0-9]{15}" },
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: usersColl.id,
        cascadeDelete: false,
        maxSelect: 1
      },
      { name: "bio", type: "text", required: false },
      { name: "wall_announcement", type: "text", required: false },
      { name: "wsp_phone", type: "text", required: false },
      { name: "instagram_handle", type: "text", required: false },
      { name: "contact_notes", type: "text", required: false },
      { name: "recommendations_count", type: "number", required: false },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ]
  });
  app.save(sellerProfilesColl);

  // 2. Colección seller_recommendations
  const sellerRecsColl = new Collection({
    name: "seller_recommendations",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "@request.auth.id != \"\"",
    updateRule: "user = @request.auth.id",
    deleteRule: "user = @request.auth.id",
    fields: [
      { name: "id", type: "text", primaryKey: true, autogeneratePattern: "[a-z0-9]{15}" },
      {
        name: "seller",
        type: "relation",
        required: true,
        collectionId: sellerProfilesColl.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: usersColl.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ]
  });
  app.save(sellerRecsColl);

  // 3. Colección marketplace_items
  const itemsColl = new Collection({
    name: "marketplace_items",
    type: "base",
    listRule: "deleted = false",
    viewRule: "deleted = false",
    createRule: "@request.auth.id != \"\"",
    updateRule: "user = @request.auth.id",
    deleteRule: "user = @request.auth.id",
    fields: [
      { name: "id", type: "text", primaryKey: true, autogeneratePattern: "[a-z0-9]{15}" },
      {
        name: "seller",
        type: "relation",
        required: true,
        collectionId: sellerProfilesColl.id,
        cascadeDelete: false,
        maxSelect: 1
      },
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: usersColl.id,
        cascadeDelete: false,
        maxSelect: 1
      },
      { name: "title", type: "text", required: true },
      { name: "description", type: "text", required: true },
      { name: "price", type: "number", required: false },
      { name: "category", type: "text", required: true },
      { name: "tags", type: "json", required: false },
      {
        name: "images",
        type: "file",
        required: false,
        maxSelect: 5,
        maxSize: 10485760,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"]
      },
      { name: "status", type: "text", required: true },
      { name: "views_count", type: "number", required: false },
      { name: "deleted", type: "bool", required: false },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ]
  });
  app.save(itemsColl);
}, (app) => {
  try {
    const itemsColl = app.findCollectionByNameOrId("marketplace_items");
    if (itemsColl) app.delete(itemsColl);
  } catch (e) {}

  try {
    const sellerRecsColl = app.findCollectionByNameOrId("seller_recommendations");
    if (sellerRecsColl) app.delete(sellerRecsColl);
  } catch (e) {}

  try {
    const sellerProfilesColl = app.findCollectionByNameOrId("seller_profiles");
    if (sellerProfilesColl) app.delete(sellerProfilesColl);
  } catch (e) {}
});
