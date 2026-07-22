/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const ranks = app.findCollectionByNameOrId("ladder_ranks");
    ranks.updateRule = "@request.auth.id != ''";
    app.save(ranks);
}, (app) => {
    const ranks = app.findCollectionByNameOrId("ladder_ranks");
    ranks.updateRule = "@request.auth.id != '' && @request.auth.isSuperadmin = true";
    app.save(ranks);
});
