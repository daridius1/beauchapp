/// <reference path="../pb_data/types.d.ts" />

// Copia del avatar del bloqueado (poblada por blocking.pb.js a nivel de storage,
// no vía API) para poder mostrarlo en "Usuarios bloqueados" en Configuración.
// No se puede usar getFileUrl sobre el registro original de "users": una vez
// creado el bloqueo, users.viewRule ya excluye a esa persona para este mismo
// usuario, así que el archivo original tampoco sería accesible por esa vía.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("blocked_users");
  if (!collection.fields.find((f) => f.name === "blocked_avatar")) {
    collection.fields.add(new Field({
      name: "blocked_avatar",
      type: "file",
      required: false,
      maxSelect: 1,
      maxSize: 5242880,
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      thumbs: ["100x100"],
    }));
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("blocked_users");
  if (collection) {
    collection.fields.removeByName("blocked_avatar");
    app.save(collection);
  }
});
