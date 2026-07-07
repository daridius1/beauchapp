/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeById("lwzh6img");
  users.authRule = "verified = true";
  app.save(users);

  const contests = app.findCollectionByNameOrId("contests");
  contests.updateRule = "@request.auth.id != \"\" && admins.id ?= @request.auth.id";
  app.save(contests);

  const matches = app.findCollectionByNameOrId("matches");
  matches.createRule = "@request.auth.id != \"\" && @request.body.contest.admins.id ?= @request.auth.id";
  matches.updateRule = "@request.auth.id != \"\" && contest.admins.id ?= @request.auth.id";
  matches.deleteRule = "@request.auth.id != \"\" && contest.admins.id ?= @request.auth.id";
  app.save(matches);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.authRule = "";
  app.save(users);

  const contests = app.findCollectionByNameOrId("contests");
  contests.updateRule = "@request.auth.id != \"\" && @request.auth.isSuperadmin = true";
  app.save(contests);

  const matches = app.findCollectionByNameOrId("matches");
  matches.createRule = "@request.auth.id != \"\" && (@request.auth.isSuperadmin = true || @request.body.contest.admins.id ?= @request.auth.id)";
  matches.updateRule = "@request.auth.id != \"\" && (@request.auth.isSuperadmin = true || contest.admins.id ?= @request.auth.id)";
  matches.deleteRule = "@request.auth.id != \"\" && (@request.auth.isSuperadmin = true || contest.admins.id ?= @request.auth.id)";
  app.save(matches);
})
