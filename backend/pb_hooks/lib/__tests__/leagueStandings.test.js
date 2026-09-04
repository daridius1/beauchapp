const test = require('node:test');
const assert = require('node:assert/strict');
const { computeStandings, previousResult } = require('../leagueStandings.js');

test('computeStandings: 3 puntos por victoria, 1 por empate, 0 por derrota', () => {
    const matches = [
        { teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 0, status: 'played' },
        { teamA: 'A', teamB: 'C', scoreA: 1, scoreB: 1, status: 'played' },
        { teamA: 'B', teamB: 'C', scoreA: 0, scoreB: 3, status: 'played' },
    ];
    const table = computeStandings(['A', 'B', 'C'], matches);
    const byId = Object.fromEntries(table.map((r) => [r.teamId, r]));
    assert.equal(byId.A.pts, 4); // 3 + 1
    assert.equal(byId.B.pts, 0); // 0 + 0
    assert.equal(byId.C.pts, 4); // 1 + 3
});

test('computeStandings: ignora partidos no jugados', () => {
    const matches = [{ teamA: 'A', teamB: 'B', scoreA: 5, scoreB: 0, status: 'confirmed' }];
    const table = computeStandings(['A', 'B'], matches);
    table.forEach((r) => assert.equal(r.pj, 0));
});

test('computeStandings: ordena por puntos, luego diferencia de gol, luego goles a favor', () => {
    const matches = [
        { teamA: 'A', teamB: 'X', scoreA: 5, scoreB: 0, status: 'played' }, // A: 3pts, dif +5
        { teamA: 'B', teamB: 'Y', scoreA: 1, scoreB: 0, status: 'played' }, // B: 3pts, dif +1
        { teamA: 'C', teamB: 'Z', scoreA: 3, scoreB: 1, status: 'played' }, // C: 3pts, dif +2
    ];
    const table = computeStandings(['A', 'B', 'C', 'X', 'Y', 'Z'], matches);
    const order = table.filter((r) => ['A', 'B', 'C'].includes(r.teamId)).map((r) => r.teamId);
    assert.deepEqual(order, ['A', 'C', 'B']);
});

test('computeStandings: asigna la posición 1-based según el orden final', () => {
    const matches = [{ teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 0, status: 'played' }];
    const table = computeStandings(['A', 'B'], matches);
    assert.equal(table.find((r) => r.teamId === 'A').position, 1);
    assert.equal(table.find((r) => r.teamId === 'B').position, 2);
});

test('computeStandings: gf/gc/dif se acumulan correctamente para ambos lados de cada partido', () => {
    const matches = [{ teamA: 'A', teamB: 'B', scoreA: 4, scoreB: 2, status: 'played' }];
    const table = computeStandings(['A', 'B'], matches);
    const a = table.find((r) => r.teamId === 'A');
    const b = table.find((r) => r.teamId === 'B');
    assert.deepEqual([a.gf, a.gc, a.dif], [4, 2, 2]);
    assert.deepEqual([b.gf, b.gc, b.dif], [2, 4, -2]);
});

test('previousResult: encuentra el último partido jugado antes de un blockCode', () => {
    const matches = [
        { teamA: 'A', teamB: 'X', scoreA: 1, scoreB: 0, status: 'played', blockCode: '2026-07-01-10' },
        { teamA: 'A', teamB: 'Y', scoreA: 0, scoreB: 2, status: 'played', blockCode: '2026-07-15-10' },
    ];
    const result = previousResult('A', matches, '2026-07-26-13');
    assert.equal(result.result, 'loss');
    assert.equal(result.opponentId, 'Y');
    assert.equal(result.blockCode, '2026-07-15-10');
});

test('previousResult: ignora partidos posteriores al blockCode de referencia', () => {
    const matches = [{ teamA: 'A', teamB: 'X', scoreA: 3, scoreB: 0, status: 'played', blockCode: '2026-08-01-10' }];
    assert.equal(previousResult('A', matches, '2026-07-26-13'), null);
});

test('previousResult: null si el equipo debuta (no hay partidos jugados previos)', () => {
    assert.equal(previousResult('A', [], '2026-07-26-13'), null);
});

test('previousResult: funciona igual si el equipo jugó como local o como visita', () => {
    const matches = [{ teamA: 'X', teamB: 'A', scoreA: 1, scoreB: 3, status: 'played', blockCode: '2026-07-01-10' }];
    const result = previousResult('A', matches, '2026-07-26-13');
    assert.equal(result.result, 'win');
    assert.equal(result.gf, 3);
    assert.equal(result.gc, 1);
    assert.equal(result.opponentId, 'X');
});
