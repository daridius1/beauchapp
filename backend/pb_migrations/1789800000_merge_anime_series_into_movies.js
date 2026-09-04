/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const movies = app.findCollectionByNameOrId("movie_items");

  // Anime y Series se fusionan con Películas en una sola categoría de "Conoce Beauchef":
  // TMDB (themoviedb.org, gratis, sin requisito de cuenta premium — a diferencia de
  // Spotify) cataloga el anime japonés como serie de TV, así que técnicamente ya vive
  // "adentro" de películas+series — no hacía falta una cuarta colección. movie_items pasa
  // a poder representar tanto una película como una serie (mediaType), elegida buscando en
  // TMDB en vez de escribir el título a mano. Los campos viejos (image/director/genero) NO
  // se tocan — quedan para las 2 filas de prueba locales ya creadas, simplemente la
  // pantalla nueva ya no los usa.
  if (!movies.fields.find((f) => f.name === "mediaType")) {
    movies.fields.add(new Field({
      name: "mediaType",
      type: "select",
      values: ["movie", "tv"],
      maxSelect: 1,
      required: false,
    }));
  }
  if (!movies.fields.find((f) => f.name === "tmdbId")) {
    movies.fields.add(new Field({ name: "tmdbId", type: "text", required: false }));
  }
  if (!movies.fields.find((f) => f.name === "posterUrl")) {
    movies.fields.add(new Field({ name: "posterUrl", type: "text", required: false }));
  }
  app.save(movies);

  // Colecciones de Anime y Series: se borran completas (con sus filas de prueba locales,
  // no hay usuarios reales todavía en esta parte de la app). Quien quiera compartir una
  // película o serie de anime ahora lo hace desde Películas.
  ["anime_items", "anime_profiles", "anime_likes", "anime_matches",
   "series_items", "series_profiles", "series_likes", "series_matches"].forEach((name) => {
    const coll = app.findCollectionByNameOrId(name);
    if (coll) app.delete(coll);
  });
}, (app) => {
  const movies = app.findCollectionByNameOrId("movie_items");
  movies.fields.removeByName("mediaType");
  movies.fields.removeByName("tmdbId");
  movies.fields.removeByName("posterUrl");
  app.save(movies);

  // No se recrean anime_*/series_* — mismo motivo que el resto de las migraciones de este
  // proyecto que reshapean colecciones existentes (ver 1789400000_rework_songs_for_match.js):
  // la reversión completa no es reconstruible sin los datos originales.
});
