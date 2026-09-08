/// <reference path="../pb_data/types.d.ts" />

// Mismo bug latente que se corrigió en 1790800000_fix_match_photo_crop_thumb.js: las
// fotos de producto de marketplace_items.images se suben con aspect ratio libre
// (marketplaceService.ts no fuerza cropToSquare), pero el thumb chico declarado era
// "300x300" — crop al centro. Hoy nada en el frontend lo pide (las pantallas de
// marketplace traen la imagen completa), así que no había recorte visible todavía,
// pero es exactamente la misma trampa: el día que alguien arme un grid de miniaturas
// para la lista de productos y pida ese thumb, recortaría fotos de producto en vez de
// ajustarlas. Se corrige antes de que se use, no después.
migrate((app) => {
    const items = app.findCollectionByNameOrId("marketplace_items");
    const imagesField = items.fields.getByName("images");
    if (imagesField) {
        imagesField.thumbs = ["300x300f", "800x0"];
    }
    app.save(items);
}, (app) => {
    const items = app.findCollectionByNameOrId("marketplace_items");
    const imagesField = items.fields.getByName("images");
    if (imagesField) {
        imagesField.thumbs = ["300x300", "800x0"];
    }
    app.save(items);
});
