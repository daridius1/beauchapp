migrate((app) => {
  const collection = app.findCollectionByNameOrId("organization_members");
  if (collection) {
    collection.fields.add(new Field({
      name: "role",
      type: "text",
      required: false,
    }));
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("organization_members");
  if (collection) {
    collection.fields.removeByName("role");
    app.save(collection);
  }
});
