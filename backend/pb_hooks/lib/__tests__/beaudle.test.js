const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_GUESSES, COURSES, fnv1aHash, pickSecretForDay, compareNumeric, compareGuessToSecret } = require('../beaudle.js');

function byCode(code) {
    const c = COURSES.find((x) => x.code === code);
    assert.ok(c, `curso de prueba ${code} no existe en COURSES`);
    return c;
}

test('COURSES: tiene exactamente 21 ramos', () => {
    assert.equal(COURSES.length, 21);
});

test('COURSES: todos los códigos son únicos', () => {
    const codes = COURSES.map((c) => c.code);
    assert.equal(new Set(codes).size, codes.length);
});

test('COURSES: todos los departamentos son parte del conjunto esperado', () => {
    const allowed = new Set(["MA", "FI", "CC", "CD", "BT", "IQ", "IN"]);
    COURSES.forEach((c) => assert.ok(allowed.has(c.department), `departamento inesperado: ${c.department}`));
});

test('MAX_GUESSES es 6', () => {
    assert.equal(MAX_GUESSES, 6);
});

test('fnv1aHash: determinístico para el mismo input', () => {
    assert.equal(fnv1aHash('beaudle:2026-08-08'), fnv1aHash('beaudle:2026-08-08'));
});

test('fnv1aHash: inputs distintos dan outputs distintos (spot check)', () => {
    assert.notEqual(fnv1aHash('beaudle:2026-08-08'), fnv1aHash('beaudle:2026-08-09'));
});

test('fnv1aHash: siempre devuelve un entero de 32 bits sin signo', () => {
    for (const s of ['a', 'beaudle', '2026-08-08', '']) {
        const h = fnv1aHash(s);
        assert.ok(Number.isInteger(h));
        assert.ok(h >= 0 && h <= 0xffffffff);
    }
});

test('pickSecretForDay: mismo día + salt siempre elige el mismo ramo', () => {
    const a = pickSecretForDay('2026-08-08', COURSES, 'test-salt');
    const b = pickSecretForDay('2026-08-08', COURSES, 'test-salt');
    assert.equal(a.code, b.code);
});

test('pickSecretForDay: distinta salt puede cambiar el resultado', () => {
    let differedAtLeastOnce = false;
    for (let i = 0; i < 30; i++) {
        const day = `2026-01-${String(i + 1).padStart(2, '0')}`;
        const a = pickSecretForDay(day, COURSES, 'salt-a');
        const b = pickSecretForDay(day, COURSES, 'salt-b');
        if (a.code !== b.code) { differedAtLeastOnce = true; break; }
    }
    assert.ok(differedAtLeastOnce, 'se esperaba que al menos un día difiriera entre dos salts distintas');
});

test('pickSecretForDay: recorre varios ramos distintos a lo largo de muchos días (sin sesgo obvio)', () => {
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
        const day = `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`;
        seen.add(pickSecretForDay(day, COURSES, 'beaudle-default-salt-v1').code);
    }
    assert.ok(seen.size > 1, 'se esperaba que la selección variara entre distintos días');
});

test('compareGuessToSecret: acierto exacto -> todo correcto, solved=true, tie=false', () => {
    const secret = byCode('MA1001');
    const res = compareGuessToSecret(secret, secret);
    assert.deepEqual(res, { department: 'correct', semester: 'correct', credits: 'correct', tie: false, solved: true });
});

test('compareGuessToSecret: par empatado MA1001/MA1101 -> tie=true, solved=false', () => {
    const guess = byCode('MA1001');
    const secret = byCode('MA1101');
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.department, 'correct');
    assert.equal(res.semester, 'correct');
    assert.equal(res.credits, 'correct');
    assert.equal(res.solved, false);
    assert.equal(res.tie, true);
});

test('compareGuessToSecret: par empatado FI2001/FI2003 -> tie=true, solved=false', () => {
    const guess = byCode('FI2003');
    const secret = byCode('FI2001');
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.department, 'correct');
    assert.equal(res.semester, 'correct');
    assert.equal(res.credits, 'correct');
    assert.equal(res.solved, false);
    assert.equal(res.tie, true);
});

test('compareGuessToSecret: departamento distinto -> wrong', () => {
    const guess = byCode('CC1000'); // CC
    const secret = byCode('MA1001'); // MA
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.department, 'wrong');
});

test('compareGuessToSecret: semestre -> higher cuando el secreto tiene un semestre mayor', () => {
    const guess = byCode('MA1001'); // semestre 1
    const secret = byCode('MA2001'); // semestre 3
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.semester, 'higher');
});

test('compareGuessToSecret: semestre -> lower cuando el secreto tiene un semestre menor', () => {
    const guess = byCode('MA2002'); // semestre 4
    const secret = byCode('MA1001'); // semestre 1
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.semester, 'lower');
});

test('compareGuessToSecret: créditos -> higher cuando el secreto tiene más créditos', () => {
    const guess = byCode('CC1000'); // 3 créditos
    const secret = byCode('MA1001'); // 6 créditos
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.credits, 'higher');
});

test('compareGuessToSecret: créditos -> lower cuando el secreto tiene menos créditos', () => {
    const guess = byCode('MA1001'); // 6 créditos
    const secret = byCode('CC1000'); // 3 créditos
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.credits, 'lower');
});

test('compareGuessToSecret: totalmente distinto -> nada en correct, sin tie', () => {
    const guess = byCode('BT1211'); // BT, sem1, 3cr
    const secret = byCode('IN2201'); // IN, sem4, 6cr
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.department, 'wrong');
    assert.notEqual(res.semester, 'correct');
    assert.notEqual(res.credits, 'correct');
    assert.equal(res.tie, false);
    assert.equal(res.solved, false);
});

test('compareNumeric: correct/higher/lower', () => {
    assert.equal(compareNumeric(3, 3), 'correct');
    assert.equal(compareNumeric(1, 4), 'higher');
    assert.equal(compareNumeric(4, 1), 'lower');
});
