/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Eliminar colección org_registration_links si existe (del plan anterior)
  const orgRegLinks = app.findCollectionByNameOrId("org_registration_links");
  if (orgRegLinks) {
    app.delete(orgRegLinks);
  }

  // 2. Modificar users
  const users = app.findCollectionByNameOrId("users");
  
  // Agregar registrationToken
  users.fields.add(new Field({
    name: "registrationToken",
    type: "text",
    required: false,
  }));

  // Agregar tokenExpiresAt
  users.fields.add(new Field({
    name: "tokenExpiresAt",
    type: "date",
    required: false,
  }));

  // Actualizar API Rules de list y view
  users.listRule = "@request.auth.id != '' && verified = true";
  users.viewRule = "@request.auth.id != '' && verified = true";

  app.save(users);
}, (app) => {
  // Down migration no-op
});
