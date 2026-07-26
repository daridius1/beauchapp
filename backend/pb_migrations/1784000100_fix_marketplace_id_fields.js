/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collections = ["seller_profiles", "seller_recommendations", "marketplace_items"];
  for (const name of collections) {
    try {
      const coll = app.findCollectionByNameOrId(name);
      if (coll) {
        const idField = coll.fields.find(f => f.name === "id");
        if (idField) {
          idField.autogeneratePattern = "[a-z0-9]{15}";
        }
        app.save(coll);
      }
    } catch (e) {
      console.error("Error setting autogeneratePattern for " + name, e);
    }
  }
}, (app) => {});
