migrate((app) => {
  const collection = new Collection({
    id: "communit_12345",
    name: "communities",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: null,
    fields: [
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
        name: "members",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: false,
        maxSelect: 999
      }
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("communities");
  return app.delete(collection);
});
