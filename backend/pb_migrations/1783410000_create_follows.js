migrate((app) => {
  const collection = new Collection({
    id: "follows_0000001",
    name: "follows",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.id = follower && @request.auth.type = 'student' && follower != following",
    updateRule: null,
    deleteRule: "@request.auth.id != '' && @request.auth.id = follower",
    fields: [
      {
        system: false,
        id: "flw_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
        presentable: false,
      },
      {
        system: false,
        id: "flw_u1",
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
        presentable: false,
      },
      {
        name: "follower",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      {
        name: "following",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_follower_following ON follows (follower, following)"
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("follows");
  if (collection) {
    return app.delete(collection);
  }
});
