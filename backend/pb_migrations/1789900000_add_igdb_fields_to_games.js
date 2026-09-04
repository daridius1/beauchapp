/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const games = app.findCollectionByNameOrId("game_items");

  // Mismo cambio que Películas con TMDB: la elección deja de ser escribir el título a mano
  // y pasa a buscar en IGDB (Internet Game Database, autenticado vía Twitch — ver
  // IGDB_CLIENT_ID/IGDB_CLIENT_SECRET en .env.example). Los campos viejos
  // (image/director/genero) no se tocan, quedan para lo ya creado.
  if (!games.fields.find((f) => f.name === "igdbId")) {
    games.fields.add(new Field({ name: "igdbId", type: "text", required: false }));
  }
  if (!games.fields.find((f) => f.name === "coverUrl")) {
    games.fields.add(new Field({ name: "coverUrl", type: "text", required: false }));
  }
  app.save(games);
}, (app) => {
  const games = app.findCollectionByNameOrId("game_items");
  games.fields.removeByName("igdbId");
  games.fields.removeByName("coverUrl");
  app.save(games);
});
