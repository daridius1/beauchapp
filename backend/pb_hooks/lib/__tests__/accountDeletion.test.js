const test = require('node:test');
const assert = require('node:assert/strict');
const { cooldownDaysRemaining, anonymizeUserRecord, ANONYMIZED_NAME } = require('../accountDeletion.js');

function fakeRecord(initial = {}) {
    const data = { ...initial };
    return {
        _data: data,
        set(name, value) { data[name] = value; },
        get(name) { return data[name]; },
    };
}

test('cooldownDaysRemaining: 0 si no hay fecha de eliminación', () => {
    assert.equal(cooldownDaysRemaining('', new Date('2026-09-03T00:00:00Z')), 0);
    assert.equal(cooldownDaysRemaining(null, new Date('2026-09-03T00:00:00Z')), 0);
    assert.equal(cooldownDaysRemaining('fecha-invalida', new Date('2026-09-03T00:00:00Z')), 0);
});

test('cooldownDaysRemaining: cuenta eliminada hoy tiene 7 días de cooldown', () => {
    const deletedAt = '2026-09-03T00:00:00Z';
    const now = new Date('2026-09-03T00:00:00Z');
    assert.equal(cooldownDaysRemaining(deletedAt, now), 7);
});

test('cooldownDaysRemaining: baja con el tiempo y llega a 0 pasados los 7 días', () => {
    const deletedAt = '2026-09-03T00:00:00Z';
    assert.equal(cooldownDaysRemaining(deletedAt, new Date('2026-09-06T00:00:00Z')), 4);
    assert.equal(cooldownDaysRemaining(deletedAt, new Date('2026-09-09T23:59:00Z')), 1);
    assert.equal(cooldownDaysRemaining(deletedAt, new Date('2026-09-10T00:00:00Z')), 0);
    assert.equal(cooldownDaysRemaining(deletedAt, new Date('2026-10-01T00:00:00Z')), 0);
});

test('anonymizeUserRecord: vacía todos los campos identificables sin tocar id/type/subtype', () => {
    const record = fakeRecord({
        id: 'user123',
        type: 'student',
        subtype: '',
        email: 'nombre.apellido@ing.uchile.cl',
        username: 'nombre.apellido',
        name: 'Nombre Apellido',
        avatar: 'foto.jpg',
        instagram: '@nombre',
        karma: 42,
    });

    anonymizeUserRecord(record, {
        emailHash: 'hash-del-correo',
        deletedAtIso: '2026-09-03T12:00:00Z',
        usernamePlaceholder: 'eliminado_user123',
    });

    assert.equal(record.get('deleted'), true);
    assert.equal(record.get('deletedAt'), '2026-09-03T12:00:00Z');
    assert.equal(record.get('deletedEmailHash'), 'hash-del-correo');
    assert.equal(record.get('email'), '');
    assert.equal(record.get('username'), 'eliminado_user123');
    assert.equal(record.get('name'), ANONYMIZED_NAME);
    assert.equal(record.get('avatar'), '');
    assert.equal(record.get('instagram'), '');

    // No se tocan: identidad estructural de la cuenta.
    assert.equal(record.get('id'), 'user123');
    assert.equal(record.get('type'), 'student');

    // karma no forma parte de los campos que la función limpia (no es identificable).
    assert.equal(record.get('karma'), 42);
});

test('anonymizeUserRecord: emailHash vacío si la cuenta nunca tuvo correo', () => {
    const record = fakeRecord({ id: 'org1', type: 'organization' });
    anonymizeUserRecord(record, {
        emailHash: '',
        deletedAtIso: '2026-09-03T12:00:00Z',
        usernamePlaceholder: 'eliminado_org1',
    });
    assert.equal(record.get('deletedEmailHash'), '');
});
