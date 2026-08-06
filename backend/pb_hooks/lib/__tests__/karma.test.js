const test = require('node:test');
const assert = require('node:assert/strict');
const { karmaDeltaForRating } = require('../karma.js');

test('problema: rating por encima del punto medio (3) suma karma positivo', () => {
    // 2 * (5 - 3) = 4
    assert.equal(karmaDeltaForRating(false, 5, 0), 4);
});

test('problema: rating por debajo del punto medio (3) resta karma', () => {
    // 2 * (1 - 3) = -4
    assert.equal(karmaDeltaForRating(false, 1, 0), -4);
});

test('problema: rating exactamente en 3 no aporta karma', () => {
    assert.equal(karmaDeltaForRating(false, 3, 0), 0);
});

test('problema: difficulty se ignora (solo aplica a pautas)', () => {
    assert.equal(karmaDeltaForRating(false, 5, 5), 4);
});

test('problema: rating = 0 (no calificado) no aporta karma', () => {
    assert.equal(karmaDeltaForRating(false, 0, 5), 0);
});

test('pauta: combina rating y difficulty con peso 1 cada uno', () => {
    // 1 * (5 - 3) + 1 * (4 - 3) = 2 + 1 = 3
    assert.equal(karmaDeltaForRating(true, 5, 4), 3);
});

test('pauta: solo rating calificado (difficulty = 0) aporta solo su parte', () => {
    assert.equal(karmaDeltaForRating(true, 5, 0), 2);
});

test('pauta: solo difficulty calificado (rating = 0) aporta solo su parte', () => {
    assert.equal(karmaDeltaForRating(true, 0, 5), 2);
});

test('pauta: ambos en 0 no aportan karma', () => {
    assert.equal(karmaDeltaForRating(true, 0, 0), 0);
});
