/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Modificar users
  const users = app.findCollectionByNameOrId("users");
  
  // Modificar type para permitir solo student y organization
  users.fields.add(new Field({
    name: "type",
    type: "select",
    values: ["student", "organization"],
    maxSelect: 1,
    required: false,
  }));

  // Agregar subtype
  users.fields.add(new Field({
    name: "subtype",
    type: "select",
    values: ["center", "team", "community"],
    maxSelect: 1,
    required: false,
  }));

  // Agregar description
  users.fields.add(new Field({
    name: "description",
    type: "text",
    required: false,
  }));

  // Establecer createRule
  users.createRule = "@request.body.type = 'student'";
  app.save(users);

  // 2. Crear organization_members
  const orgMembers = new Collection({
    id: "org_mem_123456",
    name: "organization_members",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.id = organization",
    updateRule: "(@request.auth.id = organization) || (@request.auth.id = user && @request.body.status = 'inactive')",
    deleteRule: "@request.auth.id = organization",
    fields: [
      {
        system: false,
        id: "om_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
        presentable: false,
      },
      {
        system: false,
        id: "om_u1",
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
        name: "organization",
        type: "relation",
        collectionId: "_pb_users_auth_",
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
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_om_user_org` ON `organization_members` (`user`, `organization`)"
    ]
  });
  app.save(orgMembers);

  // 3. Eliminar colecciones obsoletas
  const teamMembers = app.findCollectionByNameOrId("team_members");
  if (teamMembers) app.delete(teamMembers);

  const communityMembers = app.findCollectionByNameOrId("community_members");
  if (communityMembers) app.delete(communityMembers);

  const teams = app.findCollectionByNameOrId("teams");
  if (teams) app.delete(teams);

  const communities = app.findCollectionByNameOrId("communities");
  if (communities) app.delete(communities);

}, (app) => {
  // Down migration no-op
})
