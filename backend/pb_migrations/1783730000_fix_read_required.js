migrate((app) => {
  const collection = app.findCollectionByNameOrId("notifications");
  if (collection) {
    const fields = collection.fields || [];
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].name === "read") {
        fields[i].required = false;
        console.log("[Migration] Set required=false for notifications.read");
      }
    }
    return app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("notifications");
  if (collection) {
    const fields = collection.fields || [];
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].name === "read") {
        fields[i].required = true;
      }
    }
    return app.save(collection);
  }
});
