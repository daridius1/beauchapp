migrate((app) => {
  const collection = app.findCollectionByNameOrId("posts");
  collection.updateRule = "@request.auth.id != ''";
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("posts");
  collection.updateRule = "@request.auth.id = author";
  app.save(collection);
});
