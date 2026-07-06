migrate((app) => {
  const collection = app.findCollectionByNameOrId("communities");

  collection.fields.add(new Field({
    system: false,
    id: "autodate_c1",
    name: "created",
    type: "autodate",
    onCreate: true,
    onUpdate: false,
    presentable: false,
  }));

  collection.fields.add(new Field({
    system: false,
    id: "autodate_u1",
    name: "updated",
    type: "autodate",
    onCreate: true,
    onUpdate: true,
    presentable: false,
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("communities");
  collection.fields.removeByName("created");
  collection.fields.removeByName("updated");
  return app.save(collection);
});
