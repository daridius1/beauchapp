/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("problems");

  // Add deleted field (boolean, defaults to false)
  collection.fields.add(new Field({
    name: "deleted",
    type: "bool",
    required: false,
  }));

  // Update API rules to protect deleted problems
  collection.listRule = "@request.auth.id != '' && (deleted = false || @request.auth.id = author)";
  collection.viewRule = "@request.auth.id != '' && (deleted = false || @request.auth.id = author)";
  collection.updateRule = "deleted = false && @request.auth.id != '' && @request.auth.id = author";

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("problems");
  collection.fields.removeByName("deleted");
  collection.listRule = "@request.auth.id != ''";
  collection.viewRule = "@request.auth.id != ''";
  collection.updateRule = "@request.auth.id != '' && @request.auth.id = author";
  return app.save(collection);
});
