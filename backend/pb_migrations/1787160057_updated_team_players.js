/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2393863831")

  // update collection data
  unmarshal({
    "updateRule": "@request.auth.id = team && deleted = false && (@request.body.team:isset = false || @request.body.team = team)"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2393863831")

  // update collection data
  unmarshal({
    "updateRule": "@request.auth.id = team && deleted = false"
  }, collection)

  return app.save(collection)
})
