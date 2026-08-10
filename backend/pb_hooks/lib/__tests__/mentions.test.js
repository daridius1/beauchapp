const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMentions } = require('../mentions.js');

test('sin contenido devuelve array vacío', () => {
    assert.deepEqual(parseMentions(''), []);
    assert.deepEqual(parseMentions(null), []);
    assert.deepEqual(parseMentions(undefined), []);
});

test('sin menciones devuelve array vacío', () => {
    assert.deepEqual(parseMentions('Este es un post sin menciones.'), []);
});

test('detecta una mención simple al inicio del texto', () => {
    assert.deepEqual(parseMentions('@juanito hola!'), ['juanito']);
});

test('detecta una mención precedida por espacio', () => {
    assert.deepEqual(parseMentions('Hola @juanito, ¿cómo estás?'), ['juanito']);
});

test('detecta múltiples menciones únicas', () => {
    const result = parseMentions('Hola @juanito y @maria, saludos a @juanito de nuevo');
    assert.deepEqual(result.sort(), ['juanito', 'maria']);
});

test('normaliza a minúsculas', () => {
    assert.deepEqual(parseMentions('Hola @JuanIto'), ['juanito']);
});

test('no confunde un email con una mención', () => {
    // "usuario@ing.uchile.cl" no debe matchear porque el @ no está precedido de espacio/inicio
    assert.deepEqual(parseMentions('Mi correo es usuario@ing.uchile.cl'), []);
});

test('ignora usernames demasiado cortos (<3 caracteres)', () => {
    assert.deepEqual(parseMentions('Hola @ab, ¿qué tal?'), []);
});

test('acepta usernames con guiones y guiones bajos', () => {
    assert.deepEqual(parseMentions('@juan_perez y @maria-jose'), ['juan_perez', 'maria-jose']);
});

test('acepta usernames con punto (derivados de correo institucional nombre.apellido)', () => {
    assert.deepEqual(parseMentions('Hola @juan.perez, ¿viste esto?'), ['juan.perez']);
});

test('no incluye el punto de fin de oración como parte del username', () => {
    assert.deepEqual(parseMentions('Gracias @juan.perez.'), ['juan.perez']);
});

test('username de exactamente 20 caracteres sí matchea', () => {
    const username20 = 'a'.repeat(20);
    assert.deepEqual(parseMentions(`@${username20} hola`), [username20]);
});

test('username de más de 20 caracteres NO matchea (comportamiento actual del regex)', () => {
    // Nota: el cuantificador {3,20} exige además un \b justo después del match; con 21+
    // caracteres de word-chars seguidos, ninguna longitud <=20 cae en un límite de palabra,
    // así que la mención completa no matchea en vez de truncarse a 20. Es el comportamiento
    // real de mentions.pb.js hoy, no un bug introducido por este test.
    const username21 = 'a'.repeat(21);
    assert.deepEqual(parseMentions(`@${username21} hola`), []);
});
