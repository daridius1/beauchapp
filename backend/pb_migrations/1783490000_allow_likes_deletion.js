migrate((app) => {
  const collection = app.findCollectionByNameOrId("tinder_likes");
  if (collection) {
    collection.deleteRule = "@request.auth.id != '' && @request.auth.id = fromUser";
    return app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("tinder_likes");
  if (collection) {
    collection.deleteRule = null;
    return app.save(collection);
  }
});
