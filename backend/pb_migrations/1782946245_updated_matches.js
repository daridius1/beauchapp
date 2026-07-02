/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("83jqsmobhgqb5i1")

  collection.createRule = "@request.auth.id != \"\" && @request.data.contest.admins.id ?= @request.auth.id"
  collection.updateRule = "@request.auth.id != \"\" && contest.admins.id ?= @request.auth.id"
  collection.deleteRule = "@request.auth.id != \"\" && contest.admins.id ?= @request.auth.id"

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("83jqsmobhgqb5i1")

  collection.createRule = "@request.auth.id != \"\" && (@request.data.contest.admins.id ?= @request.auth.id)"
  collection.updateRule = "@request.auth.id != \"\" && (contest.admins.id ?= @request.auth.id)"
  collection.deleteRule = "@request.auth.id != \"\" && (contest.admins.id ?= @request.auth.id)"

  return dao.saveCollection(collection)
})
