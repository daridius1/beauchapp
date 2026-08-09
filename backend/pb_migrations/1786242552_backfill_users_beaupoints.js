/// <reference path="../pb_data/types.d.ts" />
// Todo usuario ya existente al momento de lanzar Beaumarket también parte con 100
// BeauPoints (el hook onRecordCreate de beaumarket.pb.js solo cubre cuentas nuevas
// de acá en adelante). Un solo UPDATE masivo: el valor es el mismo para todos, así
// que no hace falta el loop record-por-record que sí necesitó
// backfill_seller_recommendations_count.js (ahí cada fila terminaba en un valor distinto).
migrate((app) => {
  try {
    app.db().newQuery("UPDATE users SET beaupoints = 100 WHERE beaupoints IS NULL OR beaupoints = 0").execute();
  } catch (err) {
    console.error("[migration backfill_users_beaupoints] Error:", err);
  }
}, (app) => {});
