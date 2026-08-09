/// <reference path="../pb_data/types.d.ts" />
// Un campo number required en 0 falla la validación "cannot be blank" en este runtime de
// PocketBase (mismo motivo por el que recommendations_count en marketplace tampoco es
// required) — players_count/solved_count de beaudle_daily_stats arrancan en 0 el primer
// guess del día, así que deben quedar required:false igual que el resto de contadores del
// proyecto.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("beaudle_daily_stats");
  const playersField = collection.fields.find(f => f.name === "players_count");
  if (playersField) {
    playersField.required = false;
  }
  const solvedField = collection.fields.find(f => f.name === "solved_count");
  if (solvedField) {
    solvedField.required = false;
  }
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("beaudle_daily_stats");
  const playersField = collection.fields.find(f => f.name === "players_count");
  if (playersField) {
    playersField.required = true;
  }
  const solvedField = collection.fields.find(f => f.name === "solved_count");
  if (solvedField) {
    solvedField.required = true;
  }
  app.save(collection);
})
