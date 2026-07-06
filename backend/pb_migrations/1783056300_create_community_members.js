migrate((app) => {
  const collection = new Collection({
    id: "comm_mem_12345",
    name: "community_members",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      {
        system: false,
        id: "cm_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
        presentable: false,
      },
      {
        system: false,
        id: "cm_u1",
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
        presentable: false,
      },
      {
        name: "user",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true
      },
      {
        name: "community",
        type: "relation",
        collectionId: "communit_12345",
        cascadeDelete: true,
        maxSelect: 1,
        required: true
      },
      {
        name: "status",
        type: "select",
        values: ["active", "inactive"],
        maxSelect: 1,
        required: true
      }
    ]
  });

  collection.indexes = [
    "CREATE UNIQUE INDEX `idx_cm_user_comm` ON `community_members` (`user`, `community`)"
  ];

  app.save(collection);

  const communitiesCol = app.findCollectionByNameOrId("communities");
  if (communitiesCol) {
    communitiesCol.fields.removeByName("members");
    app.save(communitiesCol);
  }

  return;
}, (app) => {
  const communitiesCol = app.findCollectionByNameOrId("communities");
  if (communitiesCol) {
    communitiesCol.fields.add(new Field({
      name: "members",
      type: "relation",
      collectionId: "_pb_users_auth_",
      cascadeDelete: false,
      maxSelect: 999
    }));
    app.save(communitiesCol);
  }

  const collection = app.findCollectionByNameOrId("community_members");
  if (collection) {
    app.delete(collection);
  }
});
