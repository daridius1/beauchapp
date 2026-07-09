migrate((app) => {
  // 1. Añadir el campo 'parent' a 'problems'
  const problems = app.findCollectionByNameOrId("problems");
  if (problems) {
    problems.fields.add(new Field({
      name: "parent",
      type: "relation",
      collectionId: problems.id,
      cascadeDelete: false, // The user requested to skip delete logic for now
      maxSelect: 1,
      required: false,
    }));
    app.save(problems);
  }

  // 2. Eliminar la colección 'problem_answers'
  const answers = app.findCollectionByNameOrId("problem_answers");
  if (answers) {
    app.delete(answers);
  }

}, (app) => {
  // 1. Volver a crear 'problem_answers'
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

  // 2. Quitar el campo 'parent' de 'problems'
  const problems = app.findCollectionByNameOrId("problems");
  if (problems) {
    problems.fields.removeByName("parent");
    app.save(problems);
  }
});
