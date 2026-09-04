/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");
    const matchesColl = app.findCollectionByNameOrId("league_matches");

    // news — noticias generadas (con ayuda de IA) por una cuenta de organización
    // subtype=media. Se escribe solo desde $app en news.pb.js (create/update/delete en
    // null), nunca vía API REST directa, mismo criterio que league_matches. `status`
    // distingue el borrador que se está editando en el panel de la publicación real.
    const news = new Collection({
        name: "news",
        type: "base",
        listRule: "(status = 'published' && deleted = false) || @request.auth.id = author",
        viewRule: "(status = 'published' && deleted = false) || @request.auth.id = author",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "title",
                type: "text",
                required: true,
                max: 200
            },
            {
                name: "body",
                type: "text",
                required: true,
                max: 20000
            },
            {
                name: "coverImage",
                type: "file",
                required: false,
                maxSelect: 1,
                maxSize: 5242880,
                mimeTypes: ["image/jpeg", "image/png", "image/webp"]
            },
            {
                name: "author",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                // Nullable a propósito: deja la puerta abierta a noticias no ligadas a
                // un partido específico más adelante, sin construir nada de eso ahora.
                name: "relatedMatch",
                type: "relation",
                required: false,
                collectionId: matchesColl.id,
                cascadeDelete: false,
                maxSelect: 1
            },
            {
                name: "status",
                type: "select",
                required: true,
                maxSelect: 1,
                values: ["draft", "published"]
            },
            {
                // Qué categorías de datos se tildaron para generarla (declaraciones,
                // informe arbitral, comentarios, etc.) — barato de guardar y sirve para
                // mostrar transparencia tipo "basado en declaraciones e informe arbitral".
                name: "sourcesUsed",
                type: "json",
                required: false,
                maxSize: 2000
            },
            {
                name: "deleted",
                type: "bool",
                required: false,
                presentable: false
            },
            { id: "nws_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "nws_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE INDEX idx_news_author ON news (author)",
            "CREATE INDEX idx_news_related_match ON news (relatedMatch)"
        ]
    });
    app.save(news);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("news")); } catch (e) {}
});
