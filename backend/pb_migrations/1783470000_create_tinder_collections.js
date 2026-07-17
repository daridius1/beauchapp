migrate((app) => {
  // 1. Colección tinder_profiles
  const profiles = new Collection({
    id: "tinder_prof_01",
    name: "tinder_profiles",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.type = 'student' && @request.auth.id = user",
    updateRule: "@request.auth.id != '' && @request.auth.id = user",
    deleteRule: "@request.auth.id != '' && @request.auth.id = user",
    fields: [
      {
        system: false,
        id: "tp_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        system: false,
        id: "tp_u1",
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
        name: "description",
        type: "text",
        required: false,
      },
      {
        name: "photos",
        type: "file",
        maxSelect: 5,
        maxSize: 5242880, // 5MB
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        required: false,
      },
      {
        name: "isActive",
        type: "bool",
        required: true,
        default: false,
      },
      {
        name: "activatedAt",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
      {
        name: "instagram",
        type: "text",
        required: false,
      },
      {
        name: "whatsapp",
        type: "text",
        required: false,
      },
      {
        name: "telegram",
        type: "text",
        required: false,
      },
      {
        name: "signal",
        type: "text",
        required: false,
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_tinder_user ON tinder_profiles (user)"
    ]
  });
  app.save(profiles);

  // 2. Colección tinder_likes
  const likes = new Collection({
    id: "tinder_like_01",
    name: "tinder_likes",
    type: "base",
    listRule: "@request.auth.id != '' && @request.auth.id = fromUser",
    viewRule: "@request.auth.id != '' && @request.auth.id = fromUser",
    createRule: "@request.auth.id != '' && @request.auth.id = fromUser && fromUser != toUser",
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        system: false,
        id: "tl_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        name: "fromUser",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      {
        name: "toUser",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      {
        name: "liked",
        type: "bool",
        required: true,
        default: true,
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_tinder_from_to ON tinder_likes (fromUser, toUser)"
    ]
  });
  app.save(likes);

  // 3. Colección tinder_matches
  const matches = new Collection({
    id: "tinder_mtch_01",
    name: "tinder_matches",
    type: "base",
    listRule: "@request.auth.id != '' && (@request.auth.id = userA || @request.auth.id = userB)",
    viewRule: "@request.auth.id != '' && (@request.auth.id = userA || @request.auth.id = userB)",
    createRule: null, // Only backend hook can create matches
    updateRule: null,
    deleteRule: "@request.auth.id != '' && (@request.auth.id = userA || @request.auth.id = userB)", // Allow unmatching
    fields: [
      {
        system: false,
        id: "tm_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        name: "userA",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      {
        name: "userB",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_tinder_match_users ON tinder_matches (userA, userB)"
    ]
  });
  return app.save(matches);
}, (app) => {
  const matches = app.findCollectionByNameOrId("tinder_matches");
  if (matches) app.delete(matches);

  const likes = app.findCollectionByNameOrId("tinder_likes");
  if (likes) app.delete(likes);

  const profiles = app.findCollectionByNameOrId("tinder_profiles");
  if (profiles) app.delete(profiles);
});
