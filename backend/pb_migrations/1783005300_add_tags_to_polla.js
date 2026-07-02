/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  
  // Add tag to contests
  const contestsCollection = dao.findCollectionByNameOrId("mw0r9854gj0yb2n")
  contestsCollection.schema.addField(new SchemaField({
    "system": false,
    "id": "ctag_0101",
    "name": "tag",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))
  dao.saveCollection(contestsCollection)

  // Add tag to matches
  const matchesCollection = dao.findCollectionByNameOrId("83jqsmobhgqb5i1")
  matchesCollection.schema.addField(new SchemaField({
    "system": false,
    "id": "mtag_0102",
    "name": "tag",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))
  dao.saveCollection(matchesCollection)

}, (db) => {
  const dao = new Dao(db)
  
  const contestsCollection = dao.findCollectionByNameOrId("mw0r9854gj0yb2n")
  contestsCollection.schema.removeField("ctag_0101")
  dao.saveCollection(contestsCollection)

  const matchesCollection = dao.findCollectionByNameOrId("83jqsmobhgqb5i1")
  matchesCollection.schema.removeField("mtag_0102")
  dao.saveCollection(matchesCollection)
})
