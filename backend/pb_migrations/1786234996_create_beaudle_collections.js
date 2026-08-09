/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");

    // 1. beaudle_games — el progreso de UN usuario en el Beaudle de UN día (y variante).
    // Todas las escrituras pasan por backend/pb_hooks/beaudle.pb.js (createRule/updateRule/
    // deleteRule = null cierran la puerta a que un cliente cree/edite su propia partida por
    // REST directo — $app.save() desde el hook ignora estas reglas).
    const beaudleGames = new Collection({
        name: "beaudle_games",
        type: "base",
        listRule: "@request.auth.id != '' && @request.auth.id = user",
        viewRule: "@request.auth.id != '' && @request.auth.id = user",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "user",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "day",
                type: "text",
                required: true,
                pattern: "^\\d{4}-\\d{2}-\\d{2}$"
            },
            {
                name: "variant",
                type: "text",
                required: true,
                pattern: "^[a-z_]+$"
            },
            {
                name: "status",
                type: "select",
                required: true,
                maxSelect: 1,
                values: ["in_progress", "won", "lost"]
            },
            {
                name: "guesses",
                type: "json",
                required: false,
                maxSize: 20000
            },
            {
                name: "solvedAtGuess",
                type: "number",
                required: false,
                min: 1,
                max: 6,
                noDecimal: true
            },
            {
                // Solo se rellena cuando status deja de ser "in_progress" (ver
                // backend/pb_hooks/beaudle.pb.js) — nunca mientras la partida sigue en curso.
                name: "revealed_code",
                type: "text",
                required: false
            },
            {
                id: "bdg_crea_01",
                name: "created",
                type: "autodate",
                onCreate: true,
                onUpdate: false
            },
            {
                id: "bdg_upd_01",
                name: "updated",
                type: "autodate",
                onCreate: true,
                onUpdate: true
            }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_beaudle_games_user_day_variant ON beaudle_games (user, day, variant)",
            "CREATE INDEX idx_beaudle_games_day_variant_status ON beaudle_games (day, variant, status)"
        ]
    });
    app.save(beaudleGames);

    // 2. beaudle_daily_stats — contadores agregados por (día, variante). Nunca guarda el
    // ramo secreto, por eso puede ser legible por cualquier usuario logueado.
    const beaudleDailyStats = new Collection({
        name: "beaudle_daily_stats",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "day",
                type: "text",
                required: true,
                pattern: "^\\d{4}-\\d{2}-\\d{2}$"
            },
            {
                name: "variant",
                type: "text",
                required: true,
                pattern: "^[a-z_]+$"
            },
            {
                // required:false a propósito — un número requerido en 0 falla la
                // validación "cannot be blank" en este runtime de PocketBase (mismo
                // motivo por el que recommendations_count en marketplace tampoco es
                // required).
                name: "players_count",
                type: "number",
                required: false,
                min: 0,
                noDecimal: true
            },
            {
                name: "solved_count",
                type: "number",
                required: false,
                min: 0,
                noDecimal: true
            },
            {
                // { "1": n, "2": n, "3": n, "4": n, "5": n, "6": n, "failed": n }
                name: "guess_distribution",
                type: "json",
                required: false,
                maxSize: 5000
            },
            {
                id: "bds_crea_01",
                name: "created",
                type: "autodate",
                onCreate: true,
                onUpdate: false
            },
            {
                id: "bds_upd_01",
                name: "updated",
                type: "autodate",
                onCreate: true,
                onUpdate: true
            }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_beaudle_daily_stats_day_variant ON beaudle_daily_stats (day, variant)"
        ]
    });
    app.save(beaudleDailyStats);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("beaudle_daily_stats")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("beaudle_games")); } catch (e) {}
});
