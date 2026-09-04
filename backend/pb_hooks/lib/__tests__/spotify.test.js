const test = require('node:test');
const assert = require('node:assert/strict');
const { base64Encode, parseSearchResults } = require('../spotify.js');

test('base64Encode: codifica un client_id:secret típico', () => {
    // Vector de referencia estándar de base64.
    assert.equal(base64Encode('client_id:client_secret'), 'Y2xpZW50X2lkOmNsaWVudF9zZWNyZXQ=');
    assert.equal(base64Encode(''), '');
    assert.equal(base64Encode('a'), 'YQ==');
    assert.equal(base64Encode('ab'), 'YWI=');
    assert.equal(base64Encode('abc'), 'YWJj');
});

test('parseSearchResults: mapea items válidos con artistas concatenados', () => {
    const json = {
        tracks: {
            items: [
                {
                    id: 'abc123',
                    name: 'Sexo',
                    artists: [{ name: 'Los Prisioneros' }],
                    album: {
                        release_date: '2011-05-10',
                        images: [{ url: 'https://img/large.jpg' }, { url: 'https://img/small.jpg' }],
                    },
                },
                {
                    id: 'def456',
                    name: 'Feat Song',
                    artists: [{ name: 'Artist A' }, { name: 'Artist B' }],
                    album: { release_date: '', images: [] },
                },
            ],
        },
    };
    const result = parseSearchResults(json);
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], {
        id: 'abc123',
        name: 'Sexo',
        artist: 'Los Prisioneros',
        year: 2011,
        imageUrl: 'https://img/large.jpg',
    });
    assert.equal(result[1].artist, 'Artist A, Artist B');
    assert.equal(result[1].year, null);
    assert.equal(result[1].imageUrl, '');
});

test('parseSearchResults: descarta items sin id o sin name, y respuestas vacías', () => {
    assert.deepEqual(parseSearchResults({ tracks: { items: [{ name: 'Sin id' }, { id: 'x' }] } }), []);
    assert.deepEqual(parseSearchResults({}), []);
    assert.deepEqual(parseSearchResults(null), []);
});
