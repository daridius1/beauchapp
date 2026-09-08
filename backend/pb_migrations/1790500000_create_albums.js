/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");

    // albums — un álbum de figuritas puede abarcar varias ligas a la vez (ej. Copa CDI
    // masculina/femenina/mixta del mismo año comparten un álbum). Se administra solo
    // desde /admin/album (superusuario) — nunca desde /admin/liga, que es la propia
    // liga administrando SU liga. list/view abiertos a cualquier autenticado (igual
    // que league_teams): no hay nada sensible acá, y LeagueDetailScreen necesita poder
    // consultar directo si la liga que está mirando tiene álbum activo, sin pasar por
    // un endpoint dedicado solo para esa pregunta. create/update/delete en null: eso
    // sí pasa solo por /api/admin/album/* ($app.* bypassa las reglas).
    const albums = new Collection({
        name: "albums",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            { name: "name", type: "text", required: true, max: 80 },
            { name: "enabled", type: "bool", required: false },
            { id: "alb_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "alb_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ]
    });
    app.save(albums);

    // album_leagues — qué ligas (cuentas users subtype=league) componen cada álbum.
    // El set de figuritas elegible de un álbum se calcula a partir de esto: liga ->
    // league_teams -> team_players, sin duplicar esos datos en una colección nueva.
    // list/view abiertos a cualquier autenticado, mismo motivo que en `albums`.
    const albumLeagues = new Collection({
        name: "album_leagues",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
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
                name: "league",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            { id: "alg_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "alg_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_album_leagues_unique ON album_leagues (album, league)"
        ]
    });
    app.save(albumLeagues);

    // album_stickers — cuántas copias de una figurita tiene cada usuario en cada
    // álbum. Se guarda por CÓDIGO ("0113", "0103"...), no por relación a team_players:
    // hay cartas especiales (escudo/foto/DT/capitán, ver lib/album.js) que no son un
    // team_player — el capitán en particular es una carta APARTE que se sortea igual
    // que un jugador, pero cuyo contenido (a quién muestra) puede cambiar con el
    // tiempo si el equipo cambia de capitán; guardar por código evita modelar dos
    // formas distintas de "figurita" en la misma colección. Una fila por (album,
    // user, code); se crea/incrementa dentro de la misma transacción que descuenta
    // los BeauTokens del sobre, así que nunca queda desincronizada con el saldo
    // (mismo patrón que beaumarket_positions).
    const albumStickers = new Collection({
        name: "album_stickers",
        type: "base",
        listRule: "@request.auth.id != '' && @request.auth.id = user",
        viewRule: "@request.auth.id != '' && @request.auth.id = user",
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
                name: "user",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            { name: "code", type: "text", required: true, max: 8 },
            { name: "count", type: "number", required: true, min: 1, noDecimal: true },
            { id: "als_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "als_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_album_stickers_unique ON album_stickers (album, user, code)"
        ]
    });
    app.save(albumStickers);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("album_stickers")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("album_leagues")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("albums")); } catch (e) {}
});
