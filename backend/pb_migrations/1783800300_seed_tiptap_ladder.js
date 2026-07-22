/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("ladders");

  const record = new Record(collection, {
    id: "tiptapladder101",
    name: "TipTap",
    slug: "tiptap",
    description: "Competencia oficial de TipTap 1v1 FCFM. Presiona SIGUE para aumentar el pozo o PIERDE para otorgarle el acumulado al rival.",
    max_score: 21,
    allowed_modes: JSON.stringify(["1v1"]),
    is_active: true,
  });

  app.save(record);
}, (app) => {
  try {
    const record = app.findRecordById("ladders", "tiptapladder101");
    app.deleteRecord(record);
  } catch (e) {
    // ignorar si no existe
  }
});
