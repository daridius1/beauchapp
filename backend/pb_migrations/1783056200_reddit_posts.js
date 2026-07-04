migrate((app) => {
  const collection = app.findCollectionByNameOrId("posts");
  
  collection.fields.add(new Field({
    name: "root",
    type: "relation",
    collectionId: "h20ayxjzl2sl1iz",
    cascadeDelete: false,
    maxSelect: 1,
  }));

  collection.fields.add(new Field({
    name: "commentCount",
    type: "number",
    min: 0,
    noDecimal: true
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("posts");
  collection.fields.removeByName("root");
  collection.fields.removeByName("commentCount");
  return app.save(collection);
});
