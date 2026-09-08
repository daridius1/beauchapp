/// <reference path="../pb_data/types.d.ts" />

// album_trades — propuesta de intercambio 1x1 de una figurita SUELTA (no pegada) por
// otra, entre dos usuarios del mismo álbum. Una fila por propuesta. list/view: ambas
// partes (fromUser o toUser) pueden verla; create/update/delete en null — todo pasa
// por rutas dedicadas en album_trades.pb.js vía $app.*, mismo patrón que
// album_stickers y que organization_members/org-invites (organizations.pb.js). El
// select `status` solo llega a persistir "pending" o "accepted": rechazar y cancelar
// son $app.delete directo, nunca se guarda un status "rejected"/"cancelled" — igual
// que organization_members.
migrate((app) => {
    const albums = app.findCollectionByNameOrId("albums");
    const usersColl = app.findCollectionByNameOrId("users");

    const albumTrades = new Collection({
        name: "album_trades",
        type: "base",
        listRule: "@request.auth.id != '' && (fromUser = @request.auth.id || toUser = @request.auth.id)",
        viewRule: "@request.auth.id != '' && (fromUser = @request.auth.id || toUser = @request.auth.id)",
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
                name: "fromUser",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "toUser",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            { name: "offerCode", type: "text", required: true, max: 8 },
            { name: "requestCode", type: "text", required: true, max: 8 },
            {
                name: "status",
                type: "select",
                required: true,
                values: ["pending", "accepted"],
                maxSelect: 1
            },
            { id: "atr_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "atr_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE INDEX idx_album_trades_from_pending ON album_trades (fromUser, status)",
            "CREATE INDEX idx_album_trades_to_pending ON album_trades (toUser, status)"
        ]
    });
    app.save(albumTrades);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("album_trades")); } catch (e) {}
});
