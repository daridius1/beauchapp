/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("tinder_profiles");
    if (collection) {
      const photosField = collection.fields.find(f => f.name === "photos");
      if (photosField) {
        photosField.maxSize = 15728640; // 15MB
        if (photosField.mimeTypes && !photosField.mimeTypes.includes("image/svg+xml")) {
          photosField.mimeTypes.push("image/svg+xml");
        }
      }
      app.save(collection);
    }
  } catch (e) {
    console.log("Migration 1784000500 error:", e);
  }
}, (app) => {});
