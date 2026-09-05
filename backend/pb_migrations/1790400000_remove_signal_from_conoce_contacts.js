/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Se saca Signal de "Tu contacto para matches": casi nadie lo usaba y duplicaba
  // opciones con Telegram/WhatsApp.
  const contacts = app.findCollectionByNameOrId("conoce_contacts");
  contacts.fields.removeByName("signal");
  app.save(contacts);
}, (app) => {
  const contacts = app.findCollectionByNameOrId("conoce_contacts");
  contacts.fields.add(new Field({ name: "signal", type: "text", required: false }));
  app.save(contacts);
});
