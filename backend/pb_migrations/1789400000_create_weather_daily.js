/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // weather_daily — caché del clima del campus Beauchef por fecha (no por partido:
    // todos los partidos de liga se juegan en el mismo lugar, así que varios partidos el
    // mismo día comparten una sola fila y un solo llamado a la API pública de Open-Meteo).
    // Se llena de forma perezosa desde news.pb.js (GET del clima al elegir un partido, o
    // al generar la noticia) — nunca se llama a Open-Meteo dos veces para la misma fecha.
    const weatherDaily = new Collection({
        name: "weather_daily",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "date",
                type: "text",
                required: true,
                max: 10
            },
            { name: "tempMaxC", type: "number", required: false },
            { name: "tempMinC", type: "number", required: false },
            { name: "precipitationMm", type: "number", required: false },
            { name: "weatherCode", type: "number", required: false },
            {
                name: "summary",
                type: "text",
                required: false,
                max: 300
            },
            { id: "wdl_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "wdl_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_weather_daily_date ON weather_daily (date)"
        ]
    });
    app.save(weatherDaily);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("weather_daily")); } catch (e) {}
});
