/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const predictions = app.findCollectionByNameOrId("predictions");
    app.delete(predictions);
  } catch (e) {
    console.log("Error deleting predictions: ", e);
  }

  try {
    const matches = app.findCollectionByNameOrId("matches");
    app.delete(matches);
  } catch (e) {
    console.log("Error deleting matches: ", e);
  }

  try {
    const contests = app.findCollectionByNameOrId("contests");
    app.delete(contests);
  } catch (e) {
    console.log("Error deleting contests: ", e);
  }
}, (app) => {
  // Down migration (no-op as we are archiving)
})
