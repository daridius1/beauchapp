/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const albums = app.findCollectionByNameOrId("albums");
    const usersColl = app.findCollectionByNameOrId("users");

    // album_pack_claims — cuántos sobres abrió cada usuario HOY en cada álbum, para los
    // 3 gratis + 3 comprables (20 BeauTokens c/u) + el bono por Beaudle diarios (ver
    // album.pb.js). Una fila por (album, user, day), mismo patrón que beaudle_games
    // (1786234996_create_beaudle_collections.js): el índice único es lo que garantiza
    // "un solo contador por día" y "day" se calcula igual que ahí, en huso
    // America/Santiago, inline en cada handler (CLAUDE.md §2.1 — cada routerAdd corre
    // en su propia VM). No hay cron de reseteo: un día sin fila para ese (album, user)
    // simplemente parte de 0/0/false, así que "mañana" ya tiene cupo lleno sin tocar
    // nada.
    const albumPackClaims = new Collection({
        name: "album_pack_claims",
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
            {
                name: "day",
                type: "text",
                required: true,
                pattern: "^\\d{4}-\\d{2}-\\d{2}$"
            },
            // required: false a propósito — un campo number required:true trata 0 como
            // "vacío" (mismo motivo por el que album_stickers.count usa min:1 en vez de
            // permitir 0), y una fila recién creada arranca en 0/0 (nadie abrió sobres
            // todavía hoy). Con required:true, save() fallaba en silencio (atrapado por
            // el catch de arriba) y el fallback de relectura tiraba "sql: no rows in
            // result set" sin nada creado.
            { name: "freeOpened", type: "number", required: false, min: 0, max: 3, noDecimal: true },
            { name: "boughtOpened", type: "number", required: false, min: 0, max: 3, noDecimal: true },
            { name: "beaudleBonusOpened", type: "bool", required: false },
            { id: "apc_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "apc_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_album_pack_claims_unique ON album_pack_claims (album, user, day)"
        ]
    });
    app.save(albumPackClaims);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("album_pack_claims")); } catch (e) {}
});
