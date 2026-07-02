/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("h20ayxjzl2sl1iz")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "replyto_rel",
    "name": "replyTo",
    "type": "relation",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "h20ayxjzl2sl1iz",
      "cascadeDelete": true,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": null
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("h20ayxjzl2sl1iz")

  // remove
  collection.schema.removeField("replyto_rel")

  return dao.saveCollection(collection)
})
