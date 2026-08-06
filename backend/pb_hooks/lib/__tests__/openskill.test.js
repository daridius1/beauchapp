const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateOpenSkillUpdate } = require('../openskill.js');

const DEFAULT_MU = 25.0;
const DEFAULT_SIGMA = 8.333333333333334;

function defaultPlayer(userId) {
    return { userId, mu: DEFAULT_MU, sigma: DEFAULT_SIGMA };
}

test('1v1, jugadores nuevos, gana rojo: mu de rojo sube, mu de azul baja', () => {
    const red = [defaultPlayer('r1')];
    const blue = [defaultPlayer('b1')];
    const result = calculateOpenSkillUpdate(red, blue, 'red');

    assert.ok(result.red[0].mu > DEFAULT_MU, 'el mu del ganador debe subir');
    assert.ok(result.blue[0].mu < DEFAULT_MU, 'el mu del perdedor debe bajar');
});

test('1v1, jugadores nuevos, gana azul: es exactamente el espejo de ganar rojo', () => {
    const red = [defaultPlayer('r1')];
    const blue = [defaultPlayer('b1')];
    const redWins = calculateOpenSkillUpdate(red, blue, 'red');
    const blueWins = calculateOpenSkillUpdate(red, blue, 'blue');

    // Ganar como azul debe producir para azul exactamente lo que produce ganar como rojo para rojo
    assert.equal(blueWins.blue[0].mu, redWins.red[0].mu);
    assert.equal(blueWins.red[0].mu, redWins.blue[0].mu);
});

test('1v1, jugadores nuevos, empate: mu se mantiene igual para ambos', () => {
    const red = [defaultPlayer('r1')];
    const blue = [defaultPlayer('b1')];
    const result = calculateOpenSkillUpdate(red, blue, 'draw');

    assert.equal(result.red[0].mu, DEFAULT_MU);
    assert.equal(result.blue[0].mu, DEFAULT_MU);
    assert.equal(result.red[0].mu, result.blue[0].mu);
});

test('sigma siempre se reduce tras un partido (más certeza sobre el nivel del jugador)', () => {
    const red = [defaultPlayer('r1')];
    const blue = [defaultPlayer('b1')];
    const result = calculateOpenSkillUpdate(red, blue, 'red');

    assert.ok(result.red[0].sigma < DEFAULT_SIGMA);
    assert.ok(result.blue[0].sigma < DEFAULT_SIGMA);
});

test('ordinal_rating nunca es negativo', () => {
    // Un jugador con mu muy bajo y sigma bajo podría dar mu - 3*sigma negativo sin el clamp
    const weakPlayer = { userId: 'w1', mu: 5, sigma: 1 };
    const strongPlayer = { userId: 's1', mu: 40, sigma: 1 };
    const result = calculateOpenSkillUpdate([weakPlayer], [strongPlayer], 'blue');

    assert.ok(result.red[0].ordinal_rating >= 0);
    assert.ok(result.blue[0].ordinal_rating >= 0);
});

test('2v2: el equipo completo se actualiza, un jugador por índice', () => {
    const red = [defaultPlayer('r1'), defaultPlayer('r2')];
    const blue = [defaultPlayer('b1'), defaultPlayer('b2')];
    const result = calculateOpenSkillUpdate(red, blue, 'red');

    assert.equal(result.red.length, 2);
    assert.equal(result.blue.length, 2);
    assert.equal(result.red[0].userId, 'r1');
    assert.equal(result.red[1].userId, 'r2');
    // Con mu/sigma iniciales idénticos entre compañeros, ambos deben recibir el mismo cambio
    assert.equal(result.red[0].mu, result.red[1].mu);
});

test('valores de referencia estables para el escenario 1v1 por defecto (gana rojo)', () => {
    // Fija estos valores como "contrato" de la fórmula: si cambian, es una regresión real
    // en el cálculo, no un cambio de refactor. Calculados con la implementación actual.
    const red = [defaultPlayer('r1')];
    const blue = [defaultPlayer('b1')];
    const result = calculateOpenSkillUpdate(red, blue, 'red');

    assert.ok(Math.abs(result.red[0].mu - 29.205222130763318) < 1e-9);
    assert.ok(Math.abs(result.blue[0].mu - 20.794777869236682) < 1e-9);
    assert.equal(result.red[0].ordinal_rating, 7.62);
    assert.equal(result.blue[0].ordinal_rating, 0);
});
