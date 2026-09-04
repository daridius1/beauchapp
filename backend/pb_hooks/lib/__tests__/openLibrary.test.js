const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSearchResults } = require('../openLibrary.js');

test('parseSearchResults: mapea libros válidos con autores concatenados', () => {
    const json = {
        docs: [
            {
                key: '/works/OL45804W',
                title: 'Fantastic Mr Fox',
                author_name: ['Roald Dahl'],
                first_publish_year: 1970,
                cover_i: 12345678,
            },
            {
                key: '/works/OL999W',
                title: 'Libro sin carátula ni año',
                author_name: ['Autor A', 'Autor B'],
            },
        ],
    };
    const result = parseSearchResults(json);
    assert.deepEqual(result[0], {
        id: 'OL45804W',
        title: 'Fantastic Mr Fox',
        author: 'Roald Dahl',
        year: 1970,
        coverUrl: 'https://covers.openlibrary.org/b/id/12345678-L.jpg',
    });
    assert.equal(result[1].author, 'Autor A, Autor B');
    assert.equal(result[1].year, null);
    assert.equal(result[1].coverUrl, '');
});

test('parseSearchResults: descarta docs sin key o sin title', () => {
    assert.deepEqual(parseSearchResults({ docs: [{ title: 'Sin key' }, { key: '/works/OL1W' }] }), []);
});

test('parseSearchResults: respuestas vacías o ausentes no explotan', () => {
    assert.deepEqual(parseSearchResults({}), []);
    assert.deepEqual(parseSearchResults(null), []);
});
