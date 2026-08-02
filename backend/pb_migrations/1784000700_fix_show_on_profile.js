/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const ranksColl = app.findCollectionByNameOrId("ladder_ranks");

  // Agregar campo show_on_profile (bool) si no existe
  // Usar fields.add directamente sin .find() que puede no existir en v0.25+
  ranksColl.fields.add(new Field({
    name: "show_on_profile",
    type: "bool",
    required: false,
  }));

  app.save(ranksColl);
}, (app) => {
  // revert: no-op
});
