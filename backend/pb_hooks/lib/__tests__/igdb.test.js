const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSearchResults } = require('../igdb.js');

test('parseSearchResults: mapea juegos válidos con año y carátula', () => {
    const items = [
        { id: 1942, name: 'The Witcher 3: Wild Hunt', first_release_date: 1431993600, cover: { id: 99, image_id: 'co1wyy' } },
    ];
    assert.deepEqual(parseSearchResults(items), [
        { id: '1942', name: 'The Witcher 3: Wild Hunt', year: 2015, coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg' },
    ]);
});

test('parseSearchResults: sin first_release_date o sin cover no explota', () => {
    const items = [{ id: 1, name: 'Sin fecha ni carátula' }];
    assert.deepEqual(parseSearchResults(items), [
        { id: '1', name: 'Sin fecha ni carátula', year: null, coverUrl: '' },
    ]);
});

test('parseSearchResults: descarta items sin id o sin name', () => {
    assert.deepEqual(parseSearchResults([{ name: 'Sin id' }, { id: 5 }]), []);
});

test('parseSearchResults: respuestas vacías o inválidas no explotan', () => {
    assert.deepEqual(parseSearchResults([]), []);
    assert.deepEqual(parseSearchResults(null), []);
    assert.deepEqual(parseSearchResults(undefined), []);
});
