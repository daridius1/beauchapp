/// <reference path="../pb_data/types.d.ts" />

// Se sube el bitrate objetivo de compresión de audio en el cliente de 64 a 96kbps
// (frontend/src/utils/audioCompressor.ts, probando cómo queda la calidad). El límite de
// peso server-side se reescala proporcionalmente para seguir cubriendo la misma duración
// máxima razonable (~12 minutos).
migrate((app) => {
  const songs = app.findCollectionByNameOrId("songs");
  const audioField = songs.fields.getByName("audio");
  audioField.maxSize = 9437184; // 9MB
  app.save(songs);
}, (app) => {
  const songs = app.findCollectionByNameOrId("songs");
  const audioField = songs.fields.getByName("audio");
  audioField.maxSize = 6291456; // 6MB
  app.save(songs);
});
