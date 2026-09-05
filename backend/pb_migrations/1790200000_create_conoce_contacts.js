migrate((app) => {
  // Contacto único por usuario, compartido por todos los "Conoce Beauchef" (Tinder,
  // Mascotas, Música, Películas, Videojuegos, Libros): reemplaza los campos que antes
  // vivían solo en tinder_profiles. El blanqueo por privacidad (solo visible si hay match
  // en alguna de esas categorías) lo hace el hook onRecordEnrich en conoce_contacts.pb.js.
  const contacts = new Collection({
    id: "conoce_contact_01",
    name: "conoce_contacts",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.id = user",
    updateRule: "@request.auth.id != '' && @request.auth.id = user",
    deleteRule: "@request.auth.id != '' && @request.auth.id = user",
    fields: [
      {
        system: false,
        id: "cc_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        system: false,
        id: "cc_u1",
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
      {
        name: "user",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      {
        name: "instagram",
        type: "text",
        required: false,
      },
      {
        name: "whatsapp",
        type: "text",
        required: false,
      },
      {
        name: "telegram",
        type: "text",
        required: false,
      },
      {
        name: "signal",
        type: "text",
        required: false,
      },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_conoce_contact_user ON conoce_contacts (user)"],
  });
  return app.save(contacts);
}, (app) => {
  const contacts = app.findCollectionByNameOrId("conoce_contacts");
  if (contacts) app.delete(contacts);
});
