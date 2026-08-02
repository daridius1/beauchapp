/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");

  // 1. Colección 'activities'
  const activitiesColl = new Collection({
    name: "activities",
    type: "base",
    listRule: "deleted = false",
    viewRule: "deleted = false",
    createRule: "@request.auth.id != '' && @request.auth.type = 'organization'",
    updateRule: "organization = @request.auth.id",
    deleteRule: "organization = @request.auth.id",
    fields: [
      { name: "id", type: "text", primaryKey: true, autogeneratePattern: "[a-z0-9]{15}" },
      {
        name: "organization",
        type: "relation",
        required: true,
        collectionId: usersColl.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      { name: "title", type: "text", required: true },
      { name: "description", type: "text", required: false },
      { name: "location", type: "text", required: true },
      { name: "date", type: "text", required: true },
      { name: "start_time", type: "text", required: true },
      { name: "end_time", type: "text", required: true },
      { name: "category", type: "text", required: false },
      {
        name: "banner",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"]
      },
      { name: "price", type: "text", required: false },
      { name: "external_link", type: "text", required: false },
      { name: "like_count", type: "number", required: false },
      { name: "attendee_count", type: "number", required: false },
      { name: "comment_count", type: "number", required: false },
      { name: "quote_count", type: "number", required: false },
      { name: "deleted", type: "bool", required: false },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ]
  });
  app.save(activitiesColl);

  // 2. Colección 'activity_likes'
  const likesColl = new Collection({
    name: "activity_likes",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && user = @request.auth.id",
    updateRule: null,
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      { name: "id", type: "text", primaryKey: true, autogeneratePattern: "[a-z0-9]{15}" },
      {
        name: "activity",
        type: "relation",
        required: true,
        collectionId: activitiesColl.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: usersColl.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      { name: "created", type: "autodate", onCreate: true }
    ]
  });
  app.save(likesColl);

  // 3. Colección 'activity_attendees'
  const attendeesColl = new Collection({
    name: "activity_attendees",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && user = @request.auth.id",
    updateRule: null,
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      { name: "id", type: "text", primaryKey: true, autogeneratePattern: "[a-z0-9]{15}" },
      {
        name: "activity",
        type: "relation",
        required: true,
        collectionId: activitiesColl.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: usersColl.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      { name: "created", type: "autodate", onCreate: true }
    ]
  });
  app.save(attendeesColl);

  // Crear índices únicos
  try {
    app.db().newQuery("CREATE UNIQUE INDEX `idx_act_like_user` ON `activity_likes` (`activity`, `user`)").execute();
    app.db().newQuery("CREATE UNIQUE INDEX `idx_act_attendee_user` ON `activity_attendees` (`activity`, `user`)").execute();
  } catch (err) {
    console.log("[Migration 1784000800] Warning creating indexes:", err);
  }
}, (app) => {
  try {
    const attendeesColl = app.findCollectionByNameOrId("activity_attendees");
    if (attendeesColl) app.delete(attendeesColl);
  } catch (e) {}

  try {
    const likesColl = app.findCollectionByNameOrId("activity_likes");
    if (likesColl) app.delete(likesColl);
  } catch (e) {}

  try {
    const activitiesColl = app.findCollectionByNameOrId("activities");
    if (activitiesColl) app.delete(activitiesColl);
  } catch (e) {}
});
