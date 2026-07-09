migrate((app) => {
  // 1. Crear colección 'problems'
  const problems = new Collection({
    id: "problems_0000001",
    name: "problems",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.type != 'organization'",
    updateRule: "@request.auth.id != '' && @request.auth.id = author",
    deleteRule: "@request.auth.id != '' && @request.auth.id = author",
    fields: [
      {
        system: false,
        id: "prob_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        system: false,
        id: "prob_u1",
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "content",
        type: "text",
        required: true,
      },
      {
        name: "author",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      {
        name: "tags",
        type: "json",
      }
    ]
  });
  app.save(problems);

  // 2. Crear colección 'problem_answers'
  const answers = new Collection({
    id: "problem_ans_001",
    name: "problem_answers",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.type != 'organization'",
    updateRule: "@request.auth.id != '' && @request.auth.id = author",
    deleteRule: "@request.auth.id != '' && @request.auth.id = author",
    fields: [
      {
        system: false,
        id: "pans_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        system: false,
        id: "pans_u1",
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
      {
        name: "problem",
        type: "relation",
        collectionId: "problems_0000001",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      },
      {
        name: "content",
        type: "text",
        required: true,
      },
      {
        name: "author",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
      }
    ]
  });
  app.save(answers);

  // 3. Crear colección 'problem_ratings'
  const ratings = new Collection({
    id: "problem_rat_001",
    name: "problem_ratings",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.id = user",
    updateRule: "@request.auth.id != '' && @request.auth.id = user",
    deleteRule: "@request.auth.id != '' && @request.auth.id = user",
    fields: [
      {
        system: false,
        id: "prat_c1",
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        system: false,
        id: "prat_u1",
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
      {
        name: "problem",
        type: "relation",
        collectionId: "problems_0000001",
        cascadeDelete: true,
        maxSelect: 1,
        required: true,
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
        name: "rating",
        type: "number",
        required: true,
      },
      {
        name: "difficulty",
        type: "number",
        required: true,
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_problem_user ON problem_ratings (problem, user)"
    ]
  });
  return app.save(ratings);
}, (app) => {
  const ratings = app.findCollectionByNameOrId("problem_ratings");
  if (ratings) app.delete(ratings);

  const answers = app.findCollectionByNameOrId("problem_answers");
  if (answers) app.delete(answers);

  const problems = app.findCollectionByNameOrId("problems");
  if (problems) app.delete(problems);
});
