migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  
  usersCol.fields.add(new Field({
    name: "type",
    type: "select",
    values: ["student", "organization"],
    maxSelect: 1,
    required: false,
  }));

  return app.save(usersCol);
}, (app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.fields.removeByName("type");
  return app.save(usersCol);
});
