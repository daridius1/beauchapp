/// <reference path="../pb_data/types.d.ts" />

// Hook para el autoconteo de Likes en la colección "pets".
// Mismo patrón que activities.pb.js: síncrono (onRecordCreateRequest/onRecordDeleteRequest,
// antes de que la respuesta HTTP salga) para que un GET inmediato del cliente no lea el
// contador desactualizado.

onRecordCreateRequest((e) => {
    try {
        const petId = e.record.getString("pet");
        if (!petId) return e.next();

        try {
            const petRec = $app.findRecordById("pets", petId);
            const currentLikes = petRec.getInt("like_count") || 0;
            petRec.set("like_count", currentLikes + 1);
            $app.save(petRec);
        } catch (err) {
            console.error(`[pets.pb.js] Error incrementando like_count para mascota ${petId}:`, err);
        }
    } catch (outerErr) {
        console.error("[pets.pb.js] Outer error in pet_likes create:", outerErr);
    }
    return e.next();
}, "pet_likes");

onRecordDeleteRequest((e) => {
    try {
        const petId = e.record.getString("pet");
        if (!petId) return e.next();

        try {
            const petRec = $app.findRecordById("pets", petId);
            const currentLikes = petRec.getInt("like_count") || 0;
            petRec.set("like_count", Math.max(0, currentLikes - 1));
            $app.save(petRec);
        } catch (err) {
            console.error(`[pets.pb.js] Error decrementando like_count para mascota ${petId}:`, err);
        }
    } catch (outerErr) {
        console.error("[pets.pb.js] Outer error in pet_likes delete:", outerErr);
    }
    return e.next();
}, "pet_likes");
