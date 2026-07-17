migrate((app) => {
  const collection = new Collection({
    id: "notifics_001",
    name: "notifications",
    type: "base",
    listRule: "@request.auth.id != '' && user = @request.auth.id",
    viewRule: "@request.auth.id != '' && user = @request.auth.id",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      {
        system: false,
        id: "nt_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        system: false,
        id: "nt_u1",
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
        name: "sender",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: false,
      },
      {
        name: "type",
        type: "text",
        required: true,
      },
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "body",
        type: "text",
        required: true,
      },
      {
        name: "read",
        type: "bool",
        required: true,
        default: false,
      },
      {
        name: "relatedId",
        type: "text",
        required: false,
      }
    ],
    indexes: [
      "CREATE INDEX idx_notif_user ON notifications (user)",
      "CREATE INDEX idx_notif_unread ON notifications (user, read)"
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("notifications");
  if (collection) {
    return app.delete(collection);
  }
});
