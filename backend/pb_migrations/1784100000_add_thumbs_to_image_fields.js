/// <reference path="../pb_data/types.d.ts" />

// Habilita generación de thumbnails (lazy, vía ?thumb=) para los campos de
// imagen que hoy solo sirven el archivo original completo. Mismo patrón que
// 1783400030_user_avatar_thumbs.js (que ya hizo esto para users.avatar).
migrate((app) => {
  const targets = [
    { collection: "posts", field: "photo", thumbs: ["400x0", "800x0"] },
    { collection: "marketplace_items", field: "images", thumbs: ["300x300", "800x0"] },
    { collection: "activities", field: "banner", thumbs: ["400x0", "800x0"] },
    { collection: "tinder_profiles", field: "photos", thumbs: ["400x0", "800x0"] },
  ];

  for (const { collection, field, thumbs } of targets) {
    const coll = app.findCollectionByNameOrId(collection);
    const imgField = coll.fields.find((f) => f.name === field);
    if (imgField) {
      imgField.thumbs = thumbs;
      app.save(coll);
    }
  }
}, (app) => {
  const targets = [
    { collection: "posts", field: "photo" },
    { collection: "marketplace_items", field: "images" },
    { collection: "activities", field: "banner" },
    { collection: "tinder_profiles", field: "photos" },
  ];

  for (const { collection, field } of targets) {
    const coll = app.findCollectionByNameOrId(collection);
    const imgField = coll.fields.find((f) => f.name === field);
    if (imgField) {
      imgField.thumbs = null;
      app.save(coll);
    }
  }
});
