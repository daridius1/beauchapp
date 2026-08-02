/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const tacaTacaRecords = app.findRecordsByFilter("ladders", "slug ~ 'taca-taca'", "-created", 100);
    for (let i = 0; i < tacaTacaRecords.length; i++) {
      const rec = tacaTacaRecords[i];
      rec.set("max_score", 10);
      app.save(rec);
    }
  } catch (e) {
    console.log("Error updating taca-taca max_score:", e);
  }
}, (app) => {
  // rollback
});
