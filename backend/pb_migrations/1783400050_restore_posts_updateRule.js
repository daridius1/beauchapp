/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("posts");
  
  // Restaurar la regla que permitía dar likes (y otros campos permitidos) a no-autores, 
  // pero manteniendo la protección de deleted = false
  collection.updateRule = "deleted = false && @request.auth.id != '' && (@request.auth.id = author || ((@request.body.author:isset = false || @request.body.author = author) && (@request.body.content:isset = false || @request.body.content = content) && (@request.body.tags:isset = false || @request.body.tags = tags) && (@request.body.replyTo:isset = false || @request.body.replyTo = replyTo) && (@request.body.root:isset = false || @request.body.root = root) && (@request.body.commentCount:isset = false || @request.body.commentCount = commentCount)))";
  
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("posts");
  
  // Revertir a la versión rota (solo autor puede actualizar)
  collection.updateRule = "@request.auth.id = author && deleted = false";
  
  app.save(collection);
});
