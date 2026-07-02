/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("mw0r9854gj0yb2n")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "x4trj6pj",
    "name": "type",
    "type": "select",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "maxSelect": 1,
      "values": [
        "polla",
        "trivia",
        "liga"
      ]
    }
  }))

  // update
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "nwgoewws",
    "name": "type_old",
    "type": "text",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("mw0r9854gj0yb2n")

  // remove
  collection.schema.removeField("x4trj6pj")

  // update
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "nwgoewws",
    "name": "type",
    "type": "text",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))

  return dao.saveCollection(collection)
})
