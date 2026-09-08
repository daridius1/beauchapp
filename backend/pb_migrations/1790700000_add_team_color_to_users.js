/// <reference path="../pb_data/types.d.ts" />

// Color de equipo: se usa para pintar la lámina de esa cuenta en el álbum de figuritas
// (ver album.pb.js / LeagueAlbumScreen.tsx). Paleta curada como `select` (no un campo
// de texto libre) para que cualquier color elegido garantice buen contraste con el
// texto blanco que va encima en la lámina — la lista de valores acá tiene que ser
// IDÉNTICA, carácter por carácter, a `TEAM_COLORS` en
// frontend/src/constants/teamColors.ts (mismo patrón de duplicación documentada que
// matchEvents.ts/.js: son runtimes distintos, no hay forma de compartir el archivo).
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new Field({
        name: "teamColor",
        type: "select",
        values: [
            "#DC2626", "#EA580C", "#D97706", "#CA8A04",
            "#65A30D", "#16A34A", "#059669", "#0D9488",
            "#0891B2", "#2563EB", "#4F46E5", "#7C3AED",
            "#9333EA", "#C026D3", "#DB2777", "#57534E",
        ],
        maxSelect: 1,
        required: false,
    }));
    app.save(users);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("teamColor");
    app.save(users);
});
