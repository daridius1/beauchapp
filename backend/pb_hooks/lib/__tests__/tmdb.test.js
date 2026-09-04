const test = require('node:test');
const assert = require('node:assert/strict');
const { parseResultItem, mergeSearchResults } = require('../tmdb.js');

test('parseResultItem: película usa title/release_date', () => {
    const item = { id: 603, title: 'The Matrix', release_date: '1999-03-30', poster_path: '/matrix.jpg' };
    assert.deepEqual(parseResultItem(item, 'movie'), {
        id: '603',
        mediaType: 'movie',
        title: 'The Matrix',
        year: 1999,
        posterUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
    });
});

test('parseResultItem: serie usa name/first_air_date', () => {
    const item = { id: 1429, name: 'Attack on Titan', first_air_date: '2013-04-07', poster_path: null };
    assert.deepEqual(parseResultItem(item, 'tv'), {
        id: '1429',
        mediaType: 'tv',
        title: 'Attack on Titan',
        year: 2013,
        posterUrl: '',
    });
});

test('parseResultItem: sin id o sin título válido devuelve null', () => {
    assert.equal(parseResultItem({ title: 'Sin id' }, 'movie'), null);
    assert.equal(parseResultItem({ id: 1 }, 'movie'), null); // sin title
    assert.equal(parseResultItem({ id: 1, name: 'x' }, 'movie'), null); // mediaType movie busca .title, no .name
    assert.equal(parseResultItem(null, 'movie'), null);
});

test('mergeSearchResults: combina y ordena por popularidad descendente', () => {
    const movieJson = {
        results: [
            { id: 1, title: 'Poco popular', release_date: '2020-01-01', popularity: 5 },
            { id: 2, title: 'Muy popular', release_date: '2021-01-01', popularity: 90 },
        ],
    };
    const tvJson = {
        results: [{ id: 3, name: 'Serie media', first_air_date: '2019-01-01', popularity: 50 }],
    };
    const result = mergeSearchResults(movieJson, tvJson);
    assert.deepEqual(result.map((r) => r.title), ['Muy popular', 'Serie media', 'Poco popular']);
    assert.equal(result[0].popularity, undefined);
});

test('mergeSearchResults: respuestas vacías o ausentes no explotan', () => {
    assert.deepEqual(mergeSearchResults({}, {}), []);
    assert.deepEqual(mergeSearchResults(null, null), []);
});
