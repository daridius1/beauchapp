const test = require('node:test');
const assert = require('node:assert/strict');
const { isGiphyMediaUrl, sanitizeGiphyPayload } = require('../giphy.js');

test('acepta únicamente URLs de medios HTTPS de GIPHY', () => {
    assert.equal(isGiphyMediaUrl('https://media1.giphy.com/media/abc/200w.mp4'), true);
    assert.equal(isGiphyMediaUrl('https://media.giphy.com/media/abc/200w.webp'), true);
    assert.equal(isGiphyMediaUrl('http://media1.giphy.com/media/abc/200w.mp4'), false);
    assert.equal(isGiphyMediaUrl('https://ejemplo.cl/video.mp4'), false);
});

test('sanea una selección válida de GIPHY', () => {
    const value = sanitizeGiphyPayload({
        id: 'abc123',
        title: 'Reacción',
        mp4Url: 'https://media1.giphy.com/media/abc/200w.mp4',
        webpUrl: 'https://media1.giphy.com/media/abc/200w.webp',
        stillUrl: 'https://media1.giphy.com/media/abc/200w_s.gif',
        username: 'Autor',
        sourceUrl: 'https://giphy.com/gifs/abc',
        campoInesperado: 'se elimina',
    });
    assert.equal(value.id, 'abc123');
    assert.equal(value.campoInesperado, undefined);
});

test('sanea el JSON textual que llega en una petición multipart', () => {
    const value = sanitizeGiphyPayload(JSON.stringify({
        id: 'abc123',
        title: 'Reacción',
        mp4Url: 'https://media1.giphy.com/media/abc/200w.mp4',
        webpUrl: 'https://media1.giphy.com/media/abc/200w.webp',
        sourceUrl: 'https://giphy.com/gifs/abc',
    }));
    assert.equal(value.id, 'abc123');
});

test('sanea el JSONRaw que PocketBase expone como bytes', () => {
    const raw = JSON.stringify({
        id: 'abc123',
        mp4Url: 'https://media1.giphy.com/media/abc/200w.mp4',
        sourceUrl: 'https://giphy.com/gifs/abc',
    });
    const value = sanitizeGiphyPayload(Array.from(Buffer.from(raw, 'utf8')));
    assert.equal(value.id, 'abc123');
});

test('rechaza una selección que intenta incrustar otro dominio', () => {
    assert.equal(sanitizeGiphyPayload({
        id: 'abc123',
        mp4Url: 'https://tracker.ejemplo.cl/video.mp4',
    }), null);
});
