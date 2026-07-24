migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.fields.add(new Field({
      name: "chip_text",
      type: "text",
      required: false,
    }));
    users.fields.add(new Field({
      name: "chip_color",
      type: "text",
      required: false,
    }));
    app.save(users);
  }
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.fields.removeByName("chip_text");
    users.fields.removeByName("chip_color");
    app.save(users);
  }
});
