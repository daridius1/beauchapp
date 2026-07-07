migrate((app) => {
  const collection = new Collection({
    id: "team_mem_000001",
    name: "team_members",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: null, // Managed by pb_hooks for complex logic
    updateRule: null, // Managed by pb_hooks for complex logic
    deleteRule: null, // Managed by pb_hooks for complex logic
    fields: [
      {
        system: false,
        id: "tmm_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
        presentable: false,
      },
      {
        system: false,
        id: "tmm_u1",
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
        name: "team",
        type: "relation",
        collectionId: "teams_00000001",
        cascadeDelete: true,
        maxSelect: 1,
        required: true
      },
      {
        name: "role",
        type: "select",
        values: ["admin", "member"],
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
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_tm_user_team` ON `team_members` (`user`, `team`)"
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("team_members");
  if (collection) {
    return app.delete(collection);
  }
});
