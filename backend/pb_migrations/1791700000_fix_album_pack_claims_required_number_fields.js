/// <reference path="../pb_data/types.d.ts" />

// Corrige un bug real de 1791600000_create_album_pack_claims.js: freeOpened/boughtOpened
// quedaron con required:true, y PocketBase trata 0 como "vacío" en un campo number
// required — toda fila nueva arranca en 0/0 (nadie abrió sobres todavía ese día), así
// que ese primer save() fallaba en silencio (POST /api/album/buy-pack lo atrapa y cae al
// fallback de relectura, que sin fila creada tira "sql: no rows in result set"). Se
// muta el field existente en vez de removeByName+add para no perder los ids/valores ya
// guardados (mismo motivo que album_stickers.count usa min:1 en vez de required:false:
// acá el 0 SÍ es un valor válido del dominio, así que la solución es la otra punta).
migrate((app) => {
    const collection = app.findCollectionByNameOrId("album_pack_claims");
    collection.fields.getByName("freeOpened").required = false;
    collection.fields.getByName("boughtOpened").required = false;
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("album_pack_claims");
    collection.fields.getByName("freeOpened").required = true;
    collection.fields.getByName("boughtOpened").required = true;
    app.save(collection);
});
