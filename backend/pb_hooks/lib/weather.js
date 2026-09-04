// Lógica pura (sin `$app`/`$http`) para la fuente de clima de /admin/noticias. Todos los
// partidos de liga se juegan en el campus Beauchef (FCFM, Universidad de Chile) — coordenadas
// aproximadas del campus, suficiente para un dato de clima diario (no varían de forma
// relevante en pocos km dentro de Santiago). Ajustar acá si hace falta más precisión.
const BEAUCHEF_LAT = -33.4589;
const BEAUCHEF_LON = -70.6628;

// Códigos WMO de la API de Open-Meteo (https://open-meteo.com/en/docs/historical-weather-api,
// tabla "WMO Weather interpretation codes").
const WEATHER_CODE_LABELS = {
    0: "Despejado",
    1: "Mayormente despejado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Neblina",
    48: "Neblina con escarcha",
    51: "Llovizna débil",
    53: "Llovizna",
    55: "Llovizna intensa",
    56: "Llovizna helada",
    57: "Llovizna helada intensa",
    61: "Lluvia débil",
    63: "Lluvia",
    65: "Lluvia intensa",
    66: "Lluvia helada",
    67: "Lluvia helada intensa",
    71: "Nieve débil",
    73: "Nieve",
    75: "Nieve intensa",
    77: "Granizo fino",
    80: "Chubascos débiles",
    81: "Chubascos",
    82: "Chubascos intensos",
    85: "Chubascos de nieve débiles",
    86: "Chubascos de nieve intensos",
    95: "Tormenta eléctrica",
    96: "Tormenta eléctrica con granizo",
    99: "Tormenta eléctrica con granizo intenso",
};

function weatherCodeLabel(code) {
    return WEATHER_CODE_LABELS[code] || "Condición desconocida";
}

// "2026-07-26-13" (blockCode de league_matches, "YYYY-MM-DD-HH") -> "2026-07-26".
function dateFromBlockCode(blockCode) {
    if (!blockCode || blockCode.length < 13) return "";
    return blockCode.slice(0, -3);
}

// URL de la API pública e histórica de Open-Meteo (sin API key) para un día puntual en
// el campus Beauchef. "archive-api" trae reanálisis histórico — tiene unos días de rezago,
// así que una fecha muy reciente puede no tener datos todavía (ver parseOpenMeteoDaily).
function buildOpenMeteoUrl(date) {
    return "https://archive-api.open-meteo.com/v1/archive"
        + "?latitude=" + BEAUCHEF_LAT + "&longitude=" + BEAUCHEF_LON
        + "&start_date=" + date + "&end_date=" + date
        + "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode"
        + "&timezone=America%2FSantiago";
}

// Extrae el único punto diario de la respuesta de Open-Meteo. Devuelve null si la API no
// trae datos para esa fecha (fecha muy futura, fuera del rango histórico, etc.) — nunca
// tira una excepción por esto, porque el clima es un dato opcional, no crítico.
function parseOpenMeteoDaily(json) {
    const daily = json && json.daily;
    if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) return null;
    const tempMaxC = daily.temperature_2m_max && daily.temperature_2m_max[0];
    const tempMinC = daily.temperature_2m_min && daily.temperature_2m_min[0];
    const precipitationMm = daily.precipitation_sum && daily.precipitation_sum[0];
    const weatherCode = daily.weathercode && daily.weathercode[0];
    if (tempMaxC == null || tempMinC == null) return null;
    return { tempMaxC, tempMinC, precipitationMm: precipitationMm || 0, weatherCode };
}

function buildWeatherSummary({ tempMaxC, tempMinC, precipitationMm, weatherCode }) {
    const label = weatherCodeLabel(weatherCode);
    const rain = precipitationMm > 0 ? `${precipitationMm} mm de lluvia` : "sin lluvia";
    return `${label}, ${tempMaxC}°C máx / ${tempMinC}°C mín, ${rain}.`;
}

module.exports = {
    BEAUCHEF_LAT,
    BEAUCHEF_LON,
    weatherCodeLabel,
    dateFromBlockCode,
    buildOpenMeteoUrl,
    parseOpenMeteoDaily,
    buildWeatherSummary,
};
