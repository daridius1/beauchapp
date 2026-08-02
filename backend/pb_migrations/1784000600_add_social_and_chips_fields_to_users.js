/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  try {
    // 1. Agregar campos de redes sociales a 'users'
    const usersColl = app.findCollectionByNameOrId("users");
    if (usersColl) {
      const socialFields = [
        { name: "instagram", type: "text", required: false },
        { name: "telegram", type: "text", required: false },
        { name: "whatsapp", type: "text", required: false },
        { name: "signal", type: "text", required: false }
      ];

      socialFields.forEach(f => {
        if (!usersColl.fields.find(existing => existing.name === f.name)) {
          usersColl.fields.add(new Field(f));
        }
      });

      app.save(usersColl);
    }

    // 2. Agregar campo 'show_on_profile' a 'ladder_ranks'
    const ranksColl = app.findCollectionByNameOrId("ladder_ranks");
    if (ranksColl) {
      if (!ranksColl.fields.find(existing => existing.name === "show_on_profile")) {
        ranksColl.fields.add(new Field({
          name: "show_on_profile",
          type: "bool",
          required: false,
          default: false
        }));
        app.save(ranksColl);
      }
    }
  } catch (err) {
    console.log("[Migration 1784000600] Error:", err);
  }
}, (app) => {});
