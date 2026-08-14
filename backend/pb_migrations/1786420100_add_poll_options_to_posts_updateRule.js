/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("posts");

  // Extiende la lista de campos "congelados" para no-autores (ver
  // 1783400050_restore_posts_updateRule.js) agregando pollOptions — así ningún usuario
  // que no sea el autor puede alterar la encuesta de un post ajeno.
  collection.updateRule = "deleted = false && @request.auth.id != '' && (@request.auth.id = author || ((@request.body.author:isset = false || @request.body.author = author) && (@request.body.content:isset = false || @request.body.content = content) && (@request.body.tags:isset = false || @request.body.tags = tags) && (@request.body.replyTo:isset = false || @request.body.replyTo = replyTo) && (@request.body.root:isset = false || @request.body.root = root) && (@request.body.commentCount:isset = false || @request.body.commentCount = commentCount) && (@request.body.pollOptions:isset = false || @request.body.pollOptions = pollOptions)))";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("posts");

  collection.updateRule = "deleted = false && @request.auth.id != '' && (@request.auth.id = author || ((@request.body.author:isset = false || @request.body.author = author) && (@request.body.content:isset = false || @request.body.content = content) && (@request.body.tags:isset = false || @request.body.tags = tags) && (@request.body.replyTo:isset = false || @request.body.replyTo = replyTo) && (@request.body.root:isset = false || @request.body.root = root) && (@request.body.commentCount:isset = false || @request.body.commentCount = commentCount)))";

  app.save(collection);
});
