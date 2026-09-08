/// <reference path="../pb_data/types.d.ts" />

// Paleta de 3 colores por álbum (ej. Copa CDI: negro, rojo y un tercero) — la elige el
// superusuario desde /admin/album (admin_album.pb.js) y LeagueAlbumScreen.tsx la usa
// para la textura de fondo de las páginas y el marco del "libro", NO para las láminas
// de cada equipo (esas siempre las pinta el color propio del equipo, ver
// 1790700000_add_team_color_to_users.js — incluso comparte la MISMA lista de valores,
// para que cualquier combinación se vea bien). Los 3 campos son independientes (no un
// solo campo con 3 valores) porque cada uno cumple un rol fijo y distinto en el diseño
// (base de la textura, color secundario de la textura, marco/acento) — separarlos deja
// esa asignación explícita en el propio schema en vez de depender del orden de un array.
migrate((app) => {
    const albums = app.findCollectionByNameOrId("albums");
    const PALETTE_VALUES = [
        "#DC2626", "#EA580C", "#D97706", "#CA8A04",
        "#65A30D", "#16A34A", "#059669", "#0D9488",
        "#0891B2", "#2563EB", "#4F46E5", "#7C3AED",
        "#9333EA", "#C026D3", "#DB2777", "#57534E",
        "#000000", "#FFFFFF",
    ];
    ["paletteColor1", "paletteColor2", "paletteColor3"].forEach((name) => {
        albums.fields.add(new Field({
            name,
            type: "select",
            values: PALETTE_VALUES,
            maxSelect: 1,
            required: false,
        }));
    });
    app.save(albums);
}, (app) => {
    const albums = app.findCollectionByNameOrId("albums");
    ["paletteColor1", "paletteColor2", "paletteColor3"].forEach((name) => {
        albums.fields.removeByName(name);
    });
    app.save(albums);
});
