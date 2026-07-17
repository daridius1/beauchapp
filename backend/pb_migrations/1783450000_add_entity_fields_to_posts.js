/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("posts");

  // entityType: nombre de la colección enlazada (ej. "problems", "activities")
  collection.fields.add(new Field({
    name: "entityType",
    type: "text",
    required: false,
  }));

  // entityId: ID del registro enlazado
  collection.fields.add(new Field({
    name: "entityId",
    type: "text",
    required: false,
  }));

  // entityMeta: datos desnormalizados para renderizar la carta sin queries extra
  collection.fields.add(new Field({
    name: "entityMeta",
    type: "json",
    required: false,
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("posts");
  collection.fields.removeByName("entityType");
  collection.fields.removeByName("entityId");
  collection.fields.removeByName("entityMeta");
  return app.save(collection);
});
