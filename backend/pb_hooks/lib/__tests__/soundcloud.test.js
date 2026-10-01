const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSoundCloudUrl } = require('../soundcloud.js');

test('acepta enlaces oficiales de SoundCloud', () => {
    assert.equal(
        normalizeSoundCloudUrl('https://soundcloud.com/artista/cancion#comentario'),
        'https://soundcloud.com/artista/cancion'
    );
    assert.equal(normalizeSoundCloudUrl('https://on.soundcloud.com/abc123'), 'https://on.soundcloud.com/abc123');
});

test('rechaza hosts parecidos, HTTP y enlaces sin contenido', () => {
    assert.equal(normalizeSoundCloudUrl('https://soundcloud.com.ejemplo.cl/artista/cancion'), null);
    assert.equal(normalizeSoundCloudUrl('http://soundcloud.com/artista/cancion'), null);
    assert.equal(normalizeSoundCloudUrl('https://soundcloud.com/'), null);
});
