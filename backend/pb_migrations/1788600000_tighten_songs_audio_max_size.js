/// <reference path="../pb_data/types.d.ts" />

// El cliente ahora siempre recorta a 30s antes de subir (frontend/src/utils/audioCompressor.ts,
// SONG_CLIP_SECONDS), así que a 96kbps mono el archivo real nunca pasa de ~360KB. Se
// aprieta el límite server-side a 1MB (con margen) en vez del límite viejo pensado para
// canciones completas sin recortar.
migrate((app) => {
  const songs = app.findCollectionByNameOrId("songs");
  const audioField = songs.fields.getByName("audio");
  audioField.maxSize = 1048576; // 1MB
  app.save(songs);
}, (app) => {
  const songs = app.findCollectionByNameOrId("songs");
  const audioField = songs.fields.getByName("audio");
  audioField.maxSize = 9437184; // 9MB
  app.save(songs);
});
