/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const albums = app.findCollectionByNameOrId("albums");
    const usersColl = app.findCollectionByNameOrId("users");

    // album_team_numbers — el "01" de cada equipo dentro de un álbum específico
    // (código de figurita = equipo + slot, ver album.pb.js). Se asigna una sola vez, la
    // primera vez que ese equipo aparece en ese álbum (MAX(number)+1 de ese álbum), y
    // nunca se reasigna — agregar/quitar ligas del álbum después no corre la
    // numeración de los equipos que ya tenían número. Reglas en null: solo se
    // lee/escribe desde album.pb.js vía $app.
    const albumTeamNumbers = new Collection({
        name: "album_team_numbers",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "album",
                type: "relation",
                required: true,
                collectionId: albums.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "team",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            { name: "number", type: "number", required: true, min: 1, noDecimal: true },
            { id: "atn_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "atn_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_album_team_numbers_team ON album_team_numbers (album, team)",
            "CREATE UNIQUE INDEX idx_album_team_numbers_number ON album_team_numbers (album, number)"
        ]
    });
    app.save(albumTeamNumbers);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("album_team_numbers")); } catch (e) {}
});
