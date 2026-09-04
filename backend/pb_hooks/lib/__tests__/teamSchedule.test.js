const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    startOfWeek,
    windowBlockCodes,
    windowBlockRange,
    previousWeekBlockCodes,
    pastBlockCodes,
    filterToBlocks,
    computeValidBlocks,
    fillDefaultHappiness,
    DEFAULT_HAPPINESS_LEVEL,
    happinessUtility,
    levelValue,
    isBadLevel,
    BAD_LEVEL,
    SACRIFICE_PENALTY,
    KARMA_SPREAD,
    teamOffer,
    karmaWeights,
    pairKey,
    hungarian,
    maximumMatching,
    greedyMatch,
    buildPairing,
    buildTeamValues,
    buildPairWeights,
    suggestByeTeam,
    rankByeCandidates,
    isPairingFeasible,
    proposeMatches,
    difficultyBalanceGain,
    MAX_TEAMS,
    DIFFICULTY_WEIGHT,
    DEFAULT_TEMPERATURE,
} = require("../teamSchedule.js");

// ---------------------------------------------------------------------------------
// La ventana móvil y sus utilidades de fecha
// ---------------------------------------------------------------------------------

test("startOfWeek: devuelve el lunes de la semana, sin importar qué día de la semana se pase", () => {
    // 2026-08-19 es un miércoles; el lunes de esa semana es 2026-08-17.
    const monday = startOfWeek(new Date(2026, 7, 19));
    assert.equal(monday.getFullYear(), 2026);
    assert.equal(monday.getMonth(), 7);
    assert.equal(monday.getDate(), 17);

    // Un domingo (2026-08-16) pertenece a la semana que empezó el 2026-08-10.
    const sunday = startOfWeek(new Date(2026, 7, 16));
    assert.equal(sunday.getDate(), 10);
});

test("windowBlockCodes: 3 semanas x 5 días (lun-vie) x 13 horas (8 a 20) = 195 bloques, sin sábado ni domingo", () => {
    const codes = windowBlockCodes(new Date(2026, 7, 19), 3);
    assert.equal(codes.length, 195);
    assert.equal(codes[0], "2026-08-17-08"); // lunes
    assert.equal(codes[12], "2026-08-17-20");
    assert.equal(codes[13], "2026-08-18-08"); // martes
    assert.equal(codes[codes.length - 1], "2026-09-04-20"); // viernes de la 3ra semana

    // Ningún bloque cae en sábado (2026-08-22) ni domingo (2026-08-23) de la 1ra semana.
    assert.ok(!codes.some((c) => c.startsWith("2026-08-22")));
    assert.ok(!codes.some((c) => c.startsWith("2026-08-23")));
});

test("windowBlockRange: cubre exactamente el primer y último bloque de la ventana", () => {
    const ref = new Date("2026-08-19T12:00:00");
    const codes = windowBlockCodes(ref);
    const range = windowBlockRange(ref);
    assert.equal(range.from, codes[0]);
    assert.equal(range.to, codes[codes.length - 1]);
});

test("windowBlockRange: todo bloque de la ventana cae dentro del rango por orden lexicográfico", () => {
    // Esta es la propiedad de la que depende el filtro `blockCode >= from && <= to`:
    // el formato YYYY-MM-DD-HH hace que comparar strings equivalga a comparar fechas.
    const ref = new Date("2026-08-19T12:00:00");
    const codes = windowBlockCodes(ref);
    const { from, to } = windowBlockRange(ref);
    for (const code of codes) {
        assert.ok(code >= from && code <= to, `${code} fuera de [${from}, ${to}]`);
    }
});

test("windowBlockRange: un bloque anterior o posterior a la ventana queda fuera del rango", () => {
    const ref = new Date("2026-08-19T12:00:00");
    const { from, to } = windowBlockRange(ref);
    assert.ok(!("2020-01-01-12" >= from && "2020-01-01-12" <= to));
    assert.ok(!("2099-01-01-12" >= from && "2099-01-01-12" <= to));
});

test("previousWeekBlockCodes: es exactamente la semana de lunes a viernes anterior a la ventana", () => {
    // 2026-08-19 es miércoles -> la ventana arranca el lunes 2026-08-17, así que la
    // semana anterior es 2026-08-10 (lun) a 2026-08-14 (vie).
    const codes = previousWeekBlockCodes(new Date(2026, 7, 19));
    assert.equal(codes.length, 65); // 5 días x 13 horas
    assert.equal(codes[0], "2026-08-10-08");
    assert.equal(codes[codes.length - 1], "2026-08-14-20");
    assert.ok(!codes.some((c) => c.startsWith("2026-08-15"))); // sábado
    assert.ok(!codes.some((c) => c.startsWith("2026-08-16"))); // domingo
});

test("previousWeekBlockCodes: no se solapa con ningún bloque de la ventana móvil", () => {
    const ref = new Date(2026, 7, 19);
    const window = new Set(windowBlockCodes(ref));
    for (const code of previousWeekBlockCodes(ref)) {
        assert.ok(!window.has(code), `${code} no debería estar en la ventana`);
    }
});

test("previousWeekBlockCodes: desde un domingo apunta a la semana anterior a la que empieza mañana", () => {
    // startOfWeek redondea al lunes de la semana que contiene la fecha: el domingo
    // 2026-08-30 pertenece a la semana del lunes 2026-08-24, así que la anterior es la
    // del 2026-08-17. Es el caso donde restar 7 días a secas se equivocaría de semana.
    const codes = previousWeekBlockCodes(new Date(2026, 7, 30));
    assert.equal(codes[0], "2026-08-17-08");
    assert.equal(codes[codes.length - 1], "2026-08-21-20");
});

// Cómo arma team_schedule.pb.js el archivo de happiness_previous_week: lo que ya estaba
// archivado, más lo que manda el cliente, recortado a la semana anterior + la actual.
// Replicado acá (y no importado) porque el hook necesita `$app` y esto no.
function archivar(archivoPrevio, payloadDelCliente, ref) {
    const bloques = previousWeekBlockCodes(ref).concat(windowBlockCodes(ref, 1));
    return filterToBlocks(Object.assign({}, archivoPrevio, payloadDelCliente), bloques);
}

test("archivo: conserva la semana anterior y la actual, y descarta el resto", () => {
    const ref = new Date(2026, 7, 19); // miércoles; ventana arranca el lun 2026-08-17
    const archivo = archivar({}, {
        "2026-08-10-09": 5, // semana anterior -> sí
        "2026-08-17-09": 4, // semana actual -> sí
        "2026-08-24-09": 3, // 2da semana de la ventana -> no
        "2026-09-01-09": 2, // 3ra semana de la ventana -> no
    }, ref);
    assert.deepEqual(archivo, { "2026-08-10-09": 5, "2026-08-17-09": 4 });
});

test("archivo: al correr la ventana, la semana guardada pasa a ser la fuente de la primera visible", () => {
    // Semana A (lun 2026-08-17): el cliente manda su ventana; se archiva la semana A.
    const semanaA = new Date(2026, 7, 19);
    const archivoA = archivar({}, { "2026-08-17-09": 5, "2026-08-24-09": 3 }, semanaA);
    assert.deepEqual(archivoA, { "2026-08-17-09": 5 });

    // Una semana después (lun 2026-08-24): el payload ya no trae nada de la semana A,
    // pero el archivo previo sí — y la semana A es justo la anterior a la ventana nueva.
    const semanaB = new Date(2026, 7, 26);
    const archivoB = archivar(archivoA, { "2026-08-24-09": 4 }, semanaB);
    assert.equal(archivoB["2026-08-17-09"], 5, "la semana A tiene que sobrevivir");

    // Y es exactamente lo que el frontend va a leer para copiar sobre la primera semana.
    const fuente = filterToBlocks(archivoB, previousWeekBlockCodes(semanaB));
    assert.deepEqual(fuente, { "2026-08-17-09": 5 });
});

test("archivo: sobrevive a varios guardados dentro de la misma semana", () => {
    const semanaB = new Date(2026, 7, 26);
    let archivo = { "2026-08-17-09": 5 }; // semana anterior, ya archivada
    for (let i = 0; i < 3; i++) {
        archivo = archivar(archivo, { "2026-08-24-09": 4 }, semanaB);
    }
    assert.equal(archivo["2026-08-17-09"], 5, "no se puede perder al re-guardar");
});

test("archivo: se auto-poda — dos semanas después la vieja ya no está", () => {
    const archivoB = { "2026-08-17-09": 5, "2026-08-24-09": 4 };
    // Semana C (lun 2026-08-31): la anterior es la B, la A ya no le sirve a nadie.
    const archivoC = archivar(archivoB, { "2026-08-31-09": 3 }, new Date(2026, 7, 31));
    assert.equal(archivoC["2026-08-17-09"], undefined, "la semana A tiene que caerse");
    assert.equal(archivoC["2026-08-24-09"], 4);
    assert.equal(archivoC["2026-08-31-09"], 3);
});

test("pastBlockCodes: si `now` es domingo, toda la semana actual (lunes a viernes) ya pasó", () => {
    // 2026-08-30 es domingo -> la semana actual es 2026-08-24 (lun) a 2026-08-28 (vie),
    // entera en el pasado.
    const now = new Date("2026-08-30T15:00:00");
    const codes = windowBlockCodes(now);
    const past = pastBlockCodes(codes, now);
    const week0 = codes.filter((c) => c.startsWith("2026-08-24") || c.startsWith("2026-08-25") || c.startsWith("2026-08-26") || c.startsWith("2026-08-27") || c.startsWith("2026-08-28"));
    assert.deepEqual(new Set(past), new Set(week0));
});

test("pastBlockCodes: a mitad de semana, excluye días y horas anteriores a `now` pero deja el resto", () => {
    // 2026-08-26 12:00 es miércoles -> lunes y martes de esa semana ya pasaron, y hoy
    // (miércoles) las horas hasta las 12 inclusive también, pero de las 13 en adelante no.
    const now = new Date("2026-08-26T12:00:00");
    const codes = windowBlockCodes(now);
    const past = new Set(pastBlockCodes(codes, now));
    assert.ok(past.has("2026-08-24-10")); // lunes, ya pasó entero
    assert.ok(past.has("2026-08-25-19")); // martes, ya pasó entero
    assert.ok(past.has("2026-08-26-12")); // hoy a las 12, ya empezó
    assert.ok(!past.has("2026-08-26-13")); // hoy a las 13, todavía no
    assert.ok(!past.has("2026-08-27-09")); // jueves, todavía no
});

test("pastBlockCodes: sin nada en el pasado (ventana generada el mismo lunes a primera hora), no excluye nada", () => {
    const now = new Date("2026-08-24T07:00:00"); // lunes, antes del primer bloque (08:00)
    const codes = windowBlockCodes(now);
    const past = pastBlockCodes(codes, now);
    assert.deepEqual(past, []);
});

test("filterToBlocks: descarta claves que no están en la lista permitida", () => {
    const filtered = filterToBlocks(
        { "2026-08-17-09": 4, "2026-08-17-10": 2, "2026-08-24-09": 3 },
        ["2026-08-17-09", "2026-08-24-09"]
    );
    assert.deepEqual(filtered, { "2026-08-17-09": 4, "2026-08-24-09": 3 });
});

test("computeValidBlocks: resta bloqueados y ocupados de la ventana", () => {
    const window = ["a", "b", "c", "d"];
    const result = computeValidBlocks(window, [["b"], ["c", "d"]]);
    assert.deepEqual(result, ["a"]);
});

test("computeValidBlocks: sin nada excluido devuelve la ventana completa", () => {
    const window = ["a", "b"];
    assert.deepEqual(computeValidBlocks(window, []), ["a", "b"]);
    assert.deepEqual(computeValidBlocks(window, undefined), ["a", "b"]);
});

test("fillDefaultHappiness: rellena con el default lo que el equipo no calificó, ignora claves fuera de lo permitido", () => {
    const filled = fillDefaultHappiness({ a: 4, z: 1 }, ["a", "b"], 2);
    assert.deepEqual(filled, { a: 4, b: 2 });
});

test("fillDefaultHappiness: un equipo que nunca calificó nada queda todo en el default", () => {
    const filled = fillDefaultHappiness(undefined, ["a", "b", "c"], 2);
    assert.deepEqual(filled, { a: 2, b: 2, c: 2 });
});

// ---------------------------------------------------------------------------------
// La escala de felicidad compartida
// ---------------------------------------------------------------------------------

test("happinessUtility: la escala es la real (1-5), creciente y levemente cóncava", () => {
    assert.equal(happinessUtility(1), 0);
    assert.equal(happinessUtility(5), 1);
    for (let l = 1; l < 5; l++) {
        assert.ok(happinessUtility(l + 1) > happinessUtility(l), `${l} -> ${l + 1} debe subir`);
    }
    // Cóncava: subir de Mala a Regular vale MÁS que subir de Buena a Excelente. Es lo
    // que hace que, a igual suma de notas, gane el reparto parejo.
    const bajo = happinessUtility(3) - happinessUtility(2);
    const alto = happinessUtility(5) - happinessUtility(4);
    assert.ok(bajo > alto, `el tramo bajo (${bajo}) tiene que valer más que el alto (${alto})`);
});

test("happinessUtility: una nota fuera de la escala se acota en vez de dar NaN", () => {
    assert.equal(happinessUtility(0), 0);
    assert.equal(happinessUtility(9), 1);
    assert.equal(happinessUtility(undefined), 0);
});

test("isBadLevel/levelValue: 'Muy mala' y 'Mala' son sacrificio; de 'Regular' para arriba no", () => {
    assert.equal(isBadLevel(1), true);
    assert.equal(isBadLevel(BAD_LEVEL), true);
    assert.equal(isBadLevel(BAD_LEVEL + 1), false);
    assert.equal(isBadLevel(5), false);
    // El salto de la zona mala a la aceptable es de lejos el más grande de la escala:
    // es el que implementa "minimizar cuántos equipos quedan con mala disponibilidad".
    const salto = levelValue(3) - levelValue(2);
    assert.ok(salto > SACRIFICE_PENALTY, `el salto 2->3 (${salto}) tiene que superar la penalización`);
    assert.ok(levelValue(3) - levelValue(2) > levelValue(5) - levelValue(3));
});

// ---------------------------------------------------------------------------------
// Karma local: cuánto puso de su parte cada equipo en esta tanda
// ---------------------------------------------------------------------------------

test("teamOffer: mide el promedio de la utilidad ofrecida sobre los bloques candidatos", () => {
    assert.equal(teamOffer({ a: 5, b: 5 }, ["a", "b"]), 1);
    assert.equal(teamOffer({ a: 1, b: 1 }, ["a", "b"]), 0);
    // Un bloque que el equipo no calificó no lo ofreció: cuenta 0.
    assert.equal(teamOffer({ a: 5 }, ["a", "b"]), 0.5);
    assert.equal(teamOffer({}, []), 0);
});

test("karmaWeights: si todos ofrecieron lo mismo, el karma es neutro para todos", () => {
    const teams = ["A", "B", "C", "D"];
    const happiness = {};
    teams.forEach((t) => (happiness[t] = { a: 3, b: 3 }));
    const weights = karmaWeights(teams, happiness, ["a", "b"]);
    weights.forEach((w) => assert.equal(w, 1));
});

test("karmaWeights: el más generoso pesa más que el más tacaño, dentro de la banda declarada", () => {
    const teams = ["Tacaño", "Medio", "Generoso"];
    const happiness = {
        "Tacaño": { a: 1, b: 1 },
        Medio: { a: 3, b: 1 },
        Generoso: { a: 5, b: 5 },
    };
    const [tacaño, medio, generoso] = karmaWeights(teams, happiness, ["a", "b"]);
    assert.ok(tacaño < medio && medio < generoso);
    assert.ok(Math.abs(tacaño - (1 - KARMA_SPREAD)) < 1e-9);
    assert.ok(Math.abs(generoso - (1 + KARMA_SPREAD)) < 1e-9);
});

// ---------------------------------------------------------------------------------
// El núcleo numérico: reparto óptimo de bloques
// ---------------------------------------------------------------------------------

test("hungarian: encuentra el reparto de costo mínimo global, no el codicioso fila a fila", () => {
    // El codicioso miraría la columna más barata de cada fila: las dos quieren la 0
    // (1 y 2), y al desempatar por orden la fila 1 se va a la columna 1 -> 1 + 20 = 21.
    // El óptimo es la fila 0 a la columna 1 y la fila 1 a la columna 0: 3 + 2 = 5.
    const cost = [
        [1, 3],
        [2, 20],
    ];
    assert.deepEqual(hungarian(cost, 2, 2), [1, 0]);
});

test("hungarian: con más columnas que filas usa las mejores columnas disponibles", () => {
    const cost = [
        [5, 1, 8],
        [5, 2, 9],
    ];
    const assignment = hungarian(cost, 2, 3);
    assert.equal(new Set(assignment).size, 2, "dos filas no pueden compartir columna");
    const total = assignment.reduce((s, c, r) => s + cost[r][c], 0);
    assert.equal(total, 6); // fila 0 -> col 1 (1) y fila 1 -> col 0 (5)
});

// ---------------------------------------------------------------------------------
// Quién juega contra quién: emparejamiento de cardinalidad máxima (Edmonds)
//
// Reemplazó a un DP con máscara de bits (2^n) que topaba la tanda en 24 equipos. Es la
// pieza que decide si una tanda es factible, así que tiene que ser exacta — y como no
// es código que se pueda leer de corrido, se valida contra fuerza bruta.
// ---------------------------------------------------------------------------------

// Cardinalidad del emparejamiento máximo, por fuerza bruta. Solo para los tests.
function maxMatchingBruteForce(n, adj) {
    const used = new Array(n).fill(false);
    let best = 0;
    (function rec(count) {
        let i = 0;
        while (i < n && used[i]) i++;
        if (i === n) {
            if (count > best) best = count;
            return;
        }
        used[i] = true;
        rec(count); // dejar i sin emparejar
        for (let j = i + 1; j < n; j++) {
            if (used[j] || !adj[i][j]) continue;
            used[j] = true;
            rec(count + 1);
            used[j] = false;
        }
        used[i] = false;
    })(0);
    return best;
}

// Generador reproducible, para que un test que falla se pueda volver a correr igual.
function makeSeededRandom(seed) {
    let state = seed;
    return () => {
        state = (1664525 * state + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

test("maximumMatching: coincide con la fuerza bruta en 1500 grafos aleatorios", () => {
    const rnd = makeSeededRandom(20260901);
    for (let iter = 0; iter < 1500; iter++) {
        const n = 2 + Math.floor(rnd() * 9); // 2..10
        const density = rnd();
        const adj = Array.from({ length: n }, () => new Array(n).fill(false));
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const linked = rnd() < density;
                adj[i][j] = linked;
                adj[j][i] = linked;
            }
        }
        const match = maximumMatching(n, (a, b) => adj[a][b], null);
        // Estructura: simétrico, sin auto-emparejarse, y solo sobre aristas que existen.
        for (let i = 0; i < n; i++) {
            if (match[i] === -1) continue;
            assert.notEqual(match[i], i);
            assert.equal(match[match[i]], i);
            assert.ok(adj[i][match[i]], `emparejó ${i}-${match[i]} sin arista`);
        }
        const size = match.filter((x) => x !== -1).length / 2;
        assert.equal(size, maxMatchingBruteForce(n, adj), `grafo n=${n} iter=${iter}`);
    }
});

test("maximumMatching: arrancar desde el emparejamiento codicioso da la misma cardinalidad", () => {
    // El codicioso puede acorralarse (deja dos equipos sueltos que no pueden entre sí);
    // Edmonds tiene que poder reacomodarlo, no quedarse con lo que le pasaron.
    const rnd = makeSeededRandom(777);
    for (let iter = 0; iter < 400; iter++) {
        const n = 2 + 2 * Math.floor(rnd() * 5); // par, 2..10
        const density = 0.25 + rnd() * 0.75;
        const adj = Array.from({ length: n }, () => new Array(n).fill(false));
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const linked = rnd() < density;
                adj[i][j] = linked;
                adj[j][i] = linked;
            }
        }
        const weight = {};
        for (let i = 0; i < n; i++) {
            weight[i] = {};
            for (let j = i + 1; j < n; j++) weight[i][j] = adj[i][j] ? 1 : null;
        }
        const desdeCero = maximumMatching(n, (a, b) => adj[a][b], null);
        const desdeCodicioso = maximumMatching(n, (a, b) => adj[a][b], greedyMatch(n, weight));
        assert.equal(
            desdeCodicioso.filter((x) => x !== -1).length,
            desdeCero.filter((x) => x !== -1).length
        );
        assert.equal(desdeCero.filter((x) => x !== -1).length / 2, maxMatchingBruteForce(n, adj));
    }
});

test("maximumMatching: encuentra el emparejamiento perfecto que el codicioso se pierde", () => {
    // Ciclo de 4: 0-1, 1-2, 2-3, 3-0. El codicioso toma 0-1 (el primero) y después 2-3,
    // así que acá acierta; el caso que importa es el que lo acorrala:
    //   0-1, 0-2, 0-3, 1-2  →  si el codicioso toma 0-3 primero, quedan 1 y 2, que sí
    //   pueden entre sí. Se fuerza el callejón dejando a 3 solo con 0.
    const n = 4;
    const adj = [
        [false, true, true, true],
        [true, false, false, false],
        [true, false, false, true],
        [true, false, true, false],
    ];
    // 1 solo puede con 0. 3 puede con 0 y con 2. El único perfecto es 0-1 + 2-3.
    const match = maximumMatching(n, (a, b) => adj[a][b], null);
    assert.equal(match.filter((x) => x !== -1).length, 4);
    assert.equal(match[1], 0);
    assert.equal(match[0], 1);
    assert.equal(match[3], 2);
});

test("buildPairing: devuelve pares con i<j que cubren a todos, o null si es imposible", () => {
    const weight = { 0: { 1: 5, 2: 1, 3: 1 }, 1: { 2: 1, 3: 1 }, 2: { 3: 4 } };
    const pairs = buildPairing(4, weight);
    assert.equal(pairs.length, 2);
    pairs.forEach(([i, j]) => assert.ok(i < j));
    assert.deepEqual(new Set(pairs.flat()), new Set([0, 1, 2, 3]));
    // El codicioso agarra primero el par de mayor peso (0-1) y después el que queda.
    assert.deepEqual(pairs.sort((a, b) => a[0] - b[0]), [[0, 1], [2, 3]]);

    // 0 no puede con nadie: no hay emparejamiento perfecto.
    const imposible = { 0: { 1: null, 2: null, 3: null }, 1: { 2: 1, 3: 1 }, 2: { 3: 1 } };
    assert.equal(buildPairing(4, imposible), null);
});

// ---------------------------------------------------------------------------------
// Emparejamiento: el criterio nuevo (felicidad real + menos sacrificados + karma)
// ---------------------------------------------------------------------------------

// Ejemplo de 4 equipos calculado a mano. T1/T2 se entienden en el bloque 09 y T3/T4 en
// el 11; cualquier otro emparejamiento deja a alguien en "Muy mala".
const FOUR_TEAM_HAPPINESS = {
    T1: { "2026-08-17-09": 4, "2026-08-17-10": 2, "2026-08-17-11": 1 },
    T2: { "2026-08-17-09": 3, "2026-08-17-10": 3, "2026-08-17-11": 1 },
    T3: { "2026-08-17-09": 1, "2026-08-17-10": 4, "2026-08-17-11": 4 },
    T4: { "2026-08-17-09": 2, "2026-08-17-10": 1, "2026-08-17-11": 3 },
};
const FOUR_TEAMS = ["T1", "T2", "T3", "T4"];

test("proposeMatches: ejemplo de 4 equipos — nadie queda en la zona mala y se informa en notas reales", () => {
    const result = proposeMatches(FOUR_TEAMS, FOUR_TEAM_HAPPINESS);
    assert.equal(result.infeasible, false);
    assert.equal(result.matches.length, 2);

    const pairsAsNames = result.matches
        .map((m) => [m.teamA, m.teamB].sort())
        .sort((a, b) => a[0].localeCompare(b[0]));
    assert.deepEqual(pairsAsNames, [["T1", "T2"], ["T3", "T4"]]);

    const t1t2 = result.matches.find((m) => [m.teamA, m.teamB].sort().join("") === "T1T2");
    assert.equal(t1t2.block, "2026-08-17-09");
    const t3t4 = result.matches.find((m) => [m.teamA, m.teamB].sort().join("") === "T3T4");
    assert.equal(t3t4.block, "2026-08-17-11");

    // Lo informado está en la escala real, no en ninguna escala interna.
    assert.equal(result.worst, 3);
    assert.equal(result.maxGap, 1);
    assert.equal(result.avgHappiness, 3.5);
    assert.deepEqual(result.sacrificed, []);
});

test("proposeMatches: un horario Regular para los dos le gana a uno Excelente para uno y Muy mala para el otro", () => {
    // El corazón del cambio. Con la normalización por equipo, el "Excelente" de A y el
    // "Muy mala" de B se comparaban en escalas distintas y el bloque X ganaba seguido.
    const result = proposeMatches(["A", "B"], {
        A: { X: 5, Y: 3 },
        B: { X: 1, Y: 3 },
    });
    assert.equal(result.infeasible, false);
    assert.equal(result.matches[0].block, "Y");
    assert.equal(result.worst, 3);
    assert.deepEqual(result.sacrificed, []);
});

test("proposeMatches: no se sacrifica a nadie para subirle la nota a otro", () => {
    // En X la suma de notas es mayor (5+1=6 contra 4+4=8... y aún si empatara), pero X
    // deja a B en la zona mala. Sin nadie sacrificado, Y gana siempre.
    const result = proposeMatches(["A", "B"], {
        A: { X: 5, Y: 4 },
        B: { X: 1, Y: 4 },
    });
    assert.equal(result.matches[0].block, "Y");
    assert.equal(result.sacrificed.length, 0);
});

test("proposeMatches: caso real (LOS LABUBU vs Vo Sai Po, Copa CDI Masculina) — 142 bloques 'Muy mala' compartidos no son un buen horario", () => {
    // Los dos equipos comparten decenas de bloques donde ambos marcaron "Muy mala" y uno
    // solo donde los dos marcaron "Buena". Un criterio de "menor diferencia" leía los
    // pésimos como justicia perfecta (diferencia 0) y agendaba ahí.
    const bloques = [];
    for (let i = 0; i < 20; i++) bloques.push("2026-09-01-" + String(i).padStart(2, "0"));
    const elBueno = "2026-09-01-14";
    const labubu = {};
    const voSaiPo = {};
    bloques.forEach((b) => {
        labubu[b] = 1;
        voSaiPo[b] = 1;
    });
    labubu[elBueno] = 4;
    voSaiPo[elBueno] = 4;
    labubu["2026-09-01-18"] = 5; // LABUBU sí usa el 5 en otro horario; Vo Sai Po nunca

    const result = proposeMatches(["LOS LABUBU", "Vo Sai Po FC"], { "LOS LABUBU": labubu, "Vo Sai Po FC": voSaiPo });
    assert.equal(result.matches[0].block, elBueno);
    assert.equal(result.matches[0].happinessA, 4);
    assert.equal(result.matches[0].happinessB, 4);
});

test("proposeMatches: marcar SOLO las horas buenas y dejar el resto sin tocar sigue siendo una preferencia real", () => {
    // El patrón más común de todos: un equipo entra, sube a "Excelente" las 2 horas que
    // le sirven y guarda. El partido tiene que caer en una de esas dos.
    const bloques = ["2026-09-01-08", "2026-09-01-09", "2026-09-01-10", "2026-09-02-08", "2026-09-02-09", "2026-09-02-10"];
    const bueno = fillDefaultHappiness({ "2026-09-02-09": 5, "2026-09-02-10": 5 }, bloques, DEFAULT_HAPPINESS_LEVEL);
    const indiferente = fillDefaultHappiness({}, bloques, DEFAULT_HAPPINESS_LEVEL);
    const result = proposeMatches(["Bueno", "Indiferente"], { Bueno: bueno, Indiferente: indiferente });
    assert.equal(result.matches[0].happinessA, 5);
    assert.ok(["2026-09-02-09", "2026-09-02-10"].includes(result.matches[0].block));
});

test("proposeMatches: un equipo plano no arrastra al rival a un bloque mediocre — decide el que sí diferenció", () => {
    const result = proposeMatches(["Malwekas", "Temerarias"], {
        Malwekas: { "2026-08-31-09": 2, "2026-08-31-10": 2, "2026-08-31-11": 2 },
        Temerarias: { "2026-08-31-09": 3, "2026-08-31-10": 1, "2026-08-31-11": 5 },
    });
    assert.equal(result.matches[0].block, "2026-08-31-11");
});

test("proposeMatches: inflar o desinflar TODAS las notas no cambia nada (anti-trampa)", () => {
    // En un emparejamiento perfecto cada equipo juega exactamente un partido, así que
    // correr todas sus notas parejo suma una constante al total y no puede cambiar
    // ninguna decisión. Quien decide sigue siendo el que diferenció de verdad.
    const rival = { b0: 1, b1: 5, b2: 2 };
    const planoBajo = proposeMatches(["Plano", "Rival"], { Plano: { b0: 3, b1: 3, b2: 3 }, Rival: rival });
    const planoAlto = proposeMatches(["Plano", "Rival"], { Plano: { b0: 5, b1: 5, b2: 5 }, Rival: rival });
    assert.equal(planoBajo.matches[0].block, "b1");
    assert.equal(planoAlto.matches[0].block, "b1");
});

test("proposeMatches: cuando hay que sacrificar a alguien, le toca a quien menos disponibilidad ofreció", () => {
    // Cuatro equipos, dos partidos. b0 le sirve a los cuatro; b1 solo a A; b2 solo a C.
    // Un partido va a b0 (los dos contentos) y el otro no tiene cómo dejar contentos a
    // los dos: alguien sale sacrificado sí o sí. A y C ofrecieron dos horas buenas cada
    // uno; D y E solo una. El sacrificado tiene que salir de D/E.
    const happiness = {
        A: { b0: 5, b1: 5, b2: 1 },
        C: { b0: 5, b1: 1, b2: 5 },
        D: { b0: 5, b1: 1, b2: 1 },
        E: { b0: 5, b1: 1, b2: 1 },
    };
    const result = proposeMatches(["A", "C", "D", "E"], happiness);
    assert.equal(result.infeasible, false);
    assert.equal(result.sacrificed.length, 1, "exactamente un equipo tiene que quedar en la zona mala");
    assert.ok(["D", "E"].includes(result.sacrificed[0].team), `salió sacrificado ${result.sacrificed[0].team}`);
    // Y se informa POR QUÉ le tocó a ese: cuánto había ofrecido.
    assert.ok(result.sacrificed[0].offer < teamOffer(happiness.A, ["b0", "b1", "b2"]));
});

test("proposeMatches: entre horarios igual de buenos, el mejor se lo lleva quien más ofreció", () => {
    // Los cuatro tienen el mismo perfil sobre b0 (Excelente) y b1 (Regular); solo P
    // ofreció además b2. Un partido va a b0 y otro a b1: el de b0 tiene que incluir a P.
    const happiness = {
        P: { b0: 5, b1: 3, b2: 5 },
        Q: { b0: 5, b1: 3, b2: 1 },
        R: { b0: 5, b1: 3, b2: 1 },
        S: { b0: 5, b1: 3, b2: 1 },
    };
    const result = proposeMatches(["P", "Q", "R", "S"], happiness);
    const deP = result.matches.find((m) => m.teamA === "P" || m.teamB === "P");
    assert.equal(deP.block, "b0");
    assert.equal(result.sacrificed.length, 0);
});

test("proposeMatches: dos partidos del mismo batch no pueden quedar en el mismo bloque horario", () => {
    const happiness = {
        T1: { "2026-08-17-09": 4, "2026-08-17-10": 1 },
        T2: { "2026-08-17-09": 4, "2026-08-17-10": 1 },
        T3: { "2026-08-17-09": 4, "2026-08-17-10": 1 },
        T4: { "2026-08-17-09": 4, "2026-08-17-10": 1 },
    };
    const result = proposeMatches(["T1", "T2", "T3", "T4"], happiness);
    const blocks = result.matches.map((m) => m.block);
    assert.equal(new Set(blocks).size, 2);
    result.matches.forEach((m) => assert.equal(m.collision, false));
});

test("proposeMatches: si no alcanzan los bloques para todos los partidos, el choque se marca en vez de esconderse", () => {
    // Hay una sola cancha: dos partidos a la misma hora es físicamente imposible, y el
    // panel tiene que decirlo en vez de agendarlos a ciegas.
    const happiness = {
        T1: { "2026-08-17-09": 3 },
        T2: { "2026-08-17-09": 3 },
        T3: { "2026-08-17-09": 3 },
        T4: { "2026-08-17-09": 3 },
    };
    const result = proposeMatches(["T1", "T2", "T3", "T4"], happiness);
    assert.equal(result.infeasible, false);
    assert.equal(result.matches.length, 2);
    assert.equal(result.matches[0].block, "2026-08-17-09");
    assert.equal(result.matches[1].block, "2026-08-17-09");
    result.matches.forEach((m) => assert.equal(m.collision, true));
});

test("proposeMatches: si faltan horarios, usa TODOS los que hay antes de repetir alguno", () => {
    // 8 partidos para 5 horas: repetir es inevitable, pero repetir de más no. Cada hora
    // compartida es un partido que el admin va a tener que descartar, así que el mínimo
    // de choques posible (3 horas dobladas, 6 partidos marcados) es parte del objetivo
    // y no un empate cualquiera: sin penalizar los choques, el reparto dejaba horas sin
    // usar y marcaba muchos más partidos de los necesarios.
    const bloques = ["b0", "b1", "b2", "b3", "b4"];
    const teams = Array.from({ length: 16 }, (_, i) => "T" + i);
    const happiness = {};
    teams.forEach((t) => {
        const h = {};
        bloques.forEach((b) => (h[b] = 4));
        happiness[t] = h;
    });
    const result = proposeMatches(teams, happiness, null, null, bloques);
    assert.equal(result.infeasible, false);
    assert.equal(result.matches.length, 8);
    assert.equal(new Set(result.matches.map((m) => m.block)).size, bloques.length, "quedaron horas sin usar");
    assert.equal(result.matches.filter((m) => m.collision).length, 6);
});

test("proposeMatches: restringir los horarios de la tanda no cambia la escala con la que se leen las notas", () => {
    // La liga permite solo 2 horarios de toda la ventana. Las notas siguen valiendo lo
    // que dicen: entre "Muy mala" y "Mala" para A, gana "Mala" — sin que ese "Mala" se
    // convierta en un diez por ser lo mejor que le quedaba.
    const bloques = ["2026-09-01-08", "2026-09-01-09", "2026-09-02-10"];
    const permitidos = ["2026-09-01-08", "2026-09-01-09"];
    const happiness = {
        A: fillDefaultHappiness({ "2026-09-01-08": 1, "2026-09-01-09": 2, "2026-09-02-10": 5 }, bloques, DEFAULT_HAPPINESS_LEVEL),
        B: fillDefaultHappiness({ "2026-09-01-08": 5, "2026-09-01-09": 4 }, bloques, DEFAULT_HAPPINESS_LEVEL),
    };
    const result = proposeMatches(["A", "B"], happiness, null, null, permitidos);
    assert.equal(result.matches[0].block, "2026-09-01-09");
    assert.equal(result.matches[0].happinessA, 2);
    assert.equal(result.matches[0].happinessB, 4);
    // A quedó en la zona mala y se dice, con nota real.
    assert.equal(result.worst, 2);
    assert.equal(result.sacrificed.length, 1);
    assert.equal(result.sacrificed[0].team, "A");
    assert.equal(result.sacrificed[0].level, 2);
});

test("proposeMatches: el orden en que el panel manda los equipos no cambia el resultado", () => {
    const happiness = {
        A: { b0: 5, b1: 1, b2: 1 },
        B: { b0: 5, b1: 1, b2: 1 },
        C: { b0: 1, b1: 5, b2: 3 },
        D: { b0: 1, b1: 5, b2: 3 },
    };
    const esperado = proposeMatches(["A", "B", "C", "D"], happiness).matches
        .map((m) => [m.teamA, m.teamB].sort().join("") + "@" + m.block)
        .sort();
    for (const orden of [["D", "C", "B", "A"], ["C", "A", "D", "B"], ["B", "D", "A", "C"]]) {
        const got = proposeMatches(orden, happiness).matches
            .map((m) => [m.teamA, m.teamB].sort().join("") + "@" + m.block)
            .sort();
        assert.deepEqual(got, esperado, `con el orden ${orden.join(",")}`);
    }
});

// ---------------------------------------------------------------------------------
// Casos límite y errores explícitos
// ---------------------------------------------------------------------------------

test("proposeMatches: cantidad impar de equipos lanza error explícito", () => {
    assert.throws(() => proposeMatches(["A", "B", "C"], {}), /par de equipos/);
});

test("proposeMatches: cero equipos devuelve resultado vacío sin error", () => {
    const result = proposeMatches([], {});
    assert.equal(result.infeasible, false);
    assert.deepEqual(result.matches, []);
    assert.equal(result.totalScore, 0);
    assert.equal(result.worst, null);
});

test("proposeMatches: par sin ningún solapamiento es infactible", () => {
    const result = proposeMatches(["A", "B"], {
        A: { "2026-08-17-09": 3 },
        B: { "2026-08-17-10": 3 },
    });
    assert.equal(result.infeasible, true);
    assert.equal(result.matches, null);
});

test("proposeMatches: equipos repetidos son un error explícito, no un partido contra sí mismo", () => {
    const happiness = { A: { b0: 3 }, B: { b0: 3 } };
    assert.throws(() => proposeMatches(["A", "A", "B", "B"], happiness), /más de una vez/);
});

test("proposeMatches: por encima de MAX_TEAMS avisa en vez de comerse el servidor", () => {
    const teams = Array.from({ length: MAX_TEAMS + 2 }, (_, i) => "T" + i);
    const happiness = {};
    teams.forEach((t) => (happiness[t] = { b0: 3, b1: 3 }));
    assert.throws(() => proposeMatches(teams, happiness), new RegExp(String(MAX_TEAMS)));
});

test("proposeMatches: una tanda del tamaño máximo se resuelve entera y bien formada", () => {
    // 40 equipos = 20 partidos, que es una fecha completa de la liga más grande de una
    // sola vez. Antes el tope eran 24 y había que partir la fecha a mano en dos tandas.
    const bloques = [];
    for (let d = 1; d <= 5; d++) {
        for (let h = 8; h <= 20; h++) bloques.push(`2026-09-0${d}-` + String(h).padStart(2, "0"));
    }
    const rnd = makeSeededRandom(4242);
    const teams = Array.from({ length: MAX_TEAMS }, (_, i) => "T" + i);
    const happiness = {};
    teams.forEach((t) => {
        const h = {};
        // El patrón real: casi todo "Muy mala" y un puñado de horas buenas.
        bloques.forEach((b) => (h[b] = 1));
        for (let k = 0; k < 6; k++) h[bloques[Math.floor(rnd() * bloques.length)]] = rnd() < 0.5 ? 4 : 5;
        happiness[t] = h;
    });

    const result = proposeMatches(teams, happiness, null, null, bloques);
    assert.equal(result.infeasible, false);
    assert.equal(result.matches.length, MAX_TEAMS / 2);

    // Cada equipo juega exactamente una vez, y no hay dos partidos a la misma hora.
    const jugaron = result.matches.flatMap((m) => [m.teamA, m.teamB]);
    assert.equal(new Set(jugaron).size, MAX_TEAMS);
    const bloquesUsados = result.matches.map((m) => m.block);
    assert.equal(new Set(bloquesUsados).size, bloquesUsados.length);
    result.matches.forEach((m) => assert.equal(m.collision, false));

    // Y con horarios de sobra el reparto tiene que ser bueno de verdad, no solo válido.
    assert.ok(result.avgHappiness >= 4, `promedio ${result.avgHappiness}`);
});

test("proposeMatches: con una tanda grande y revanchas excluidas, nadie repite rival", () => {
    const bloques = [];
    for (let d = 1; d <= 5; d++) {
        for (let h = 8; h <= 20; h++) bloques.push(`2026-09-0${d}-` + String(h).padStart(2, "0"));
    }
    const rnd = makeSeededRandom(99);
    const teams = Array.from({ length: 30 }, (_, i) => "T" + i);
    const happiness = {};
    teams.forEach((t) => {
        const h = {};
        bloques.forEach((b) => (h[b] = rnd() < 0.15 ? 5 : 1));
        happiness[t] = h;
    });
    // Cada equipo ya jugó contra los dos siguientes de la lista.
    const excluded = new Set();
    for (let i = 0; i < teams.length; i++) {
        excluded.add(pairKey(teams[i], teams[(i + 1) % teams.length]));
        excluded.add(pairKey(teams[i], teams[(i + 2) % teams.length]));
    }
    const result = proposeMatches(teams, happiness, excluded, null, bloques);
    assert.equal(result.infeasible, false);
    assert.equal(result.matches.length, 15);
    result.matches.forEach((m) => {
        assert.ok(!excluded.has(pairKey(m.teamA, m.teamB)), `repitió ${m.teamA} vs ${m.teamB}`);
    });
});

test("isPairingFeasible: un equipo que ya jugó contra todos hace infactible la tanda grande", () => {
    // El caso que obliga a que la factibilidad sea EXACTA y no "al codicioso no se le
    // ocurrió": con 20 equipos, uno excluido contra los otros 19 no tiene rival posible.
    const teams = Array.from({ length: 20 }, (_, i) => "T" + i);
    const happiness = {};
    teams.forEach((t) => (happiness[t] = { b0: 4, b1: 4, b2: 4 }));
    assert.equal(isPairingFeasible(teams, happiness), true);
    const excluded = new Set();
    for (let i = 1; i < teams.length; i++) excluded.add(pairKey(teams[0], teams[i]));
    assert.equal(isPairingFeasible(teams, happiness, excluded), false);
    assert.equal(proposeMatches(teams, happiness, excluded).infeasible, true);
});

test("pairKey: es simétrico sin importar el orden de los ids", () => {
    assert.equal(pairKey("x", "y"), pairKey("y", "x"));
});

test("proposeMatches: excludedPairs evita agendar un partido entre 2 equipos que ya se enfrentaron", () => {
    const happiness = {
        A: { "2026-08-17-09": 3, "2026-08-17-10": 3 },
        B: { "2026-08-17-09": 3, "2026-08-17-10": 3 },
        C: { "2026-08-17-09": 3, "2026-08-17-10": 3 },
        D: { "2026-08-17-09": 3, "2026-08-17-10": 3 },
    };
    const excluded = new Set([pairKey("A", "B")]);
    const result = proposeMatches(["A", "B", "C", "D"], happiness, excluded);
    assert.equal(result.infeasible, false);
    const juntos = result.matches.some((m) => [m.teamA, m.teamB].sort().join("") === "AB");
    assert.equal(juntos, false);
});

test("proposeMatches: si excludedPairs deja a un equipo sin ningún rival posible, el resultado es infactible", () => {
    const happiness = { A: { "2026-08-17-09": 3 }, B: { "2026-08-17-09": 3 } };
    const excluded = new Set([pairKey("A", "B")]);
    assert.equal(proposeMatches(["A", "B"], happiness, excluded).infeasible, true);
});

test("proposeMatches: los intercambios de mejora no pueden reintroducir un par excluido", () => {
    // El emparejamiento inicial es válido, pero recombinar A/B y C/D bajaría a A-B —
    // que ya se enfrentaron. La búsqueda tiene que descartar esa opción aunque mejore.
    const happiness = {
        A: { b0: 5, b1: 1 },
        B: { b0: 5, b1: 1 },
        C: { b0: 1, b1: 5 },
        D: { b0: 1, b1: 5 },
    };
    const excluded = new Set([pairKey("A", "B"), pairKey("C", "D")]);
    const result = proposeMatches(["A", "B", "C", "D"], happiness, excluded);
    assert.equal(result.infeasible, false);
    const claves = result.matches.map((m) => [m.teamA, m.teamB].sort().join(""));
    assert.ok(!claves.includes("AB"));
    assert.ok(!claves.includes("CD"));
});

test("isPairingFeasible: detecta el conjunto sin emparejamiento posible sin calcular la propuesta", () => {
    const happiness = { A: { b0: 3 }, B: { b0: 3 }, C: { b0: 3 }, D: { b0: 3 } };
    assert.equal(isPairingFeasible(["A", "B", "C", "D"], happiness), true);
    const excluded = new Set([pairKey("A", "B"), pairKey("A", "C"), pairKey("A", "D")]);
    assert.equal(isPairingFeasible(["A", "B", "C", "D"], happiness, excluded), false);
});

// ---------------------------------------------------------------------------------
// Bye (cantidad impar de equipos)
// ---------------------------------------------------------------------------------

test("suggestByeTeam elige al equipo con menos bloques bien calificados (Buena/Excelente)", () => {
    const teams = ["A", "B", "C"];
    const happinessByTeam = {
        A: { "2026-08-17-09": 1, "2026-08-17-10": 2 }, // 0 bloques >= 4
        B: { "2026-08-17-09": 1, "2026-08-17-10": 2, "2026-08-17-11": 4 }, // 1 bloque >= 4
        C: { "2026-08-17-09": 1, "2026-08-17-10": 2, "2026-08-17-11": 4, "2026-08-17-12": 5 }, // 2
    };
    assert.equal(suggestByeTeam(teams, happinessByTeam), "A");
});

test("suggestByeTeam: un equipo sin ninguna preferencia real es el más fácil de emparejar, no el bye", () => {
    const bloques = ["2026-09-01-08", "2026-09-01-09", "2026-09-01-10"];
    const conDefault = (e) => fillDefaultHappiness(e, bloques, DEFAULT_HAPPINESS_LEVEL);
    const happiness = {
        Indiferente: conDefault({}),
        Restringido: conDefault({ "2026-09-01-08": 4 }),
        Flexible: conDefault({ "2026-09-01-08": 4, "2026-09-01-09": 5, "2026-09-01-10": 4 }),
    };
    const teams = ["Indiferente", "Restringido", "Flexible"];
    assert.equal(suggestByeTeam(teams, happiness), "Restringido");
    assert.equal(rankByeCandidates(teams, happiness).at(-1), "Indiferente");
});

test("suggestByeTeam: a igual flexibilidad, banca a quien más partidos lleva (rota el bye)", () => {
    const happiness = { A: { b0: 4, b1: 1 }, B: { b0: 4, b1: 1 } };
    assert.equal(suggestByeTeam(["A", "B"], happiness, null, { A: 1, B: 3 }), "B");
    assert.equal(suggestByeTeam(["A", "B"], happiness, null, { A: 4, B: 2 }), "A");
});

// ---------------------------------------------------------------------------------
// Balance de dificultad y temperatura
// ---------------------------------------------------------------------------------

test("difficultyBalanceGain: sin nota de dificultad para alguno de los dos, da 0 (neutro)", () => {
    assert.equal(difficultyBalanceGain(null, { totalFaced: 0, matchesCount: 0 }, 8, { totalFaced: 0, matchesCount: 0 }, 5), 0);
    assert.equal(difficultyBalanceGain(8, { totalFaced: 0, matchesCount: 0 }, undefined, { totalFaced: 0, matchesCount: 0 }, 5), 0);
});

test("difficultyBalanceGain: mejora el balance cuando el rival nuevo acerca a ambos a su promedio esperado", () => {
    const facedA = { totalFaced: 0, matchesCount: 1 }; // imbalance = 0 - 1*5 = -5
    const facedB = { totalFaced: 0, matchesCount: 0 };
    assert.ok(difficultyBalanceGain(3, facedA, 9, facedB, 5) > 0);
});

test("difficultyBalanceGain: empeora el balance cuando el rival nuevo aleja a ambos de su promedio esperado", () => {
    const facedA = { totalFaced: 10, matchesCount: 1 }; // imbalance = +5
    const facedB = { totalFaced: 0, matchesCount: 0 };
    assert.ok(difficultyBalanceGain(3, facedA, 9, facedB, 5) < 0);
});

test("proposeMatches: sin difficultyContext el resultado es determinista y reproducible", () => {
    const primero = proposeMatches(FOUR_TEAMS, FOUR_TEAM_HAPPINESS);
    for (let i = 0; i < 5; i++) {
        const otro = proposeMatches(FOUR_TEAMS, FOUR_TEAM_HAPPINESS, null, undefined);
        assert.deepEqual(otro.matches, primero.matches);
        assert.equal(otro.totalScore, primero.totalScore);
    }
});

test("proposeMatches: con difficultyContext, el criterio de dificultad puede cambiar el emparejamiento elegido", () => {
    // Los 4 equipos comparten dos bloques con la MISMA nota — la felicidad da lo mismo
    // para cualquier par, así que el único criterio que puede desempatar es la
    // dificultad. Temperatura en 0 para que el test sea determinista.
    const teams = ["T1", "T2", "T3", "T4"];
    const flatHappiness = {
        T1: { b0: 3, b1: 3 },
        T2: { b0: 3, b1: 3 },
        T3: { b0: 3, b1: 3 },
        T4: { b0: 3, b1: 3 },
    };
    const baseline = proposeMatches(teams, flatHappiness).matches
        .map((m) => [m.teamA, m.teamB].sort())
        .sort((a, b) => a[0].localeCompare(b[0]));
    assert.deepEqual(baseline, [["T1", "T2"], ["T3", "T4"]]);

    const difficultyContext = {
        difficultyByTeam: { T1: 9, T2: 1, T3: 9, T4: 1 },
        facedByTeam: {
            T1: { totalFaced: 0, matchesCount: 1 },
            T2: { totalFaced: 10, matchesCount: 1 },
            T3: { totalFaced: 0, matchesCount: 1 },
            T4: { totalFaced: 10, matchesCount: 1 },
        },
        targetAvg: 5,
        temperature: 0,
    };
    const conDificultad = proposeMatches(teams, flatHappiness, null, difficultyContext).matches
        .map((m) => [m.teamA, m.teamB].sort())
        .sort((a, b) => a[0].localeCompare(b[0]));
    assert.deepEqual(conDificultad, [["T1", "T3"], ["T2", "T4"]]);
});

test("proposeMatches: el ajuste por dificultad no puede dar vuelta un sacrificio", () => {
    // La nota de dificultad es 1-10 y el gain viene en esos puntos, no en la escala del
    // score: sin acotarlo, un solo emparejamiento bien balanceado pesaba más que el
    // rango completo de la felicidad y la dificultad decidía sola.
    const happiness = {
        A: { b0: 5, b1: 5 },
        B: { b0: 5, b1: 1 },
        C: { b0: 5, b1: 1 },
        D: { b0: 5, b1: 5 },
    };
    // Emparejar B con C (los dos solo pueden en b0) es lo único que evita un sacrificio.
    const difficultyContext = {
        difficultyByTeam: { A: 10, B: 10, C: 1, D: 1 },
        facedByTeam: {
            A: { totalFaced: 50, matchesCount: 5 },
            B: { totalFaced: 5, matchesCount: 5 },
            C: { totalFaced: 50, matchesCount: 5 },
            D: { totalFaced: 5, matchesCount: 5 },
        },
        targetAvg: 5.5,
        temperature: 0,
    };
    const result = proposeMatches(["A", "B", "C", "D"], happiness, null, difficultyContext);
    assert.equal(result.sacrificed.length, 0, "la dificultad no puede justificar sacrificar a nadie");
    assert.ok(DIFFICULTY_WEIGHT < SACRIFICE_PENALTY);
});

test("proposeMatches: con temperatura, dos bloques igual de buenos no salen siempre en el mismo", () => {
    // La temperatura sola es un número por PAR, idéntico en todos sus bloques: variaba a
    // quién le tocaba con quién pero jamás el horario elegido entre empates exactos.
    const happiness = { A: { b0: 3, b1: 3, b2: 3 }, B: { b0: 3, b1: 3, b2: 3 } };
    const vistos = new Set();
    for (let i = 0; i < 60; i++) {
        const result = proposeMatches(["A", "B"], happiness, null, {
            difficultyByTeam: {},
            facedByTeam: {},
            targetAvg: 0,
            temperature: DEFAULT_TEMPERATURE,
        });
        vistos.add(result.matches[0].block);
    }
    assert.ok(vistos.size > 1, "siempre eligió el mismo bloque entre empates exactos");
});

test("proposeMatches: la temperatura no alcanza para mover un partido a un horario peor", () => {
    const happiness = { A: { b0: 5, b1: 3, b2: 1 }, B: { b0: 5, b1: 3, b2: 1 } };
    for (let i = 0; i < 40; i++) {
        const result = proposeMatches(["A", "B"], happiness, null, {
            difficultyByTeam: {},
            facedByTeam: {},
            targetAvg: 0,
            temperature: DEFAULT_TEMPERATURE,
        });
        assert.equal(result.matches[0].block, "b0");
    }
});
