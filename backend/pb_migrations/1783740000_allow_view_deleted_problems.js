/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("problems");

  // Allow all authenticated users to list and view all problems, including soft-deleted ones
  collection.listRule = "@request.auth.id != ''";
  collection.viewRule = "@request.auth.id != ''";

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("problems");

  // Revert to restricting views of deleted problems to their authors
  collection.listRule = "@request.auth.id != '' && (deleted = false || @request.auth.id = author)";
  collection.viewRule = "@request.auth.id != '' && (deleted = false || @request.auth.id = author)";

  return app.save(collection);
});
