migrate((app) => {
  const collection = app.findCollectionByNameOrId("posts");
  collection.updateRule = "@request.auth.id != '' && (@request.auth.id = author || ((@request.body.author:isset = false || @request.body.author = author) && (@request.body.content:isset = false || @request.body.content = content) && (@request.body.tags:isset = false || @request.body.tags = tags) && (@request.body.replyTo:isset = false || @request.body.replyTo = replyTo) && (@request.body.root:isset = false || @request.body.root = root) && (@request.body.commentCount:isset = false || @request.body.commentCount = commentCount)))";
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("posts");
  collection.updateRule = "@request.auth.id != '' && (@request.auth.id = author || (@request.body.author:changed = false && @request.body.content:changed = false && @request.body.tags:changed = false && @request.body.photo:changed = false && @request.body.replyTo:changed = false && @request.body.root:changed = false && @request.body.commentCount:changed = false))";
  app.save(collection);
});
