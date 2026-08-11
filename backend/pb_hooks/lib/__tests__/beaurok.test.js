const test = require('node:test');
const assert = require('node:assert/strict');
const { BEAUROK_USERNAME, POST_CONTENT_MAX, stripMention, buildBeaurokPrompt, truncateReply } = require('../beaurok.js');

test('BEAUROK_USERNAME es "beaurok"', () => {
    assert.equal(BEAUROK_USERNAME, 'beaurok');
});

test('stripMention: sin contenido devuelve string vacío', () => {
    assert.equal(stripMention(''), '');
    assert.equal(stripMention(null), '');
    assert.equal(stripMention(undefined), '');
});

test('stripMention: saca la mención al inicio del texto', () => {
    assert.equal(stripMention('@beaurok qué opinas de esto'), 'qué opinas de esto');
});

test('stripMention: saca la mención en medio del texto, deja el resto intacto', () => {
    assert.equal(stripMention('oye @beaurok mira esto'), 'oye mira esto');
});

test('stripMention: es insensible a mayúsculas/minúsculas', () => {
    assert.equal(stripMention('@BeauRok hola'), 'hola');
});

test('stripMention: no toca menciones a otros usuarios', () => {
    assert.equal(stripMention('@juanito y @beaurok esto es genial'), '@juanito y esto es genial');
});

test('buildBeaurokPrompt: arma system fijo y user con el texto limpio', () => {
    const { system, user } = buildBeaurokPrompt('qué opinas de esto');
    assert.match(system, /BeauRok/);
    assert.match(system, /Beauchef/);
    assert.equal(user, 'qué opinas de esto');
});

test('buildBeaurokPrompt: si no queda texto (solo lo etiquetaron), igual arma un user válido', () => {
    const { user } = buildBeaurokPrompt('');
    assert.ok(user.length > 0);
});

test('truncateReply: texto corto queda igual', () => {
    assert.equal(truncateReply('una respuesta corta'), 'una respuesta corta');
});

test('truncateReply: texto largo se recorta al máximo del campo content', () => {
    const long = 'x'.repeat(400);
    const result = truncateReply(long);
    assert.ok(result.length <= POST_CONTENT_MAX);
    assert.ok(result.endsWith('…'));
});

test('truncateReply: recorta al límite exacto pedido si se pasa uno explícito', () => {
    const result = truncateReply('x'.repeat(50), 10);
    assert.ok(result.length <= 10);
});
