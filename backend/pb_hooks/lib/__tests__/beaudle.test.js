const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MAX_GUESSES, PLACES, fnv1aHash, mixedHash, daysBetween, shuffledIndices, pickSecretForDay,
    compareSet, compareGuessToSecret, nextDayNumber, computeStreakUpdate, BEAUDLE_LAUNCH_DAY,
    isValidBeaudleDay,
} = require('../beaudle.js');

function byCode(code) {
    const p = PLACES.find((x) => x.code === code);
    assert.ok(p, `lugar de prueba ${code} no existe en PLACES`);
    return p;
}

function nextDay(day) {
    const [y, m, d] = day.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
}

test('PLACES: tiene exactamente 45 lugares', () => {
    assert.equal(PLACES.length, 45);
});

test('PLACES: todos los códigos son únicos', () => {
    const codes = PLACES.map((p) => p.code);
    assert.equal(new Set(codes).size, codes.length);
});

test('PLACES: todos los nombres completos son únicos', () => {
    const names = PLACES.map((p) => p.name);
    assert.equal(new Set(names).size, names.length);
});

test('PLACES: edificio/piso/tipo son siempre arreglos no vacíos', () => {
    PLACES.forEach((p) => {
        assert.ok(Array.isArray(p.edificio) && p.edificio.length > 0, `${p.code}: edificio inválido`);
        assert.ok(Array.isArray(p.piso) && p.piso.length > 0, `${p.code}: piso inválido`);
        assert.ok(Array.isArray(p.tipo) && p.tipo.length > 0, `${p.code}: tipo inválido`);
    });
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

test('pickSecretForDay: mismo día + salt siempre elige el mismo lugar', () => {
    const a = pickSecretForDay('2026-08-08', PLACES, 'test-salt');
    const b = pickSecretForDay('2026-08-08', PLACES, 'test-salt');
    assert.equal(a.code, b.code);
});

test('pickSecretForDay: distinta salt puede cambiar el resultado', () => {
    let differedAtLeastOnce = false;
    for (let i = 0; i < 30; i++) {
        const day = `2026-01-${String(i + 1).padStart(2, '0')}`;
        const a = pickSecretForDay(day, PLACES, 'salt-a');
        const b = pickSecretForDay(day, PLACES, 'salt-b');
        if (a.code !== b.code) { differedAtLeastOnce = true; break; }
    }
    assert.ok(differedAtLeastOnce, 'se esperaba que al menos un día difiriera entre dos salts distintas');
});

test('pickSecretForDay: recorre varios lugares distintos a lo largo de muchos días (sin sesgo obvio)', () => {
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
        const day = `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`;
        seen.add(pickSecretForDay(day, PLACES, 'beaudle-default-salt-v1').code);
    }
    assert.ok(seen.size > 1, 'se esperaba que la selección variara entre distintos días');
});

test('pickSecretForDay: NO repite ningún lugar hasta que el ciclo completo (todos los lugares) se agotó', () => {
    // Regresión directa del bug reportado: 4 días de lanzamiento consecutivos habían dado
    // 4 lugares con índices consecutivos en PLACES. Un ciclo entero (PLACES.length días
    // seguidos desde el lanzamiento) debe cubrir cada lugar EXACTAMENTE una vez.
    const seenCodes = new Set();
    let day = BEAUDLE_LAUNCH_DAY;
    for (let i = 0; i < PLACES.length; i++) {
        const code = pickSecretForDay(day, PLACES, 'beaudle-default-salt-v1').code;
        assert.ok(!seenCodes.has(code), `"${code}" se repitió dentro del mismo ciclo (día ${day})`);
        seenCodes.add(code);
        day = nextDay(day);
    }
    assert.equal(seenCodes.size, PLACES.length);
});

test('pickSecretForDay: el ciclo siguiente vuelve a cubrir todos los lugares una vez, en otro orden', () => {
    const cycleOne = [];
    const cycleTwo = [];
    let day = BEAUDLE_LAUNCH_DAY;
    for (let i = 0; i < PLACES.length; i++) {
        cycleOne.push(pickSecretForDay(day, PLACES, 'beaudle-default-salt-v1').code);
        day = nextDay(day);
    }
    for (let i = 0; i < PLACES.length; i++) {
        cycleTwo.push(pickSecretForDay(day, PLACES, 'beaudle-default-salt-v1').code);
        day = nextDay(day);
    }
    assert.equal(new Set(cycleTwo).size, PLACES.length, 'el segundo ciclo también debe cubrir todos los lugares sin repetir');
    assert.notDeepEqual(cycleOne, cycleTwo, 'se esperaba que el segundo ciclo barajara en un orden distinto al primero');
});

test('pickSecretForDay: días consecutivos ya no dan índices consecutivos/correlacionados en PLACES (regresión del bug reportado)', () => {
    const indexes = [];
    let day = BEAUDLE_LAUNCH_DAY;
    for (let i = 0; i < 10; i++) {
        const code = pickSecretForDay(day, PLACES, 'beaudle-default-salt-v1').code;
        indexes.push(PLACES.findIndex((p) => p.code === code));
        day = nextDay(day);
    }
    let consecutiveRun = 1;
    let maxConsecutiveRun = 1;
    for (let i = 1; i < indexes.length; i++) {
        consecutiveRun = indexes[i] === indexes[i - 1] + 1 ? consecutiveRun + 1 : 1;
        maxConsecutiveRun = Math.max(maxConsecutiveRun, consecutiveRun);
    }
    assert.ok(maxConsecutiveRun < 4, `se encontró una racha de ${maxConsecutiveRun} índices consecutivos en PLACES — mismo patrón que el bug reportado`);
});

test('mixedHash: determinístico, entero de 32 bits sin signo', () => {
    assert.equal(mixedHash('a:2026-08-10'), mixedHash('a:2026-08-10'));
    const h = mixedHash('a:2026-08-10');
    assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff);
});

test('mixedHash: decorrelaciona strings que difieren solo en el último carácter (root cause del bug)', () => {
    // Con fnv1aHash puro, hash("s:2026-08-10") - hash("s:2026-08-11") daba ~exactamente
    // el primo FNV (16777619) para varios pares consecutivos — de ahí la racha de índices
    // consecutivos. mixedHash no debería mostrar ese patrón.
    const deltas = [];
    for (let d = 10; d <= 18; d++) {
        const a = mixedHash(`s:2026-08-${String(d).padStart(2, '0')}`);
        const b = mixedHash(`s:2026-08-${String(d + 1).padStart(2, '0')}`);
        deltas.push(Math.abs(a - b));
    }
    const FNV_PRIME = 16777619;
    const suspicious = deltas.filter((d) => Math.abs(d - FNV_PRIME) < 1000).length;
    assert.ok(suspicious === 0, 'se esperaba que ningún delta quedara pegado al primo FNV como en el bug original');
});

test('daysBetween: 0 para el mismo día, exacto cruzando meses', () => {
    assert.equal(daysBetween('2026-08-10', '2026-08-10'), 0);
    assert.equal(daysBetween('2026-08-10', '2026-08-11'), 1);
    assert.equal(daysBetween('2026-07-31', '2026-08-01'), 1);
});

test('shuffledIndices: devuelve una permutación completa de [0..n-1], determinística por seed', () => {
    const a = shuffledIndices(45, 'seed-1');
    const b = shuffledIndices(45, 'seed-1');
    const c = shuffledIndices(45, 'seed-2');
    assert.deepEqual(a, b);
    assert.equal(new Set(a).size, 45);
    assert.deepEqual([...a].sort((x, y) => x - y), Array.from({ length: 45 }, (_, i) => i));
    assert.notDeepEqual(a, c);
});

test('compareSet: mismo conjunto exacto -> correct, sin importar el orden', () => {
    assert.equal(compareSet(['a', 'b'], ['b', 'a']), 'correct');
    assert.equal(compareSet(['a'], ['a']), 'correct');
});

test('compareSet: comparten al menos un valor pero no son iguales -> partial', () => {
    assert.equal(compareSet(['a', 'b'], ['a', 'c']), 'partial');
    assert.equal(compareSet(['a'], ['a', 'b']), 'partial');
    assert.equal(compareSet(['a', 'b'], ['a']), 'partial');
});

test('compareSet: sin ningún valor en común -> wrong', () => {
    assert.equal(compareSet(['a', 'b'], ['c', 'd']), 'wrong');
    assert.equal(compareSet([1, 2], [3]), 'wrong');
});

test('compareGuessToSecret: acierto exacto -> todo correcto, solved=true, tie=false', () => {
    const secret = byCode('dcc');
    const res = compareGuessToSecret(secret, secret);
    assert.deepEqual(res, { ubicacion: 'correct', edificio: 'correct', piso: 'correct', tipo: 'correct', tie: false, solved: true });
});

test('compareGuessToSecret: ubicación distinta -> wrong', () => {
    const guess = byCode('gmi'); // Casa CEI
    const secret = byCode('dcc'); // 851
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.ubicacion, 'wrong');
});

test('compareGuessToSecret: edificio parcialmente compartido -> partial (pista amarilla)', () => {
    // dcc: ["Torre Norte", "Torre Poniente"]; cmm: ["Torre Norte"] -> comparten "Torre Norte"
    const guess = byCode('cmm');
    const secret = byCode('dcc');
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.edificio, 'partial');
});

test('compareGuessToSecret: piso parcialmente compartido -> partial (pista amarilla)', () => {
    // escalera-caracol: piso [-1,-2,-3,1]; piscina: piso [-1] -> comparten -1
    const guess = byCode('piscina');
    const secret = byCode('escalera-caracol');
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.piso, 'partial');
});

test('compareGuessToSecret: tipo parcialmente compartido -> partial (pista amarilla)', () => {
    // cdi: tipo ["Oficina", "CCEE"]; adefa: tipo ["Oficina"] -> comparten "Oficina"
    const guess = byCode('adefa');
    const secret = byCode('cdi');
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.tipo, 'partial');
});

test('compareGuessToSecret: totalmente distinto -> wrong en todo, sin tie', () => {
    const guess = byCode('la-mona'); // 850, hall, piso 1, Patrimonio
    const secret = byCode('dimec'); // 851, Torre Poniente, piso 4-5, Departamento
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.ubicacion, 'wrong');
    assert.notEqual(res.edificio, 'correct');
    assert.notEqual(res.piso, 'correct');
    assert.notEqual(res.tipo, 'correct');
    assert.equal(res.tie, false);
    assert.equal(res.solved, false);
});

test('compareGuessToSecret: par con las 4 pistas en correcto pero lugares distintos -> tie=true', () => {
    // sala-de-artes y dojo comparten ubicación/edificio/piso exactos; se fuerza el mismo
    // tipo para aislar específicamente el comportamiento de tie (dojo por sí solo no
    // empata en tipo con sala-de-artes en los datos reales).
    const guess = { code: 'dojo-fake', ubicacion: '851', edificio: ['Subterráneo', 'Torre Oriente'], piso: [-3], tipo: ['Deportivo'] };
    const secret = byCode('dojo');
    const res = compareGuessToSecret(guess, secret);
    assert.equal(res.ubicacion, 'correct');
    assert.equal(res.edificio, 'correct');
    assert.equal(res.piso, 'correct');
    assert.equal(res.tipo, 'correct');
    assert.equal(res.solved, false);
    assert.equal(res.tie, true);
});

test('compareGuessToSecret: el único par empatado en los datos reales es hall-sur/terraza-sobria (documentado, no un bug)', () => {
    // Ambos son 850, Edificio Escuela (hall), piso 1, tipo ["Áreas comunes"] — mismo caso
    // que MA1001/MA1101 tenía con los ramos: el juego ya maneja esto mostrando el aviso
    // de empate (ver GuessRow.tsx) en vez de asumir que nunca puede pasar.
    const ties = [];
    for (let i = 0; i < PLACES.length; i++) {
        for (let j = 0; j < PLACES.length; j++) {
            if (i === j) continue;
            if (compareGuessToSecret(PLACES[i], PLACES[j]).tie) ties.push([PLACES[i].code, PLACES[j].code].sort().join('/'));
        }
    }
    const uniqueTies = Array.from(new Set(ties));
    assert.deepEqual(uniqueTies, ['hall-sur/terraza-sobria']);
});

test('nextDayNumber: el primero (sin fila previa) es 1', () => {
    assert.equal(nextDayNumber(0), 1);
    assert.equal(nextDayNumber(null), 1);
    assert.equal(nextDayNumber(undefined), 1);
});

test('nextDayNumber: incrementa sobre el anterior', () => {
    assert.equal(nextDayNumber(1), 2);
    assert.equal(nextDayNumber(41), 42);
});

test('computeStreakUpdate: primera vez (sin lastStreakDay) arranca en 1', () => {
    const res = computeStreakUpdate(0, 0, null, '2026-08-10');
    assert.deepEqual(res, { streak: 1, bestStreak: 1, lastStreakDay: '2026-08-10' });
});

test('computeStreakUpdate: día consecutivo extiende la racha', () => {
    const res = computeStreakUpdate(3, 5, '2026-08-09', '2026-08-10');
    assert.deepEqual(res, { streak: 4, bestStreak: 5, lastStreakDay: '2026-08-10' });
});

test('computeStreakUpdate: la racha nueva supera la mejor histórica, la actualiza', () => {
    const res = computeStreakUpdate(5, 5, '2026-08-09', '2026-08-10');
    assert.deepEqual(res, { streak: 6, bestStreak: 6, lastStreakDay: '2026-08-10' });
});

test('computeStreakUpdate: un hueco (se saltó un día) resetea la racha a 1', () => {
    const res = computeStreakUpdate(10, 10, '2026-08-05', '2026-08-10');
    assert.deepEqual(res, { streak: 1, bestStreak: 10, lastStreakDay: '2026-08-10' });
});

test('computeStreakUpdate: cruce de mes/año se calcula correctamente (no es un simple diff de substring)', () => {
    const res = computeStreakUpdate(1, 1, '2026-07-31', '2026-08-01');
    assert.deepEqual(res, { streak: 2, bestStreak: 2, lastStreakDay: '2026-08-01' });
});

test('isValidBeaudleDay: rechaza cualquier día anterior al lanzamiento (ej. cambiando la URL)', () => {
    assert.equal(isValidBeaudleDay('2020-01-01', '2026-08-15'), false);
    assert.equal(isValidBeaudleDay('2026-08-09', '2026-08-15'), false);
});

test('isValidBeaudleDay: rechaza cualquier día futuro', () => {
    assert.equal(isValidBeaudleDay('2026-08-16', '2026-08-15'), false);
});

test('isValidBeaudleDay: acepta el día de lanzamiento, hoy, y cualquier día intermedio', () => {
    assert.equal(isValidBeaudleDay(BEAUDLE_LAUNCH_DAY, '2026-08-15'), true);
    assert.equal(isValidBeaudleDay('2026-08-12', '2026-08-15'), true);
    assert.equal(isValidBeaudleDay('2026-08-15', '2026-08-15'), true);
});
