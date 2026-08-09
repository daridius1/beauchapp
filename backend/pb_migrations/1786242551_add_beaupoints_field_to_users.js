/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    if (!users.fields.getByName("beaupoints")) {
      // required:false a propósito: un usuario puede legítimamente llegar a 0
      // BeauPoints tras perder una apuesta, y un number required en 0 falla
      // "cannot be blank" en este runtime (mismo motivo que karma/recommendations_count).
      users.fields.add(new Field({ name: "beaupoints", type: "number", required: false, min: 0, noDecimal: true }));
    }
    app.save(users);
  }
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    const f = users.fields.getByName("beaupoints");
    if (f) {
      users.fields.removeById(f.id);
      app.save(users);
    }
  }
});
