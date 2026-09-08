/// <reference path="../pb_data/types.d.ts" />

// `pasted` — si esta figurita ya está pegada en el álbum (vista Álbum) o todavía es
// una lámina suelta (vista Láminas, disponible para pegar o intercambiar). Antes de
// esta migración toda figurita dibujada se mostraba pegada automáticamente — los
// usuarios que ya juntaron figuritas no tienen por qué perder ese progreso visual, así
// que las filas que YA EXISTEN se dan por pegadas (UPDATE masivo después de agregar la
// columna); solo lo que se obtenga de acá en adelante (sobre nuevo o intercambio)
// nace suelto y necesita la acción explícita de "Pegar" (album.pb.js, POST
// /api/album/paste).
migrate((app) => {
    const collection = app.findCollectionByNameOrId("album_stickers");
    collection.fields.add(new Field({
        name: "pasted",
        type: "bool",
        required: false,
    }));
    app.save(collection);

    // Bulk SQL en vez de iterar+save por fila (servidor Atom/2GB, CLAUDE.md §5) — el
    // orden importa: recién acá existe la columna (default false), así que este UPDATE
    // solo toca las filas que ya estaban antes del deploy.
    app.db().newQuery("UPDATE album_stickers SET pasted = true").execute();
}, (app) => {
    const collection = app.findCollectionByNameOrId("album_stickers");
    collection.fields.removeByName("pasted");
    app.save(collection);
});
