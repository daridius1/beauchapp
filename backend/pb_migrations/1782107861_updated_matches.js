/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("83jqsmobhgqb5i1")

  collection.createRule = "@request.auth.id != \"\" && (@request.auth.isSuperadmin = true || @request.data.contest.admins.id ?= @request.auth.id)"
  collection.deleteRule = "@request.auth.id != \"\" && (@request.auth.isSuperadmin = true || contest.admins.id ?= @request.auth.id)"

  // remove
  collection.schema.removeField("ecvc597e")

  // remove
  collection.schema.removeField("lna276br")

  // remove
  collection.schema.removeField("aayb5lga")

  // remove
  collection.schema.removeField("xjwdqzbt")

  // remove
  collection.schema.removeField("qkizw91s")

  // remove
  collection.schema.removeField("qlahqltk")

  // remove
  collection.schema.removeField("rth44yk6")

  // remove
  collection.schema.removeField("gtlhiszd")

  // remove
  collection.schema.removeField("vdubrpmd")

  // remove
  collection.schema.removeField("dwq3jrcx")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "g1ubowes",
    "name": "contest",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "mw0r9854gj0yb2n",
      "cascadeDelete": true,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "tjbjfyju",
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
    "id": "wexiktxr",
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
    "id": "vvm3l0rp",
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
    "id": "cqkmqz6f",
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
    "id": "e5h9jthb",
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
    "id": "bxdktiiv",
    "name": "date",
    "type": "date",
    "required": false,
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
    "id": "6dry0sg4",
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
    "id": "u2k23brf",
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
    "id": "viqqxve6",
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

  collection.createRule = null
  collection.deleteRule = null

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "ecvc597e",
    "name": "contest",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "mw0r9854gj0yb2n",
      "cascadeDelete": true,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "lna276br",
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
    "id": "aayb5lga",
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
    "id": "xjwdqzbt",
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
    "id": "qkizw91s",
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
    "id": "qlahqltk",
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
    "id": "rth44yk6",
    "name": "date",
    "type": "date",
    "required": false,
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
    "id": "gtlhiszd",
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
    "id": "vdubrpmd",
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
    "id": "dwq3jrcx",
    "name": "played",
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  }))

  // remove
  collection.schema.removeField("g1ubowes")

  // remove
  collection.schema.removeField("tjbjfyju")

  // remove
  collection.schema.removeField("wexiktxr")

  // remove
  collection.schema.removeField("vvm3l0rp")

  // remove
  collection.schema.removeField("cqkmqz6f")

  // remove
  collection.schema.removeField("e5h9jthb")

  // remove
  collection.schema.removeField("bxdktiiv")

  // remove
  collection.schema.removeField("6dry0sg4")

  // remove
  collection.schema.removeField("u2k23brf")

  // remove
  collection.schema.removeField("viqqxve6")

  return dao.saveCollection(collection)
})
