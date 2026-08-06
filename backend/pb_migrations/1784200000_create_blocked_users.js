/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");

  const collection = new Collection({
    name: "blocked_users",
    type: "base",
    listRule: "@request.auth.id = blocker",
    viewRule: "@request.auth.id = blocker",
    createRule: "@request.auth.id != '' && @request.auth.id = blocker && blocker != blocked",
    updateRule: null,
    deleteRule: "@request.auth.id = blocker",
    fields: [
      { name: "id", type: "text", primaryKey: true, autogeneratePattern: "[a-z0-9]{15}" },
      {
        name: "blocker",
        type: "relation",
        required: true,
        collectionId: usersColl.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      {
        name: "blocked",
        type: "relation",
        required: true,
        collectionId: usersColl.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      // Snapshot del nombre/username del bloqueado al momento de bloquear (poblado
      // por blocking.pb.js). No se puede usar expand:'blocked' para esto: una vez
      // creado el bloqueo, users.viewRule ya excluye a esa persona para este mismo
      // usuario, así que el expand vendría vacío — se necesita el dato aparte para
      // poder mostrar/desbloquear desde "Usuarios bloqueados" en Configuración.
      { name: "blocked_name", type: "text", required: false },
      { name: "blocked_username", type: "text", required: false },
      { name: "created", type: "autodate", onCreate: true }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_blocker_blocked ON blocked_users (blocker, blocked)"
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("blocked_users");
  if (collection) {
    return app.delete(collection);
  }
});
