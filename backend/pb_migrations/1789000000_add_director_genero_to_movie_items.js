/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const items = app.findCollectionByNameOrId("movie_items");

  if (!items.fields.find((f) => f.name === "director")) {
    items.fields.add(new Field({ name: "director", type: "text", required: false }));
  }
  if (!items.fields.find((f) => f.name === "genero")) {
    items.fields.add(new Field({ name: "genero", type: "text", required: false }));
  }

  app.save(items);
}, (app) => {
  const items = app.findCollectionByNameOrId("movie_items");
  if (!items) return;

  ["director", "genero"].forEach((name) => {
    items.fields.removeByName(name);
  });

  app.save(items);
});
