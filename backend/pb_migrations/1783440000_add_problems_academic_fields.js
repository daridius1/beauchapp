migrate((app) => {
  const problems = app.findCollectionByNameOrId("problems");
  if (problems) {
    problems.fields.add(new Field({
      name: "ramo",
      type: "text",
      required: false,
    }));
    problems.fields.add(new Field({
      name: "semestre",
      type: "text",
      required: false,
    }));
    problems.fields.add(new Field({
      name: "instancia",
      type: "text",
      required: false,
    }));
    app.save(problems);
  }
}, (app) => {
  const problems = app.findCollectionByNameOrId("problems");
  if (problems) {
    problems.fields.removeByName("ramo");
    problems.fields.removeByName("semestre");
    problems.fields.removeByName("instancia");
    app.save(problems);
  }
});
