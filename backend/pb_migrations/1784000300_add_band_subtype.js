/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (!users) return;
  
  const subtypeField = users.fields.getByName("subtype");
  if (subtypeField) {
    subtypeField.values = ["center", "team", "community", "band"];
    app.save(users);
  }
}, (app) => {
});
