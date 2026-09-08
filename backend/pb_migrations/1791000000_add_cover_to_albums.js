/// <reference path="../pb_data/types.d.ts" />

// Portada del álbum: la elige el superusuario desde /admin/album (admin_album.pb.js,
// vía PATCH directo a /api/collections/albums/records/:id con FormData — la sesión ahí
// ya es de _superusers, que bypassa la updateRule null de `albums` sin necesitar un
// endpoint /api/admin/album/* propio). Se muestra en AlbumsListScreen (la fila de la
// lista) y en la página de portada de LeagueAlbumScreen. Mismo tamaño/mimeTypes que
// teamPhoto (1790600000_add_team_photo_to_users.js): sin `thumbs`, la HD sale directo
// de R2 (PRINCIPLES.md §2) y el único lugar que pide miniatura (la fila chica de la
// lista) usa el resize lazy de PocketBase vía `?thumb=`.
migrate((app) => {
    const albums = app.findCollectionByNameOrId("albums");
    albums.fields.add(new Field({
        name: "cover",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    }));
    app.save(albums);
}, (app) => {
    const albums = app.findCollectionByNameOrId("albums");
    albums.fields.removeByName("cover");
    app.save(albums);
});
