const test = require('node:test');
const assert = require('node:assert/strict');
const {
    ALLIANCE_IDS,
    isAllianceId,
    sanitizeNikitaScore,
    nikitaRunPayload,
    buildAllianceScoreboard,
    normalizeProfessorSearch,
    buildProfessorScoreboard,
    normalizeDisciplineName,
    sanitizeDisciplineName,
    normalizePlacements,
    buildDisciplineList,
    isAllianceAdmin,
} = require('../alliances.js');

test('solo acepta las seis alianzas oficiales', () => {
    ALLIANCE_IDS.forEach((id) => assert.equal(isAllianceId(id), true));
    assert.equal(isAllianceId('otra'), false);
    assert.equal(isAllianceId(''), false);
});

test('normaliza la búsqueda de profesores sin tildes ni puntuación', () => {
    assert.equal(normalizeProfessorSearch('  José I. González-Díaz  '), 'jose i gonzalez diaz');
    assert.equal(normalizeProfessorSearch(''), '');
    assert.equal(normalizeProfessorSearch('a'.repeat(100)).length, 80);
});

test('el marcador de profesores incluye las seis alianzas y ordena por capturas', () => {
    const board = buildProfessorScoreboard([
        { alliance: 'punk', professors: 4 },
        { alliance: 'urbana', professors: 9 },
    ]);
    assert.equal(board[0].alliance, 'urbana');
    assert.equal(board[0].professors, 9);
    assert.deepEqual(board.find((row) => row.alliance === 'pop'), { alliance: 'pop', professors: 0 });
});

test('la firma usa una representación canónica y ligada al usuario', () => {
    assert.equal(
        nikitaRunPayload('user-a', 'run-1', 4294967297, 1234.9),
        'nikita-v1|user-a|run-1|1|1234',
    );
    assert.notEqual(
        nikitaRunPayload('user-a', 'run-1', 1, 1234),
        nikitaRunPayload('user-b', 'run-1', 1, 1234),
    );
});

test('el puntaje queda entero y dentro del rango permitido', () => {
    assert.equal(sanitizeNikitaScore(123.9), 123);
    assert.equal(sanitizeNikitaScore('42'), 42);
    assert.equal(sanitizeNikitaScore(-1), null);
    assert.equal(sanitizeNikitaScore(Number.NaN), null);
    assert.equal(sanitizeNikitaScore(10000001), null);
});

test('el scoreboard incluye alianzas sin jugadores y ordena por puntos', () => {
    const board = buildAllianceScoreboard([
        { alliance: 'rock', points: 20, players: 2 },
        { alliance: 'pop', points: 50, players: 1 },
    ]);
    assert.equal(board.length, 6);
    assert.equal(board[0].alliance, 'pop');
    assert.equal(board[1].alliance, 'rock');
    assert.deepEqual(board.find((row) => row.alliance === 'urbana'), {
        alliance: 'urbana', points: 0, players: 0,
    });
});

test('normaliza y valida nombres de disciplinas', () => {
    assert.equal(normalizeDisciplineName('  Fútbol  7 '), 'futbol 7');
    assert.deepEqual(sanitizeDisciplineName('  Tenis de mesa  '), {
        name: 'Tenis de mesa', normalizedName: 'tenis de mesa',
    });
    assert.equal(sanitizeDisciplineName('x'), null);
});

test('acepta lugares parciales sin repetir posiciones', () => {
    assert.deepEqual(normalizePlacements({ rock: 2, pop: 1, punk: '' }), [
        { alliance: 'pop', place: 1 },
        { alliance: 'rock', place: 2 },
    ]);
    assert.equal(normalizePlacements({ rock: 1, pop: 1 }), null);
    assert.equal(normalizePlacements({ rock: 7 }), null);
    assert.equal(normalizePlacements({ otra: 1 }), null);
});

test('agrupa resultados de disciplinas y omite lugares inválidos', () => {
    assert.deepEqual(buildDisciplineList([
        { id: 'd1', name: 'Fútbol', alliance: 'rock', place: 2 },
        { id: 'd1', name: 'Fútbol', alliance: 'pop', place: 1 },
        { id: 'd2', name: 'Ajedrez', alliance: '', place: 0 },
    ]), [
        {
            id: 'd1', name: 'Fútbol', placements: [
                { alliance: 'pop', place: 1 },
                { alliance: 'rock', place: 2 },
            ],
        },
        { id: 'd2', name: 'Ajedrez', placements: [] },
    ]);
});

test('solo la cuenta center CEIuchile administra las alianzas', () => {
    assert.equal(isAllianceAdmin('organization', 'center', 'CEIuchile'), true);
    assert.equal(isAllianceAdmin('organization', 'center', 'ceiuchile'), true);
    assert.equal(isAllianceAdmin('organization', 'center', 'otro-centro'), false);
    assert.equal(isAllianceAdmin('organization', 'alliance', 'CEIuchile'), false);
    assert.equal(isAllianceAdmin('student', 'center', 'CEIuchile'), false);
});
