/// <reference path="../pb_data/types.d.ts" />

// Hook para mantener recommendations_count en seller_profiles de forma incremental.
// Antes se calculaba en vivo (una consulta extra a seller_recommendations por cada perfil
// de vendedor mostrado en cualquier listado). Con esto el dato llega listo en el propio
// registro de seller_profiles y el frontend no necesita esa consulta aparte.
// Mismo patrón (onRecordCreateRequest/onRecordDeleteRequest, síncrono) que activities.pb.js.

onRecordCreateRequest((e) => {
    try {
        const sellerId = e.record.getString("seller");
        if (!sellerId) return e.next();

        try {
            const sellerRec = $app.findRecordById("seller_profiles", sellerId);
            const current = sellerRec.getInt("recommendations_count") || 0;
            sellerRec.set("recommendations_count", current + 1);
            $app.save(sellerRec);
        } catch (err) {
            console.error(`[marketplace.pb.js] Error incrementando recommendations_count para vendedor ${sellerId}:`, err);
        }
    } catch (outerErr) {
        console.error("[marketplace.pb.js] Outer error in seller_recommendations create:", outerErr);
    }
    return e.next();
}, "seller_recommendations");

onRecordDeleteRequest((e) => {
    try {
        const sellerId = e.record.getString("seller");
        if (!sellerId) return e.next();

        try {
            const sellerRec = $app.findRecordById("seller_profiles", sellerId);
            const current = sellerRec.getInt("recommendations_count") || 0;
            sellerRec.set("recommendations_count", Math.max(0, current - 1));
            $app.save(sellerRec);
        } catch (err) {
            console.error(`[marketplace.pb.js] Error decrementando recommendations_count para vendedor ${sellerId}:`, err);
        }
    } catch (outerErr) {
        console.error("[marketplace.pb.js] Outer error in seller_recommendations delete:", outerErr);
    }
    return e.next();
}, "seller_recommendations");
