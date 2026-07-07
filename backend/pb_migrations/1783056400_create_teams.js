migrate((app) => {
  const collection = new Collection({
    id: "teams_00000001",
    name: "teams",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.type = 'organization'",
    updateRule: "@request.auth.id != '' && owner_org = @request.auth.id",
    deleteRule: "@request.auth.id != '' && owner_org = @request.auth.id",
    fields: [
      {
        system: false,
        id: "tms_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
        presentable: false,
      },
      {
        system: false,
        id: "tms_u1",
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
        presentable: false,
      },
      {
        name: "name",
        type: "text",
        required: true,
      },
      {
        name: "description",
        type: "text",
      },
      {
        name: "owner_org",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true
      }
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("teams");
  if (collection) {
    return app.delete(collection);
  }
});
