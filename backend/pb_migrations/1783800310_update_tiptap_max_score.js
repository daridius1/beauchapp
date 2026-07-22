/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const record = app.findRecordById("ladders", "tiptapladder101");
    record.set("max_score", 30);
    app.save(record);
  } catch (e) {
    // ignorar si no existe
  }
}, (app) => {
  // rollback
});
