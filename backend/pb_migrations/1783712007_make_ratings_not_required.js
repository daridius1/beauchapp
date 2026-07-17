/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("problem_ratings");
  const ratingField = collection.fields.find(f => f.name === "rating");
  if (ratingField) {
    ratingField.required = false;
  }
  const difficultyField = collection.fields.find(f => f.name === "difficulty");
  if (difficultyField) {
    difficultyField.required = false;
  }
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("problem_ratings");
  const ratingField = collection.fields.find(f => f.name === "rating");
  if (ratingField) {
    ratingField.required = true;
  }
  const difficultyField = collection.fields.find(f => f.name === "difficulty");
  if (difficultyField) {
    difficultyField.required = true;
  }
  app.save(collection);
})
