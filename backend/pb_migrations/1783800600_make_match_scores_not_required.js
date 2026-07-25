/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("ladder_matches");
  const scoreRed = collection.fields.find(f => f.name === "score_red");
  if (scoreRed) {
    scoreRed.required = false;
  }
  const scoreBlue = collection.fields.find(f => f.name === "score_blue");
  if (scoreBlue) {
    scoreBlue.required = false;
  }
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("ladder_matches");
  const scoreRed = collection.fields.find(f => f.name === "score_red");
  if (scoreRed) {
    scoreRed.required = true;
  }
  const scoreBlue = collection.fields.find(f => f.name === "score_blue");
  if (scoreBlue) {
    scoreBlue.required = true;
  }
  app.save(collection);
});
