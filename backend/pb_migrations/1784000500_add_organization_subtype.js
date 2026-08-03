/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const subtypeField = users.fields.getByName("subtype");
  if (subtypeField) {
    subtypeField.values = ["center", "team", "community", "band", "organization"];
    app.save(users);
  }
}, (app) => {
  // Revert
});
