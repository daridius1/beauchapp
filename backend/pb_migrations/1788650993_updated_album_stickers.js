/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_210403220")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX idx_album_stickers_unique ON album_stickers (album, user, code)"
    ]
  }, collection)

  // remove field
  collection.fields.removeById("relation2551806565")

  // add field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text_album_stickers_code",
    "max": 8,
    "min": 0,
    "name": "code",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_210403220")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX idx_album_stickers_unique ON album_stickers (album, user, player)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": true,
    "collectionId": "pbc_2393863831",
    "help": "",
    "hidden": false,
    "id": "relation2551806565",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "player",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // remove field
  collection.fields.removeById("text_album_stickers_code")

  return app.save(collection)
})
