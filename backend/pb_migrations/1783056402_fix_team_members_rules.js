migrate((app) => {
  const collection = app.findCollectionByNameOrId("team_members");
  if (collection) {
    collection.createRule = "@request.auth.id != ''";
    collection.updateRule = "@request.auth.id != ''";
    collection.deleteRule = "@request.auth.id != ''";
    app.save(collection);
  }
}, (app) => {
  // rollback
});
