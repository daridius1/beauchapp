/// <reference path="../pb_data/types.d.ts" />

// Suma blanco y gris oscuro a la paleta de color de equipo (1790700000_add_team_color_to_users.js).
// No pura #FFFFFF/#000000: un equipo pinta fondos completos con su color (shadeHex en
// teamColors.ts), así que blanco puro deslumbra contra el resto de la app oscura y
// negro puro se vuelve invisible contra el propio fondo/bordes casi negros de la UI
// (theme.colors.background/border). #F5F5F4 y #44403C son el blanco/gris más extremos
// que siguen leyéndose como "color propio" sin fundirse con el chrome de la app — la
// lista acá tiene que seguir siendo IDÉNTICA, carácter por carácter, a `TEAM_COLORS`
// en frontend/src/constants/teamColors.ts.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    const teamColorField = users.fields.getByName("teamColor");
    teamColorField.values = [
        "#DC2626", "#EA580C", "#D97706", "#CA8A04",
        "#65A30D", "#16A34A", "#059669", "#0D9488",
        "#0891B2", "#2563EB", "#4F46E5", "#7C3AED",
        "#9333EA", "#C026D3", "#DB2777", "#57534E",
        "#F5F5F4", "#44403C",
    ];
    app.save(users);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    const teamColorField = users.fields.getByName("teamColor");
    teamColorField.values = [
        "#DC2626", "#EA580C", "#D97706", "#CA8A04",
        "#65A30D", "#16A34A", "#059669", "#0D9488",
        "#0891B2", "#2563EB", "#4F46E5", "#7C3AED",
        "#9333EA", "#C026D3", "#DB2777", "#57534E",
    ];
    app.save(users);
});
