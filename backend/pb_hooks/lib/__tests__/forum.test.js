const test = require('node:test');
const assert = require('node:assert/strict');
const { esTargetInexistente, targetCollectionOf } = require('../forum.js');

test('esTargetInexistente: reconoce el mensaje de PocketBase para un id inexistente', () => {
    assert.equal(esTargetInexistente(new Error('sql: no rows in result set')), true);
});

test('esTargetInexistente: cualquier otro error no cuenta como target inexistente', () => {
    assert.equal(esTargetInexistente(new Error('constraint failed')), false);
    assert.equal(esTargetInexistente(new Error('')), false);
});

test('targetCollectionOf: mapea cada targetType conocido a su colección real', () => {
    assert.equal(targetCollectionOf('problem'), 'problems');
    assert.equal(targetCollectionOf('match'), 'ladder_matches');
    assert.equal(targetCollectionOf('league_match'), 'league_matches');
    assert.equal(targetCollectionOf('activity'), 'activities');
    assert.equal(targetCollectionOf('course'), 'courses');
    assert.equal(targetCollectionOf('beaumarket'), 'beaumarkets');
    assert.equal(targetCollectionOf('beaudle'), 'beaudle_daily_stats');
    assert.equal(targetCollectionOf('pet'), 'pets');
    assert.equal(targetCollectionOf('song'), 'songs');
});

test('targetCollectionOf: cualquier targetType no listado (incluido "post") cae a "posts"', () => {
    assert.equal(targetCollectionOf('post'), 'posts');
    assert.equal(targetCollectionOf('algo_nuevo_sin_mapear'), 'posts');
    assert.equal(targetCollectionOf(undefined), 'posts');
});
