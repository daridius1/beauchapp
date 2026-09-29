const test = require('node:test');
const assert = require('node:assert/strict');
const {
    NIKITA_SKIN_PRICE,
    NIKITA_SKIN_IDS,
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

test('la recompensa es pequeña, proporcional y tiene un límite', () => {
    assert.equal(nikitaRewardForScore(499), 0);
    assert.equal(nikitaRewardForScore(500), 1);
    assert.equal(nikitaRewardForScore(1499), 1);
    assert.equal(nikitaRewardForScore(1500), 2);
    assert.equal(nikitaRewardForScore(4500), 4);
    assert.equal(nikitaRewardForScore(999999), 8);
});
