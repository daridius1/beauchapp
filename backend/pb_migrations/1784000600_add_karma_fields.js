/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    if (!users.fields.getByName("karma")) {
      users.fields.add(new Field({
        name: "karma",
        type: "number",
        required: false,
      }));
    }
    if (!users.fields.getByName("show_karma_on_profile")) {
      users.fields.add(new Field({
        name: "show_karma_on_profile",
        type: "bool",
        required: false,
      }));
    }
    app.save(users);
  }
}, (app) => {
  // Revert
});
