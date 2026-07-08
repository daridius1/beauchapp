/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("posts");
  
  // Agregar campo booleano 'deleted'
  collection.fields.add(new Field({
    name: "deleted",
    type: "bool",
    required: false,
    presentable: false,
  }));

  // Impedir eliminación permanente por API
  collection.deleteRule = null;

  // Modificar updateRule para evitar cambios si ya está eliminado
  collection.updateRule = "@request.auth.id = author && deleted = false";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("posts");
  
  // Revertir campo y reglas
  collection.fields.removeByName("deleted");
  collection.deleteRule = "@request.auth.id = author";
  collection.updateRule = "@request.auth.id = author";

  app.save(collection);
});
