const test = require('node:test');
const assert = require('node:assert/strict');
const {
    NIKITA_SKIN_PRICE,
    NIKITA_SKIN_IDS,
    NIKITA_REWARD_MIN_SCORE,
    isNikitaSkinId,
    nikitaRewardForScore,
} = require('../nikitaSkins.js');

test('el catálogo contiene las 22 skins y todas cuestan 50 Beautokens', () => {
    assert.equal(NIKITA_SKIN_IDS.length, 22);
    assert.equal(new Set(NIKITA_SKIN_IDS).size, 22);
    assert.equal(NIKITA_SKIN_PRICE, 50);
    assert.equal(isNikitaSkinId('computacion'), true);
    assert.equal(isNikitaSkinId('inventada'), false);
});

test('la recompensa conserva los hitos de distancia bajo la curva nueva', () => {
    assert.equal(NIKITA_REWARD_MIN_SCORE, 283);
    assert.equal(nikitaRewardForScore(282), 0);
    assert.equal(nikitaRewardForScore(283), 1);
    assert.equal(nikitaRewardForScore(1084), 1);
    assert.equal(nikitaRewardForScore(1085), 2);
    assert.equal(nikitaRewardForScore(3967), 4);
    assert.equal(nikitaRewardForScore(999999), 8);
});
