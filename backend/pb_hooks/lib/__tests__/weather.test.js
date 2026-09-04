const test = require('node:test');
const assert = require('node:assert/strict');
const { weatherCodeLabel, dateFromBlockCode, buildOpenMeteoUrl, parseOpenMeteoDaily, buildWeatherSummary } = require('../weather.js');

test('weatherCodeLabel: mapea códigos WMO conocidos', () => {
    assert.equal(weatherCodeLabel(0), 'Despejado');
    assert.equal(weatherCodeLabel(63), 'Lluvia');
    assert.equal(weatherCodeLabel(95), 'Tormenta eléctrica');
});

test('weatherCodeLabel: código desconocido no revienta', () => {
    assert.equal(weatherCodeLabel(999), 'Condición desconocida');
    assert.equal(weatherCodeLabel(undefined), 'Condición desconocida');
});

test('dateFromBlockCode: extrae la fecha del blockCode de league_matches', () => {
    assert.equal(dateFromBlockCode('2026-07-26-13'), '2026-07-26');
    assert.equal(dateFromBlockCode('2026-01-05-08'), '2026-01-05');
});

test('dateFromBlockCode: blockCode vacío o corto no revienta', () => {
    assert.equal(dateFromBlockCode(''), '');
    assert.equal(dateFromBlockCode(undefined), '');
    assert.equal(dateFromBlockCode('2026-07-26'), '');
});

test('buildOpenMeteoUrl: incluye coordenadas de Beauchef y la fecha pedida', () => {
    const url = buildOpenMeteoUrl('2026-07-26');
    assert.match(url, /archive-api\.open-meteo\.com/);
    assert.match(url, /start_date=2026-07-26&end_date=2026-07-26/);
    assert.match(url, /latitude=-33\.4589/);
});

test('parseOpenMeteoDaily: extrae el único punto diario de una respuesta válida', () => {
    const json = {
        daily: {
            time: ['2026-07-26'],
            temperature_2m_max: [18.5],
            temperature_2m_min: [4.2],
            precipitation_sum: [0],
            weathercode: [1],
        },
    };
    assert.deepEqual(parseOpenMeteoDaily(json), { tempMaxC: 18.5, tempMinC: 4.2, precipitationMm: 0, weatherCode: 1 });
});

test('parseOpenMeteoDaily: precipitación ausente cuenta como 0, no como null', () => {
    const json = { daily: { time: ['2026-07-26'], temperature_2m_max: [20], temperature_2m_min: [10], precipitation_sum: [null], weathercode: [0] } };
    assert.equal(parseOpenMeteoDaily(json).precipitationMm, 0);
});

test('parseOpenMeteoDaily: sin datos para la fecha (archivo histórico no la cubre todavía) da null', () => {
    assert.equal(parseOpenMeteoDaily({ daily: { time: [] } }), null);
    assert.equal(parseOpenMeteoDaily({}), null);
    assert.equal(parseOpenMeteoDaily(null), null);
});

test('buildWeatherSummary: sin lluvia', () => {
    const summary = buildWeatherSummary({ tempMaxC: 22, tempMinC: 8, precipitationMm: 0, weatherCode: 0 });
    assert.equal(summary, 'Despejado, 22°C máx / 8°C mín, sin lluvia.');
});

test('buildWeatherSummary: con lluvia incluye los milímetros', () => {
    const summary = buildWeatherSummary({ tempMaxC: 14, tempMinC: 9, precipitationMm: 5.2, weatherCode: 63 });
    assert.equal(summary, 'Lluvia, 14°C máx / 9°C mín, 5.2 mm de lluvia.');
});
