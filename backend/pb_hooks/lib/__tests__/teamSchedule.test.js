const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    startOfWeek,
    windowBlockCodes,
    normalizeTeamHappiness,
    filterToBlocks,
    computeValidBlocks,
    fillDefaultHappiness,
    computePairEdge,
    pairKey,
    buildEdges,
    findTightestThreshold,
    maxWeightMatching,
    suggestByeTeam,
    proposeMatches,
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

test("windowBlockCodes: 3 semanas x 5 días (lun-vie) x 11 horas (9 a 19) = 165 bloques, sin sábado ni domingo", () => {
    const codes = windowBlockCodes(new Date(2026, 7, 19), 3);
    assert.equal(codes.length, 165);
    assert.equal(codes[0], "2026-08-17-09"); // lunes
    assert.equal(codes[10], "2026-08-17-19");
    assert.equal(codes[11], "2026-08-18-09"); // martes
    assert.equal(codes[codes.length - 1], "2026-09-04-19"); // viernes de la 3ra semana

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
    // fuertemente el segundo bloque. El emparejamiento debe poder usar igual el bloque
    // donde D es feliz, porque para C (normalizado a 0.5 parejo) da lo mismo cuál elegir.
    const result = proposeMatches(["C", "D"], {
        C: { "2026-08-17-09": 3, "2026-08-17-10": 3 },
        D: { "2026-08-17-09": 1, "2026-08-17-10": 4 },
    });
    assert.equal(result.infeasible, false);
    assert.equal(result.matches[0].block, "2026-08-17-10");
    assert.equal(result.matches[0].gap, 0.5); // |0.5 - 1.0|
});
