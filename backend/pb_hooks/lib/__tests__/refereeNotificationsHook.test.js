const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('la asignación al equipo avisa a sus integrantes activos con el enlace al partido', () => {
    const hooks = [];
    const saved = [];
    const record = (fields) => ({
        fields,
        getString(name) { return String(this.fields[name] || ''); },
        set(name, value) { this.fields[name] = value; },
    });
    const team = record({ id: 'team', type: 'organization', subtype: 'team', name: 'Equipo A' });
    const memberIds = ['student1', 'student2'];
    const context = {
        onRecordAfterCreateSuccess(callback, collection) { hooks.push({ callback, collection }); },
        $app: {
            findRecordById(collection, id) {
                assert.equal(collection, 'users');
                return id === 'team' ? team : record({ id, type: 'student' });
            },
            findCollectionByNameOrId(name) { assert.equal(name, 'notifications'); return { name }; },
            findRecordsByFilter(collection, filter, sort, limit, offset, params) {
                assert.equal(collection, 'organization_members');
                assert.match(filter, /status = 'active'/);
                assert.equal(params.team, 'team');
                return offset === 0 ? memberIds.map((id) => record({ user: id })) : [];
            },
            save(notification) {
                saved.push(notification);
                hooks[0].callback({ record: notification });
            },
        },
        Record: function () { return record({}); },
        console,
    };
    const hookPath = path.join(__dirname, '..', '..', 'notifications.pb.js');
    vm.runInNewContext(fs.readFileSync(hookPath, 'utf8'), context);

    assert.equal(hooks[0].collection, 'notifications');
    hooks[0].callback({ record: record({
        user: 'team', sender: 'league', type: 'league_referee_assignment',
        title: 'Arbitraje pendiente', body: 'Tu equipo fue asignado a arbitrar B vs C.',
        relatedId: 'match123',
    }) });

    assert.deepEqual(saved.map((item) => item.getString('user')), memberIds);
    assert.ok(saved.every((item) => item.getString('type') === 'league_referee_member_assignment'));
    assert.ok(saved.every((item) => item.getString('relatedId') === 'match123'));
    assert.ok(saved.every((item) => item.getString('body') === 'Tu equipo Equipo A debe arbitrar B vs C.'));
});
