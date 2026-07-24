migrate((app) => {
  const orgMembers = app.findCollectionByNameOrId("organization_members");
  if (orgMembers) {
    console.log("Current orgMembers rules:", {
      list: orgMembers.listRule,
      view: orgMembers.viewRule,
      create: orgMembers.createRule,
      update: orgMembers.updateRule,
      delete: orgMembers.deleteRule,
    });
    orgMembers.listRule = "@request.auth.id != ''";
    orgMembers.viewRule = "@request.auth.id != ''";
    orgMembers.createRule = "@request.auth.id != ''";
    orgMembers.updateRule = "@request.auth.id != ''";
    orgMembers.deleteRule = "@request.auth.id != ''";
    app.save(orgMembers);
  }
}, (app) => {
  // Down migration no-op
});
