/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    // 1. Racha de Beaudle — vive directo en "users", mismo patrón que karma/beautokens
    // (no es un ladder 1v1, se renderiza como rama especial en LadderDetailScreen.tsx).
    const users = app.findCollectionByNameOrId("users");

    users.fields.add(new Field({
        name: "beaudle_streak",
        type: "number",
        min: 0,
        noDecimal: true,
        required: false
    }));

    users.fields.add(new Field({
        name: "beaudle_best_streak",
        type: "number",
        min: 0,
        noDecimal: true,
        required: false
    }));

    users.fields.add(new Field({
        // Último día (YYYY-MM-DD) en que el usuario completó su Beaudle A TIEMPO (nunca
        // se toca en una partida retroactiva) — es lo que compara computeStreakUpdate en
        // lib/beaudle.js para decidir si la racha sigue o se reinicia.
        name: "beaudle_last_streak_day",
        type: "text",
        required: false
    }));

    app.save(users);

    // 2. beaudle_games — marca si la partida se jugó el mismo día calendario que le
    // correspondía (true) o fue una partida retroactiva de un día pasado (false/no seteado).
    // Solo las partidas on_time otorgan BeauTokens y cuentan para la racha.
    const beaudleGames = app.findCollectionByNameOrId("beaudle_games");
    beaudleGames.fields.add(new Field({
        name: "on_time",
        type: "bool"
    }));
    app.save(beaudleGames);

    // 3. beaudle_daily_stats — numeración de "Beaudle #N", asignada incrementalmente al
    // crear la fila (ver nextDayNumber en lib/beaudle.js), nunca recalculada por fecha.
    const beaudleDailyStats = app.findCollectionByNameOrId("beaudle_daily_stats");
    beaudleDailyStats.fields.add(new Field({
        name: "day_number",
        type: "number",
        min: 1,
        noDecimal: true,
        required: false
    }));
    app.save(beaudleDailyStats);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("beaudle_streak");
    users.fields.removeByName("beaudle_best_streak");
    users.fields.removeByName("beaudle_last_streak_day");
    app.save(users);

    const beaudleGames = app.findCollectionByNameOrId("beaudle_games");
    beaudleGames.fields.removeByName("on_time");
    app.save(beaudleGames);

    const beaudleDailyStats = app.findCollectionByNameOrId("beaudle_daily_stats");
    beaudleDailyStats.fields.removeByName("day_number");
    app.save(beaudleDailyStats);
});
