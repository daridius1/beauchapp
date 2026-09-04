/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const songs = app.findCollectionByNameOrId("songs");

  // La elección y reproducción de canciones pasan a apoyarse en el catálogo de Spotify
  // (buscar y elegir una pista real) en vez de subir un archivo propio ya recortado. Los
  // campos "audio"/"cover" existentes NO se tocan — quedan como estaban para las filas ya
  // creadas antes de este cambio (dato real de prueba en local), simplemente la pantalla
  // nueva ya no los usa para ítems elegidos por Spotify.
  if (!songs.fields.find((f) => f.name === "spotifyTrackId")) {
    songs.fields.add(new Field({
      name: "spotifyTrackId",
      type: "text",
      required: false,
    }));
  }
  if (!songs.fields.find((f) => f.name === "spotifyImageUrl")) {
    songs.fields.add(new Field({
      name: "spotifyImageUrl",
      type: "text",
      required: false,
    }));
  }
  app.save(songs);
}, (app) => {
  const songs = app.findCollectionByNameOrId("songs");
  songs.fields.removeByName("spotifyTrackId");
  songs.fields.removeByName("spotifyImageUrl");
  app.save(songs);
});
