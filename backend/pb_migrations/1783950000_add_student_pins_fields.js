migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.fields.add(new Field({
      name: "entry_year",
      type: "text",
      required: false,
    }));
    users.fields.add(new Field({
      name: "department",
      type: "text",
      required: false,
    }));
    app.save(users);
  }
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.fields.removeByName("entry_year");
    users.fields.removeByName("department");
    app.save(users);
  }
});
