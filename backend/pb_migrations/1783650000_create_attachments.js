migrate((app) => {
  const attachments = new Collection({
    id: "attachments_001",
    name: "attachments",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && @request.auth.id = author",
    deleteRule: "@request.auth.id != '' && @request.auth.id = author",
    fields: [
      {
        id: "att_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        id: "att_u1",
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
      {
        id: "att_file",
        name: "file",
        type: "file",
        required: true,
        maxSelect: 1,
        maxSize: 10485760, // 10MB
        mimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/svg+xml"
        ]
      },
      {
        id: "att_author",
        name: "author",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      }
    ]
  });
  return app.save(attachments);
}, (app) => {
  const attachments = app.findCollectionByNameOrId("attachments");
  if (attachments) app.delete(attachments);
});
