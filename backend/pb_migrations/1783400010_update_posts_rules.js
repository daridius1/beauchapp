migrate((app) => {
  const collection = app.findCollectionByNameOrId("posts");
  collection.updateRule = "@request.auth.id != '' && (@request.auth.id = author || (@request.body.author:changed = false && @request.body.content:changed = false && @request.body.tags:changed = false && @request.body.photo:changed = false && @request.body.replyTo:changed = false && @request.body.root:changed = false && @request.body.commentCount:changed = false))";
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("posts");
  collection.updateRule = "@request.auth.id = author";
  app.save(collection);
});
