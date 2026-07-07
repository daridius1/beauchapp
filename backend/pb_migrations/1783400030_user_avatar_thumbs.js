migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");
  const avatarField = collection.fields.find(f => f.name === "avatar");
  if (avatarField) {
    avatarField.thumbs = ["100x100", "500x500"];
  }
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("users");
  const avatarField = collection.fields.find(f => f.name === "avatar");
  if (avatarField) {
    avatarField.thumbs = null;
  }
  app.save(collection);
});
