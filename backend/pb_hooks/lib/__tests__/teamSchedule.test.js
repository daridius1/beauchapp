const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    startOfWeek,
    windowBlockCodes,
    pastBlockCodes,
    normalizeTeamHappiness,
    filterToBlocks,
    computeValidBlocks,
    fillDefaultHappiness,
    DEFAULT_HAPPINESS_LEVEL,
    computePairEdge,
    pairKey,
    buildEdges,
    findTightestThreshold,
    maxWeightMatching,
    suggestByeTeam,
    proposeMatches,
    difficultyBalanceGain,
} = require("../teamSchedule.js");

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

test("normalizeTeamHappiness: min-max estándar sobre todos los bloques (sin ningún valor excluido)", () => {
    const norm = normalizeTeamHappiness({ "2026-08-17-09": 4, "2026-08-17-10": 2, "2026-08-17-11": 1 });
    assert.equal(norm["2026-08-17-09"], 1);
    assert.equal(norm["2026-08-17-10"], 1 / 3);
    assert.equal(norm["2026-08-17-11"], 0); // "muy mala" es solo el extremo inferior, no queda excluido
});

test("normalizeTeamHappiness: todo igual (anti-trampa) queda plano en 0.5", () => {
    const norm = normalizeTeamHappiness({ "2026-08-17-09": 4, "2026-08-17-10": 4, "2026-08-17-11": 4 });
    assert.equal(norm["2026-08-17-09"], 0.5);
    assert.equal(norm["2026-08-17-10"], 0.5);
    assert.equal(norm["2026-08-17-11"], 0.5);
});

test("normalizeTeamHappiness: un solo bloque también queda en 0.5", () => {
    const norm = normalizeTeamHappiness({ "2026-08-17-09": 3 });
    assert.equal(norm["2026-08-17-09"], 0.5);
});

test("normalizeTeamHappiness: objeto vacío devuelve objeto vacío", () => {
    const norm = normalizeTeamHappiness({});
    assert.deepEqual(norm, {});
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

test("computePairEdge: sin bloques en común es infactible (null)", () => {
    const edge = computePairEdge({ "2026-08-17-09": 1 }, { "2026-08-17-10": 1 });
    assert.equal(edge, null);
});

test("computePairEdge: elige el bloque de menor diferencia, empate resuelto por mayor suma", () => {
    // Bloque A: gap 0.5, score 1.0 | Bloque B: gap 0.5, score 1.5 -> debe elegir B por score
    const edge = computePairEdge(
        { "2026-08-17-09": 0.75, "2026-08-17-10": 1.0 },
        { "2026-08-17-09": 0.25, "2026-08-17-10": 0.5 }
    );
    assert.equal(edge.block, "2026-08-17-10");
    assert.equal(edge.gap, 0.5);
    assert.equal(edge.score, 1.5);
});

test("suggestByeTeam elige al equipo con menos bloques bien calificados (Buena/Excelente)", () => {
    const teams = ["A", "B", "C"];
    const happinessByTeam = {
        A: { "2026-08-17-09": 1, "2026-08-17-10": 2 }, // 0 bloques >= 4
        B: { "2026-08-17-09": 1, "2026-08-17-10": 2, "2026-08-17-11": 4 }, // 1 bloque >= 4
        C: { "2026-08-17-09": 1, "2026-08-17-10": 2, "2026-08-17-11": 4, "2026-08-17-12": 5 }, // 2 bloques >= 4
    };
    assert.equal(suggestByeTeam(teams, happinessByTeam), "A");
});

// Ejemplo de 4 equipos calculado a mano (ver el plan/diseño): T1 es el menos flexible
// (su tercer bloque es "muy mala", nota 1). El único emparejamiento perfecto con
// gap=0 es (T1,T2)+(T3,T4), con score total 4.0 — cualquier otro resultado indica un
// bug en el umbral o en el DP de matching.
const FOUR_TEAM_HAPPINESS = {
    T1: { "2026-08-17-09": 4, "2026-08-17-10": 2, "2026-08-17-11": 1 },
    T2: { "2026-08-17-09": 3, "2026-08-17-10": 3, "2026-08-17-11": 1 },
    T3: { "2026-08-17-09": 1, "2026-08-17-10": 4, "2026-08-17-11": 4 },
    T4: { "2026-08-17-09": 2, "2026-08-17-10": 1, "2026-08-17-11": 3 },
};
const FOUR_TEAMS = ["T1", "T2", "T3", "T4"];

test("findTightestThreshold + maxWeightMatching: ejemplo de 4 equipos calculado a mano", () => {
    const edges = buildEdges(FOUR_TEAMS, FOUR_TEAM_HAPPINESS);
    const threshold = findTightestThreshold(FOUR_TEAMS.length, edges);
    assert.equal(threshold, 0);

    const result = maxWeightMatching(FOUR_TEAMS.length, edges, threshold);
    assert.equal(result.totalScore, 4);

    const pairsAsNames = result.pairs
        .map(([i, j]) => [FOUR_TEAMS[i], FOUR_TEAMS[j]].sort())
        .sort((a, b) => a[0].localeCompare(b[0]));
    assert.deepEqual(pairsAsNames, [["T1", "T2"], ["T3", "T4"]]);
});

test("proposeMatches: mismo ejemplo de 4 equipos, ids y bloques correctos", () => {
    const result = proposeMatches(FOUR_TEAMS, FOUR_TEAM_HAPPINESS);
    assert.equal(result.infeasible, false);
    assert.equal(result.threshold, 0);
    assert.equal(result.totalScore, 4);
    assert.equal(result.matches.length, 2);

    const t1t2 = result.matches.find(
        (m) => (m.teamA === "T1" && m.teamB === "T2") || (m.teamA === "T2" && m.teamB === "T1")
    );
    assert.ok(t1t2, "debe existir el partido T1-T2");
    assert.equal(t1t2.block, "2026-08-17-09");
    assert.equal(t1t2.gap, 0);

    const t3t4 = result.matches.find(
        (m) => (m.teamA === "T3" && m.teamB === "T4") || (m.teamA === "T4" && m.teamB === "T3")
    );
    assert.ok(t3t4, "debe existir el partido T3-T4");
    assert.equal(t3t4.block, "2026-08-17-11");
    assert.equal(t3t4.gap, 0);
});

test("proposeMatches: cantidad impar de equipos lanza error explícito", () => {
    assert.throws(() => proposeMatches(["A", "B", "C"], {}), /par de equipos/);
});

test("proposeMatches: cero equipos devuelve resultado vacío sin error", () => {
    const result = proposeMatches([], {});
    assert.deepEqual(result, { threshold: null, totalScore: 0, matches: [], infeasible: false });
});

test("proposeMatches: par sin ningún solapamiento es infactible", () => {
    const result = proposeMatches(["A", "B"], {
        A: { "2026-08-17-09": 3 },
        B: { "2026-08-17-10": 3 },
    });
    assert.equal(result.infeasible, true);
    assert.equal(result.matches, null);
});

test("proposeMatches: dos partidos del mismo batch no pueden quedar en el mismo bloque horario", () => {
    // Los 4 equipos tienen exactamente el mismo perfil (aman el bloque "09", son
    // indiferentes al "10") — sin la corrección, T1-T2 y T3-T4 elegirían de forma
    // independiente el mismo "mejor" bloque ("09"), agendando dos partidos a la vez.
    const happiness = {
        T1: { "2026-08-17-09": 4, "2026-08-17-10": 1 },
        T2: { "2026-08-17-09": 4, "2026-08-17-10": 1 },
        T3: { "2026-08-17-09": 4, "2026-08-17-10": 1 },
        T4: { "2026-08-17-09": 4, "2026-08-17-10": 1 },
    };
    const result = proposeMatches(["T1", "T2", "T3", "T4"], happiness);
    assert.equal(result.infeasible, false);
    assert.equal(result.matches.length, 2);

    const blocks = result.matches.map((m) => m.block);
    assert.notEqual(blocks[0], blocks[1]);
    assert.deepEqual(new Set(blocks), new Set(["2026-08-17-09", "2026-08-17-10"]));
});

test("proposeMatches: si no hay ningún bloque alternativo en común, el choque queda como límite conocido (no revienta)", () => {
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
});

test("pairKey: es simétrico sin importar el orden de los ids", () => {
    assert.equal(pairKey("x", "y"), pairKey("y", "x"));
});

test("proposeMatches: excludedPairs evita agendar un partido entre 2 equipos que ya se enfrentaron", () => {
    const happiness = {
        A: { "2026-08-17-09": 3 },
        B: { "2026-08-17-09": 3 },
        C: { "2026-08-17-09": 3 },
        D: { "2026-08-17-09": 3 },
    };
    const excluded = new Set([pairKey("A", "B")]);
    const result = proposeMatches(["A", "B", "C", "D"], happiness, excluded);
    assert.equal(result.infeasible, false);
    assert.equal(result.matches.length, 2);
    const hasABTogether = result.matches.some(
        (m) => (m.teamA === "A" && m.teamB === "B") || (m.teamA === "B" && m.teamB === "A")
    );
    assert.equal(hasABTogether, false);
});

test("proposeMatches: si excludedPairs deja a un equipo sin ningún rival posible, el resultado es infactible", () => {
    const happiness = {
        A: { "2026-08-17-09": 3 },
        B: { "2026-08-17-09": 3 },
    };
    const excluded = new Set([pairKey("A", "B")]);
    const result = proposeMatches(["A", "B"], happiness, excluded);
    assert.equal(result.infeasible, true);
});

test("proposeMatches: equipo que marca todo igual no se beneficia frente a uno que sí diferencia", () => {
    // C marca "3" parejo en ambos bloques (plano, sin señal). D distingue: prefiere
    // fuertemente el segundo bloque. El emparejamiento debe usar el bloque donde D es
    // feliz, porque para C (plano) da lo mismo cuál elegir — su "gap" contra D no mide
    // una preferencia real, así que no cuenta como diferencia de justicia (gap 0).
    const result = proposeMatches(["C", "D"], {
        C: { "2026-08-17-09": 3, "2026-08-17-10": 3 },
        D: { "2026-08-17-09": 1, "2026-08-17-10": 4 },
    });
    assert.equal(result.infeasible, false);
    assert.equal(result.matches[0].block, "2026-08-17-10");
    assert.equal(result.matches[0].gap, 0);
});

test("proposeMatches: con más de 2 bloques en común, un equipo plano no debe arrastrar al otro a un bloque mediocre", () => {
    // Malwekas no diferenció nada (todo "Regular"): les da lo mismo cualquier bloque.
    // Temerarias sí diferenció: "09" es mediocre (Buena=3), "10" es pésimo (1),
    // "11" es excelente (5). Con solo 2 bloques posibles (test anterior) el criterio de
    // "menor gap" coincidía por casualidad con el mejor bloque de quien diferencia;
    // con 3+ bloques deja de ser así: minimizar el gap contra el 0.5 plano de Malwekas
    // elige el bloque cuyo valor normalizado quede más CERCA de 0.5 — el mediocre "09"
    // (que normaliza justo a 0.5), no el excelente "11" — porque a Malwekas, al no
    // haber diferenciado nada, "0.5" no representa ninguna preferencia real.
    const result = proposeMatches(["Malwekas", "Temerarias"], {
        Malwekas: { "2026-08-31-09": 2, "2026-08-31-10": 2, "2026-08-31-11": 2 },
        Temerarias: { "2026-08-31-09": 3, "2026-08-31-10": 1, "2026-08-31-11": 5 },
    });
    assert.equal(result.infeasible, false);
    assert.equal(result.matches[0].block, "2026-08-31-11");
});

test("proposeMatches: caso real (Malvvekas/Temerarias, Copa CDI Femenina) — 2 bloques nunca contestados (default) no deben tapar la disponibilidad real del rival", () => {
    // Reproduce el patrón real: Malvvekas calificó EXPLÍCITAMENTE toda la semana "Muy
    // mala" (1) salvo 2 horas que nunca tocó (quedaron en el default "Regular"=2 al
    // pasar por fillDefaultHappiness, tal como hace league.pb.js antes de llamar acá).
    // Sin distinguir explícito de default, ese único valor distinto ya bastaba para que
    // minimizar el gap arrastrara a Temerarias (que sí diferenció, y tiene un bloque
    // excelente) a un bloque mediocre en vez de a su mejor horario.
    const week = ["09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19"];
    const malvvekasExplicito = {};
    week.forEach((h) => (malvvekasExplicito[`2026-08-31-${h}`] = 1));
    // "08" y "20" NO están acá — nunca los contestó, quedan en el default más abajo.

    const temerariasExplicito = {
        "2026-08-31-08": 2,
        "2026-08-31-09": 2,
        "2026-08-31-10": 1,
        "2026-08-31-11": 1,
        "2026-08-31-12": 2,
        "2026-08-31-13": 2,
        "2026-08-31-14": 2,
        "2026-08-31-15": 3,
        "2026-08-31-16": 4,
        "2026-08-31-17": 4,
        "2026-08-31-18": 5, // su mejor bloque real
        "2026-08-31-19": 4,
        "2026-08-31-20": 2,
    };

    const allBlocks = [...week.map((h) => `2026-08-31-${h}`), "2026-08-31-08", "2026-08-31-20"];
    const happinessByTeam = {
        Malvvekas: fillDefaultHappiness(malvvekasExplicito, allBlocks, DEFAULT_HAPPINESS_LEVEL),
        Temerarias: fillDefaultHappiness(temerariasExplicito, allBlocks, DEFAULT_HAPPINESS_LEVEL),
    };
    const explicitBlocksByTeam = {
        Malvvekas: new Set(Object.keys(malvvekasExplicito)),
        Temerarias: new Set(Object.keys(temerariasExplicito)),
    };

    const result = proposeMatches(["Malvvekas", "Temerarias"], happinessByTeam, null, null, explicitBlocksByTeam);
    assert.equal(result.infeasible, false);
    assert.equal(result.matches[0].block, "2026-08-31-18");
});

test("proposeMatches: caso real (La CIB/Amigues, Copa CDI Mixta) — 184 de 195 bloques en 'Muy mala' SÍ es preferencia real y no debe tratarse como plana", () => {
    // La CIB contestó las 195 horas de la ventana: 184 "Muy mala" (1) y 11 genuinamente
    // buenas (4 o 5) — differentiación real y deliberada, no ruido. Amigues nunca marcó
    // nada (0 respuestas, todo default). Con la heurística vieja ("¿qué nota domina?"),
    // el 94% de La CIB en "Muy mala" la hacía ver "plana" igual que Amigues, y ambos
    // equipos quedaban con a=b=0.5 en TODOS los bloques — el desempate por suma ya no
    // distinguía nada, y ganaba el primer bloque de la ventana (arbitrario, y en la
    // práctica uno de los peores para La CIB). La corrección: solo Amigues (0 respuestas
    // explícitas) debe tratarse como sin preferencia; La CIB conserva su voto real.
    const blocks = [];
    for (let i = 0; i < 195; i++) blocks.push(`2026-09-0${(i % 9) + 1}-b${i}`); // códigos ficticios, alcanza con ser únicos
    const cibExplicito = {};
    blocks.forEach((b, i) => (cibExplicito[b] = i < 184 ? 1 : i < 189 ? 5 : 4));
    const mejorBloqueCIB = blocks[184]; // el primero de los 11 buenos (nota 5)

    const happinessByTeam = {
        LaCIB: fillDefaultHappiness(cibExplicito, blocks, DEFAULT_HAPPINESS_LEVEL),
        Amigues: fillDefaultHappiness({}, blocks, DEFAULT_HAPPINESS_LEVEL),
    };
    const explicitBlocksByTeam = {
        LaCIB: new Set(Object.keys(cibExplicito)),
        Amigues: new Set(), // nunca contestó nada
    };

    const result = proposeMatches(["LaCIB", "Amigues"], happinessByTeam, null, null, explicitBlocksByTeam);
    assert.equal(result.infeasible, false);
    assert.equal(result.matches[0].block, mejorBloqueCIB);
    assert.equal(result.matches[0].happinessA, 5);
});

// ---------------------------------------------------------------------------------
// windowBlockRange — el rango que permite acotar las consultas a la ventana móvil en
// vez de recorrer todo el historial de partidos. Ver auditoria-2026-08-19.md §4.3.
// ---------------------------------------------------------------------------------

const { windowBlockRange } = require("../teamSchedule.js");

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

// ---------------------------------------------------------------------------------
// pastBlockCodes — caso real: un admin generó "Sugerir partidos" un domingo y la
// ventana móvil (que arranca en el lunes de la semana ACTUAL) incluyó bloques de esa
// misma semana que ya habían pasado, dejando agendar un partido en el pasado.
// ---------------------------------------------------------------------------------

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

// --- Balance de dificultad (difficultyBalanceGain / buildEdges / proposeMatches) ---

test("difficultyBalanceGain: sin nota de dificultad para alguno de los dos, da 0 (neutro)", () => {
    assert.equal(difficultyBalanceGain(null, { totalFaced: 0, matchesCount: 0 }, 8, { totalFaced: 0, matchesCount: 0 }, 5), 0);
    assert.equal(difficultyBalanceGain(8, { totalFaced: 0, matchesCount: 0 }, undefined, { totalFaced: 0, matchesCount: 0 }, 5), 0);
});

test("difficultyBalanceGain: mejora el balance cuando el rival nuevo acerca a ambos a su promedio esperado", () => {
    // A ya enfrentó rivales fáciles (imbalance -5, "necesita" un rival difícil ahora).
    // B tiene nota 9 (difícil) — emparejarlos acerca a A hacia 0.
    const facedA = { totalFaced: 0, matchesCount: 1 }; // imbalance = 0 - 1*5 = -5
    const facedB = { totalFaced: 0, matchesCount: 0 }; // sin historial, imbalance 0
    const gain = difficultyBalanceGain(3, facedA, 9, facedB, 5);
    assert.ok(gain > 0, `se esperaba gain positivo, dio ${gain}`);
});

test("difficultyBalanceGain: empeora el balance cuando el rival nuevo aleja a ambos de su promedio esperado", () => {
    // A ya enfrentó rivales difíciles (imbalance +5, "necesita" un rival fácil ahora),
    // pero B también tiene nota alta (9) — el emparejamiento lo aleja más de 0.
    const facedA = { totalFaced: 10, matchesCount: 1 }; // imbalance = 10 - 1*5 = +5
    const facedB = { totalFaced: 0, matchesCount: 0 };
    const gain = difficultyBalanceGain(3, facedA, 9, facedB, 5);
    assert.ok(gain < 0, `se esperaba gain negativo, dio ${gain}`);
});

test("buildEdges/proposeMatches: sin difficultyContext (u omitido/undefined), el resultado es IDÉNTICO al de siempre", () => {
    const edgesSinContexto = buildEdges(FOUR_TEAMS, FOUR_TEAM_HAPPINESS);
    const edgesConUndefined = buildEdges(FOUR_TEAMS, FOUR_TEAM_HAPPINESS, null, undefined);
    assert.deepEqual(edgesSinContexto, edgesConUndefined);

    const result = proposeMatches(FOUR_TEAMS, FOUR_TEAM_HAPPINESS, null, undefined);
    assert.equal(result.threshold, 0);
    assert.equal(result.totalScore, 4);
    const pairsAsNames = result.matches
        .map((m) => [m.teamA, m.teamB].sort())
        .sort((a, b) => a[0].localeCompare(b[0]));
    assert.deepEqual(pairsAsNames, [["T1", "T2"], ["T3", "T4"]]);
});

test("proposeMatches: con difficultyContext, el criterio de dificultad puede cambiar el emparejamiento elegido", () => {
    // Los 4 equipos comparten un único bloque con la MISMA nota — así la felicidad da
    // exactamente el mismo score (1.0) para CUALQUIER par posible, y el único criterio
    // que puede desempatar es la dificultad. Temperatura en 0 para que el test sea
    // determinista (sin aleatoriedad).
    const teams = ["T1", "T2", "T3", "T4"];
    const flatHappiness = {
        T1: { "2026-08-17-09": 3 },
        T2: { "2026-08-17-09": 3 },
        T3: { "2026-08-17-09": 3 },
        T4: { "2026-08-17-09": 3 },
    };

    // Sin dificultad: el DP resuelve el empate por orden natural, T1-T2 + T3-T4.
    const baseline = proposeMatches(teams, flatHappiness);
    const baselinePairs = baseline.matches
        .map((m) => [m.teamA, m.teamB].sort())
        .sort((a, b) => a[0].localeCompare(b[0]));
    assert.deepEqual(baselinePairs, [["T1", "T2"], ["T3", "T4"]]);

    // T1 y T3 ya enfrentaron rivales flojos (imbalance -5, "necesitan" un rival duro);
    // T2 y T4 ya enfrentaron rivales duros (imbalance +5, "necesitan" uno flojo). T1 y
    // T3 tienen nota 9 (duros); T2 y T4 tienen nota 1 (fáciles) — emparejar T1-T3 y
    // T2-T4 mejora el balance de los 4 a la vez; T1-T2 y T3-T4 lo empeora de los 4.
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
    const withDifficulty = proposeMatches(teams, flatHappiness, null, difficultyContext);
    const withDifficultyPairs = withDifficulty.matches
        .map((m) => [m.teamA, m.teamB].sort())
        .sort((a, b) => a[0].localeCompare(b[0]));
    assert.deepEqual(withDifficultyPairs, [["T1", "T3"], ["T2", "T4"]]);
});
