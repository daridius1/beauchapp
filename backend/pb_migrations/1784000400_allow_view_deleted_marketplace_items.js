/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("marketplace_items");
  if (!collection) return;

  // Permitir ver ítems de marketplace soft-eliminados vía getOne para responder a citas
  collection.viewRule = "@request.auth.id != ''";

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("marketplace_items");
  if (!collection) return;

  collection.viewRule = "deleted = false";

  return app.save(collection);
});
