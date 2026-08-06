/// <reference path="../pb_data/types.d.ts" />

// Reconciliación: el servidor real de desarrollo se reinició durante la
// implementación de este feature y ya corrió 1784200000_create_blocked_users.js
// en una versión anterior a que se le agregaran blocked_name/blocked_username
// (PocketBase registra migraciones aplicadas por nombre de archivo, no por
// contenido, así que editar ese archivo después no lo vuelve a correr). Esta
// migración agrega los campos si faltan, sin duplicar si ya existen (entorno
// nuevo que corre 1784200000_create_blocked_users.js ya actualizado de una).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("blocked_users");
  if (!collection) return;

  let changed = false;
  if (!collection.fields.find((f) => f.name === "blocked_name")) {
    collection.fields.add(new Field({ name: "blocked_name", type: "text", required: false }));
    changed = true;
  }
  if (!collection.fields.find((f) => f.name === "blocked_username")) {
    collection.fields.add(new Field({ name: "blocked_username", type: "text", required: false }));
    changed = true;
  }
  if (changed) {
    app.save(collection);
  }
}, (app) => {});
