/// <reference path="../pb_data/types.d.ts" />

// Categoría de cada liga DENTRO de un álbum (masculina/femenina/mixta) — un álbum puede
// juntar varias ligas que comparten plantel de figuritas (ver 1790500000_create_albums.js),
// y hoy no había forma de distinguir de cuál categoría es cada una salvo por el nombre de
// la liga. Se elige desde /admin/album (admin_album.pb.js, POST
// /api/admin/album/set-league-category) — vive en `album_leagues`, no en la propia cuenta
// de liga (`users`), porque es una etiqueta del ÁLBUM sobre esa liga, no un dato de la
// liga en sí: la misma liga podría entrar a dos álbumes distintos con roles distintos (en
// la práctica no pasa hoy, pero el modelo no debería impedirlo). Sin valor por defecto: una
// liga recién agregada queda sin categoría ("-" en la lámina de plantel, ver
// LeagueAlbumScreen.tsx) hasta que el superusuario la elija a mano.
migrate((app) => {
    const albumLeagues = app.findCollectionByNameOrId("album_leagues");
    albumLeagues.fields.add(new Field({
        name: "category",
        type: "select",
        values: ["masc", "fem", "mixto"],
        maxSelect: 1,
        required: false,
    }));
    app.save(albumLeagues);
}, (app) => {
    const albumLeagues = app.findCollectionByNameOrId("album_leagues");
    albumLeagues.fields.removeByName("category");
    app.save(albumLeagues);
});
