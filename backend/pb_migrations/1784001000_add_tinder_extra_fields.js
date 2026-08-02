/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  try {
    // 1. Agregar website y description a 'users'
    const usersColl = app.findCollectionByNameOrId("users");
    if (usersColl) {
      if (!usersColl.fields.find(existing => existing.name === "website")) {
        usersColl.fields.add(new Field({
          name: "website",
          type: "text",
          required: false,
        }));
      }
      if (!usersColl.fields.find(existing => existing.name === "description")) {
        usersColl.fields.add(new Field({
          name: "description",
          type: "text",
          required: false,
        }));
      }
      app.save(usersColl);
    }

    // 2. Agregar campos opcionales a 'tinder_profiles'
    const tinderColl = app.findCollectionByNameOrId("tinder_profiles");
    if (tinderColl) {
      const extraFields = [
        { name: "favorite_song", type: "text", required: false },
        { name: "favorite_book", type: "text", required: false },
        { name: "zodiac_sign", type: "text", required: false },
        { name: "favorite_drink", type: "text", required: false },
        { name: "favorite_food", type: "text", required: false },
        { name: "favorite_subject", type: "text", required: false },
        { name: "hobbies", type: "text", required: false },
        { name: "website", type: "text", required: false },
      ];

      extraFields.forEach(f => {
        if (!tinderColl.fields.find(existing => existing.name === f.name)) {
          tinderColl.fields.add(new Field(f));
        }
      });

      app.save(tinderColl);
    }
  } catch (err) {
    console.log("[Migration 1784001000] Error:", err);
  }
}, (app) => {});
