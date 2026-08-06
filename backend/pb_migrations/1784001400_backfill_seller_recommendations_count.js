/// <reference path="../pb_data/types.d.ts" />

// Recalcula recommendations_count de una vez para todos los seller_profiles existentes,
// a partir del conteo real de seller_recommendations. De ahí en adelante lo mantiene al día
// el hook incremental de marketplace.pb.js (evita que quede desincronizado del historial real).
migrate((app) => {
  const sellerProfiles = app.findRecordsByFilter("seller_profiles", "", "-created", 0, 0);

  for (const profile of sellerProfiles) {
    try {
      const recs = app.findRecordsByFilter(
        "seller_recommendations",
        "seller = {:id}",
        "", 0, 0,
        { id: profile.id }
      );
      profile.set("recommendations_count", recs.length);
      app.save(profile);
    } catch (err) {
      console.error(`[backfill_seller_recommendations_count] Error en perfil ${profile.id}:`, err);
    }
  }
}, (app) => {});
