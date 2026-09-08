/// <reference path="../pb_data/types.d.ts" />

// 1787800000_add_fit_thumb_to_match_photo.js agregó "100x100f" pero dejó "300x300"
// (recorte al centro) intacto — el único thumb grande declarado en matchPhoto seguía
// recortando escudos no cuadrados antes de llegar al cliente, exactamente el mismo bug
// que esa migración ya había diagnosticado para el tamaño chico. Se corrige agregando
// "300x300f" y sacando "300x300": nada en el frontend lo pide (TeamCrest y
// LeagueAlbumScreen lo esquivaban a mano trayendo la imagen original completa) y
// dejarlo declarado es un riesgo de que alguien lo vuelva a usar sin darse cuenta de
// que recorta mal.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    const matchPhotoField = users.fields.getByName("matchPhoto");
    if (matchPhotoField) {
        matchPhotoField.thumbs = ["100x100", "100x100f", "300x300f"];
    }
    app.save(users);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    const matchPhotoField = users.fields.getByName("matchPhoto");
    if (matchPhotoField) {
        matchPhotoField.thumbs = ["100x100", "100x100f", "300x300"];
    }
    app.save(users);
});
