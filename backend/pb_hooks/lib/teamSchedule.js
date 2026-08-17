// Lógica pura del sistema de "Horarios": la ventana de fechas marcable, normalización
// anti-trampa, y el emparejamiento de equipos que minimiza la diferencia de felicidad
// y, dentro de eso, maximiza la felicidad total. Sin $app — testeado en
// __tests__/teamSchedule.test.js.

const START_HOUR = 9;
const END_HOUR = 19; // último bloque: 19:00-20:00
const DAYS_PER_WEEK = 7;
const WEEKS_WINDOW = 3; // semana actual + 2 más
const DEFAULT_HAPPINESS_LEVEL = 2; // "Regular" — el default para todo equipo que no calificó un bloque

const EPS = 1e-9;

function pad2(n) {
    return String(n).padStart(2, "0");
}

function formatDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Lunes de la semana que contiene `date` (hora local, normalizada a medianoche).
function startOfWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = d.getDay(); // 0 (dom) .. 6 (sáb)
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diffToMonday);
    return d;
}

function blockCode(dateStr, hour) {
    return `${dateStr}-${pad2(hour)}`;
}

// { date, hour } a partir de un blockCode "YYYY-MM-DD-HH".
function parseBlockCode(code) {
    const hour = Number(code.slice(-2));
    const date = code.slice(0, -3);
    return { date, hour };
}

// Todos los códigos de bloque de la ventana móvil de `weeks` semanas (incluyendo la
// semana que contiene `referenceDate`) — es lo único que reemplaza al concepto de
// "ronda": la ventana marcable es siempre la misma regla relativa a hoy, ningún admin
// tiene que abrir nada de antemano.
function windowBlockCodes(referenceDate, weeks) {
    const ref = referenceDate || new Date();
    const totalWeeks = weeks || WEEKS_WINDOW;
    const start = startOfWeek(ref);
    const codes = [];
    const totalDays = totalWeeks * DAYS_PER_WEEK;
    for (let i = 0; i < totalDays; i++) {
        const day = new Date(start);
        day.setDate(day.getDate() + i);
        const dateStr = formatDate(day);
        for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
            codes.push(blockCode(dateStr, hour));
        }
    }
    return codes;
}

// Reescala las respuestas de UN equipo según su propia distribución antes de comparar
// contra otros equipos — es el mecanismo anti-trampa: si un equipo marca todo con la
// misma nota (ej. "excelente" en todos lados), max=min y todos sus bloques quedan
// planos en 0.5, sin diferenciación real que le sirva para gamear el emparejamiento.
// No hay ningún valor especial que excluya un bloque — "muy mala disponibilidad" es
// simplemente el extremo inferior de la misma escala, todos los bloques compiten igual.
function normalizeTeamHappiness(happiness) {
    const entries = Object.entries(happiness || {});
    if (entries.length === 0) return {};

    const values = entries.map(([, v]) => v);
    const min = Math.min(...values);
    const max = Math.max(...values);

    const normalized = {};
    for (const [block, v] of entries) {
        normalized[block] = max > min ? (v - min) / (max - min) : 0.5;
    }
    return normalized;
}

// Se queda solo con las entradas de `happiness` cuya clave está en `allowedBlocks` —
// usado para sanear datos guardados que puedan incluir bloques que salieron de la
// ventana marcable o que un admin bloqueó después de que el equipo ya había enviado.
function filterToBlocks(happiness, allowedBlocks) {
    const allowedSet = new Set(allowedBlocks);
    const result = {};
    for (const [block, v] of Object.entries(happiness || {})) {
        if (allowedSet.has(block)) result[block] = v;
    }
    return result;
}

// `windowBlocks` menos todo lo que aparezca en cualquiera de `excludedBlockLists` —
// junta en un solo lugar los bloques que un admin cerró a mano y los que ya quedaron
// "ocupados" por un partido confirmado (de horarios o de una liga), para que ningún
// nuevo partido pueda pisar un bloque ya usado.
function computeValidBlocks(windowBlocks, excludedBlockLists) {
    const excluded = new Set();
    (excludedBlockLists || []).forEach((list) => (list || []).forEach((b) => excluded.add(b)));
    return windowBlocks.filter((b) => !excluded.has(b));
}

// No existe tal cosa como "disponibilidad enviada": todo equipo tiene, por defecto,
// disponibilidad "Regular" en cada bloque hasta que la cambie explícitamente. Esto
// arma el input completo del algoritmo para UN equipo combinando lo que sí guardó con
// el default para todo lo demás — así un equipo que nunca abrió la pantalla compite en
// el emparejamiento exactamente igual que uno que sí la abrió y no tocó nada.
function fillDefaultHappiness(happiness, allowedBlocks, defaultLevel) {
    const result = {};
    for (const b of allowedBlocks) {
        const v = (happiness || {})[b];
        result[b] = v !== undefined ? v : defaultLevel;
    }
    return result;
}

// Mejor bloque en común entre dos equipos ya normalizados: primero minimiza la
// diferencia de felicidad (justicia), y entre empates maximiza la suma (felicidad
// total). null si no comparten ningún bloque con disponibilidad real (par infactible).
function computePairEdge(normA, normB) {
    const commonBlocks = Object.keys(normA).filter((b) => b in normB);
    if (commonBlocks.length === 0) return null;

    let best = null;
    for (const block of commonBlocks) {
        const a = normA[block];
        const b = normB[block];
        const gap = Math.abs(a - b);
        const score = a + b;
        if (
            best === null ||
            gap < best.gap - EPS ||
            (Math.abs(gap - best.gap) <= EPS && score > best.score)
        ) {
            best = { block, gap, score };
        }
    }
    return best;
}

// edges[i][j] (i<j) = computePairEdge(equipo i, equipo j) | null, para cada índice
// en el arreglo `teams`.
function buildEdges(teams, happinessByTeam) {
    const normalized = teams.map((t) => normalizeTeamHappiness((happinessByTeam || {})[t] || {}));
    const n = teams.length;
    const edges = {};
    for (let i = 0; i < n; i++) {
        edges[i] = {};
        for (let j = i + 1; j < n; j++) {
            edges[i][j] = computePairEdge(normalized[i], normalized[j]);
        }
    }
    return edges;
}

function edgeBetween(edges, i, j) {
    return i < j ? edges[i][j] : edges[j][i];
}

// ¿Existe un emparejamiento perfecto (todos los equipos cubiertos) usando solo pares
// con gap ≤ threshold? DP con bitmask sobre subconjuntos de equipos — cómodo hasta
// ~16-18 equipos (2^n estados).
function perfectMatchingExists(n, edges, threshold) {
    const full = (1 << n) - 1;
    const memo = new Map();

    function dp(mask) {
        if (mask === full) return true;
        if (memo.has(mask)) return memo.get(mask);

        let i = 0;
        while (i < n && (mask & (1 << i)) !== 0) i++;

        let result = false;
        for (let j = i + 1; j < n; j++) {
            if (mask & (1 << j)) continue;
            const edge = edgeBetween(edges, i, j);
            if (edge && edge.gap <= threshold + EPS) {
                if (dp(mask | (1 << i) | (1 << j))) {
                    result = true;
                    break;
                }
            }
        }
        memo.set(mask, result);
        return result;
    }

    return dp(0);
}

// Umbral de justicia más ajustado posible: el menor gap tal que todavía exista un
// emparejamiento perfecto para el conjunto de equipos elegido. null si ningún umbral
// alcanza (ej. algún equipo quedaría sin ningún par posible).
function findTightestThreshold(n, edges) {
    const gaps = new Set();
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (edges[i][j]) gaps.add(edges[i][j].gap);
        }
    }
    const sortedGaps = Array.from(gaps).sort((a, b) => a - b);
    for (const t of sortedGaps) {
        if (perfectMatchingExists(n, edges, t)) return t;
    }
    return null;
}

// Entre los emparejamientos perfectos que respetan el umbral, el que maximiza la
// felicidad total (suma de scores). Devuelve { totalScore, pairs } con pairs como
// pares de ÍNDICES (no ids), o null si no hay ningún emparejamiento válido bajo threshold.
function maxWeightMatching(n, edges, threshold) {
    const full = (1 << n) - 1;
    const memo = new Map();

    function dp(mask) {
        if (mask === full) return 0;
        if (memo.has(mask)) return memo.get(mask);

        let i = 0;
        while (i < n && (mask & (1 << i)) !== 0) i++;

        let best = -Infinity;
        for (let j = i + 1; j < n; j++) {
            if (mask & (1 << j)) continue;
            const edge = edgeBetween(edges, i, j);
            if (edge && edge.gap <= threshold + EPS) {
                const candidate = edge.score + dp(mask | (1 << i) | (1 << j));
                if (candidate > best) best = candidate;
            }
        }
        memo.set(mask, best);
        return best;
    }

    const totalScore = dp(0);
    if (totalScore === -Infinity) return null;

    // Reconstruir los pares recorriendo el mismo DP (ya memoizado) de forma greedy.
    const pairs = [];
    let mask = 0;
    while (mask !== full) {
        let i = 0;
        while (i < n && (mask & (1 << i)) !== 0) i++;

        let chosenJ = -1;
        for (let j = i + 1; j < n; j++) {
            if (mask & (1 << j)) continue;
            const edge = edgeBetween(edges, i, j);
            if (!edge || edge.gap > threshold + EPS) continue;
            const nextMask = mask | (1 << i) | (1 << j);
            const candidate = edge.score + dp(nextMask);
            if (Math.abs(candidate - memo.get(mask)) <= EPS) {
                chosenJ = j;
                break;
            }
        }
        if (chosenJ === -1) {
            throw new Error("No se pudo reconstruir el emparejamiento óptimo (bug interno).");
        }
        pairs.push([i, chosenJ]);
        mask = mask | (1 << i) | (1 << chosenJ);
    }

    return { totalScore, pairs };
}

// Con cantidad impar de equipos, sugiere dejar libre al que tiene menos bloques bien
// calificados (Buena o Excelente) — el que de todas formas sería más difícil de
// emparejar con una felicidad alta para ambos lados.
const FLEXIBLE_THRESHOLD = 3; // Buena=3, Excelente=4

function suggestByeTeam(teams, happinessByTeam) {
    let leastFlexible = null;
    let minCount = Infinity;
    for (const t of teams) {
        const happiness = (happinessByTeam || {})[t] || {};
        const count = Object.values(happiness).filter((v) => v >= FLEXIBLE_THRESHOLD).length;
        if (count < minCount) {
            minCount = count;
            leastFlexible = t;
        }
    }
    return leastFlexible;
}

// Orquestación completa: recibe una cantidad PAR de equipos (el caller resuelve el
// bye antes de llamar) y devuelve la propuesta de emparejamiento con ids reales.
function proposeMatches(teams, happinessByTeam) {
    if (teams.length % 2 !== 0) {
        throw new Error("proposeMatches requiere una cantidad par de equipos.");
    }
    if (teams.length === 0) {
        return { threshold: null, totalScore: 0, matches: [], infeasible: false };
    }

    const edges = buildEdges(teams, happinessByTeam);
    const threshold = findTightestThreshold(teams.length, edges);
    if (threshold === null) {
        return { threshold: null, totalScore: null, matches: null, infeasible: true };
    }

    const result = maxWeightMatching(teams.length, edges, threshold);
    const matches = result.pairs.map(([i, j]) => {
        const edge = edgeBetween(edges, i, j);
        const teamA = teams[i];
        const teamB = teams[j];
        return {
            teamA,
            teamB,
            block: edge.block,
            gap: edge.gap,
            happinessA: (happinessByTeam[teamA] || {})[edge.block],
            happinessB: (happinessByTeam[teamB] || {})[edge.block],
        };
    });

    return { threshold, totalScore: result.totalScore, matches, infeasible: false };
}

module.exports = {
    START_HOUR,
    END_HOUR,
    DAYS_PER_WEEK,
    WEEKS_WINDOW,
    DEFAULT_HAPPINESS_LEVEL,
    formatDate,
    startOfWeek,
    blockCode,
    parseBlockCode,
    windowBlockCodes,
    normalizeTeamHappiness,
    filterToBlocks,
    computeValidBlocks,
    fillDefaultHappiness,
    computePairEdge,
    buildEdges,
    findTightestThreshold,
    maxWeightMatching,
    suggestByeTeam,
    proposeMatches,
};
