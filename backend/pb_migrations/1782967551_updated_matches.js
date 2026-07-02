/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("83jqsmobhgqb5i1")

  collection.createRule = "@request.auth.id != \"\" && (@request.auth.isSuperadmin = true || @request.data.contest.admins.id ?= @request.auth.id)"
  collection.updateRule = "@request.auth.id != \"\" && (@request.auth.isSuperadmin = true || contest.admins.id ?= @request.auth.id)"
  collection.deleteRule = "@request.auth.id != \"\" && (@request.auth.isSuperadmin = true || contest.admins.id ?= @request.auth.id)"

  // remove
  collection.schema.removeField("iwze8zys")

  // remove
  collection.schema.removeField("bbqebrge")

  // remove
  collection.schema.removeField("ymjdszu3")

  // remove
  collection.schema.removeField("kb7bqgfj")

  // remove
  collection.schema.removeField("3awielb7")

  // remove
  collection.schema.removeField("m0gojjhl")

  // remove
  collection.schema.removeField("f2edl9et")

  // remove
  collection.schema.removeField("vmgz0qz9")

  // remove
  collection.schema.removeField("bbenjeea")

  // remove
  collection.schema.removeField("uihhv4qm")

  // remove
  collection.schema.removeField("lcbrxbp9")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "h7iy0xnd",
    "name": "contest",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "mw0r9854gj0yb2n",
      "cascadeDelete": false,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "fiujvexz",
    "name": "homeTeam",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "81xvqwsw",
    "name": "homeFlag",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "s08kiqzh",
    "name": "awayTeam",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "miouftcw",
    "name": "awayFlag",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "dlpowyl4",
    "name": "stage",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "dq8qilwb",
    "name": "date",
    "type": "date",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "min": "",
      "max": ""
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "q1girakb",
    "name": "active",
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "0o0bmccp",
    "name": "homeScore",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": 0,
      "max": null,
      "noDecimal": false
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "chccwyco",
    "name": "awayScore",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": 0,
      "max": null,
      "noDecimal": false
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "z1wyhj6e",
    "name": "played",
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("83jqsmobhgqb5i1")

  collection.createRule = "@request.auth.id != \"\" && @request.data.contest.admins.id ?= @request.auth.id"
  collection.updateRule = "@request.auth.id != \"\" && contest.admins.id ?= @request.auth.id"
  collection.deleteRule = "@request.auth.id != \"\" && contest.admins.id ?= @request.auth.id"

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "iwze8zys",
    "name": "contest",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "mw0r9854gj0yb2n",
      "cascadeDelete": false,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "bbqebrge",
    "name": "homeTeam",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "ymjdszu3",
    "name": "homeFlag",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "kb7bqgfj",
    "name": "awayTeam",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "3awielb7",
    "name": "awayFlag",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "m0gojjhl",
    "name": "stage",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "f2edl9et",
    "name": "date",
    "type": "date",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "min": "",
      "max": ""
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "vmgz0qz9",
    "name": "active",
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "bbenjeea",
    "name": "homeScore",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": 0,
      "max": null,
      "noDecimal": false
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "uihhv4qm",
    "name": "awayScore",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": 0,
      "max": null,
      "noDecimal": false
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "lcbrxbp9",
    "name": "played",
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  }))

  // remove
  collection.schema.removeField("h7iy0xnd")

  // remove
  collection.schema.removeField("fiujvexz")

  // remove
  collection.schema.removeField("81xvqwsw")

  // remove
  collection.schema.removeField("s08kiqzh")

  // remove
  collection.schema.removeField("miouftcw")

  // remove
  collection.schema.removeField("dlpowyl4")

  // remove
  collection.schema.removeField("dq8qilwb")

  // remove
  collection.schema.removeField("q1girakb")

  // remove
  collection.schema.removeField("0o0bmccp")

  // remove
  collection.schema.removeField("chccwyco")

  // remove
  collection.schema.removeField("z1wyhj6e")

  return dao.saveCollection(collection)
})
