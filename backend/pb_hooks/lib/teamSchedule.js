// Lógica pura del sistema de "Horarios": la ventana de fechas marcable, normalización
// anti-trampa, y el emparejamiento de equipos que minimiza la diferencia de felicidad
// y, dentro de eso, maximiza la felicidad total. Sin $app — testeado en
// __tests__/teamSchedule.test.js.

const START_HOUR = 8;
const END_HOUR = 20; // último bloque: 20:00-21:00
const DAYS_PER_WEEK = 7; // largo real de una semana calendario, para el offset entre semanas
const WEEKDAYS_PER_WEEK = 5; // lunes a viernes — sábado/domingo quedan fuera de horarios
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
// tiene que abrir nada de antemano. Solo lunes a viernes — sábado y domingo no forman
// parte de ningún horario marcable ni agendable.
function windowBlockCodes(referenceDate, weeks) {
    const ref = referenceDate || new Date();
    const totalWeeks = weeks || WEEKS_WINDOW;
    const start = startOfWeek(ref);
    const codes = [];
    for (let w = 0; w < totalWeeks; w++) {
        for (let d = 0; d < WEEKDAYS_PER_WEEK; d++) {
            const day = new Date(start);
            day.setDate(day.getDate() + w * DAYS_PER_WEEK + d);
            const dateStr = formatDate(day);
            for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
                codes.push(blockCode(dateStr, hour));
            }
        }
    }
    return codes;
}

// Rango [desde, hasta] de códigos de bloque que cubre la ventana móvil.
//
// Un blockCode es "YYYY-MM-DD-HH", así que el orden lexicográfico coincide con el
// cronológico: eso permite acotar las consultas a la ventana con un simple
// `blockCode >= {:from} && blockCode <= {:to}` en vez de traer la tabla entera.
//
// Importa porque los partidos ya jugados se acumulan para siempre: sin este rango,
// cada propuesta y cada aceptación de partido recorría TODO el historial de la liga
// solo para saber qué bloques de esta semana estaban ocupados, y el costo crecía sin
// techo con cada fecha disputada. Ver auditoria-2026-08-19.md §4.3.
function windowBlockRange(referenceDate, weeks) {
    const codes = windowBlockCodes(referenceDate, weeks);
    return { from: codes[0], to: codes[codes.length - 1] };
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

// Clave estable para un par de equipos, sin importar el orden en que se pasen — usada
// tanto para excluir rivales que ya se enfrentaron como para que el caller (league.pb.js)
// arme el set de pares excluidos con el mismo criterio.
function pairKey(teamIdA, teamIdB) {
    return teamIdA < teamIdB ? `${teamIdA}|${teamIdB}` : `${teamIdB}|${teamIdA}`;
}

// score de felicidad normalizada ∈ [0,2] (computePairEdge: a+b con a,b∈[0,1]). Con este
// peso, un gain típico de difficultyBalanceGain (unas pocas unidades) pesa parecido a
// la diferencia entre un horario bueno y uno regular, sin poder tapar por sí solo una
// diferencia grande de felicidad — la justicia de horario sigue siendo la prioridad.
const DIFFICULTY_WEIGHT = 0.25;
// Math.random()-0.5 ∈ [-0.5,0.5]; con este factor el aporte de temperatura queda en
// ±0.15 — variedad perceptible entre corridas sucesivas de "Sugerir partidos" sin
// dominar sobre felicidad ni dificultad.
const DEFAULT_TEMPERATURE = 0.3;

// Cuánto por ENCIMA (+) o por DEBAJO (-) del promedio esperado quedó la dificultad
// acumulada de los rivales que le tocaron a un equipo hasta ahora. `faced` es
// {totalFaced, matchesCount} — sin partidos previos, 0 (ni a favor ni en contra).
function imbalance(faced, targetAvg) {
    if (!faced || !faced.matchesCount) return 0;
    return faced.totalFaced - faced.matchesCount * targetAvg;
}

// Cuánto MEJORA (+) o EMPEORA (-) el balance de dificultad si A y B se enfrentan.
// Un equipo con imbalance negativo (rivales más fáciles que el promedio hasta ahora)
// se beneficia de un rival con dificultad alta, y viceversa — el gain es positivo
// cuando el emparejamiento acerca a AMBOS a su promedio esperado, negativo cuando los
// aleja. Sin nota de dificultad para alguno de los dos (null/undefined), no hay
// ninguna señal que usar: 0, neutro.
function difficultyBalanceGain(difficultyA, facedA, difficultyB, facedB, targetAvg) {
    if (difficultyA == null || difficultyB == null) return 0;
    const imbA = imbalance(facedA, targetAvg);
    const imbB = imbalance(facedB, targetAvg);
    const newImbA = imbA + (difficultyB - targetAvg);
    const newImbB = imbB + (difficultyA - targetAvg);
    return (Math.abs(imbA) - Math.abs(newImbA)) + (Math.abs(imbB) - Math.abs(newImbB));
}

// edges[i][j] (i<j) = computePairEdge(equipo i, equipo j) | null, para cada índice
// en el arreglo `teams`. `excludedPairs` (Set de pairKey) fuerza esos pares a null —
// mismo tratamiento que un par sin ningún bloque en común (infactible para el matching).
//
// `difficultyContext` es OPCIONAL y retrocompatible: sin él, el comportamiento es
// idéntico al de siempre (nada de dificultad ni de temperatura). Con él —
// { difficultyByTeam, facedByTeam, targetAvg, temperature } — enriquece SOLO el
// `score` de cada edge (la fase de optimización), nunca el `gap` (la fase de
// justicia de horario): nadie debe quedar con un horario injustamente malo solo por
// mejorar el balance de dificultad.
function buildEdges(teams, happinessByTeam, excludedPairs, difficultyContext) {
    const normalized = teams.map((t) => normalizeTeamHappiness((happinessByTeam || {})[t] || {}));
    const n = teams.length;
    const edges = {};
    for (let i = 0; i < n; i++) {
        edges[i] = {};
        for (let j = i + 1; j < n; j++) {
            if (excludedPairs && excludedPairs.has(pairKey(teams[i], teams[j]))) {
                edges[i][j] = null;
                continue;
            }
            const edge = computePairEdge(normalized[i], normalized[j]);
            if (edge && difficultyContext) {
                const dc = difficultyContext;
                const dByTeam = dc.difficultyByTeam || {};
                const fByTeam = dc.facedByTeam || {};
                const gain = difficultyBalanceGain(
                    dByTeam[teams[i]],
                    fByTeam[teams[i]],
                    dByTeam[teams[j]],
                    fByTeam[teams[j]],
                    dc.targetAvg || 0
                );
                edge.score += DIFFICULTY_WEIGHT * gain + (dc.temperature || 0) * (Math.random() - 0.5);
            }
            edges[i][j] = edge;
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
const FLEXIBLE_THRESHOLD = 4; // Buena=4, Excelente=5

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

// buildEdges elige el mejor bloque de cada PAR de forma independiente — dos pares
// distintos del mismo batch pueden terminar apuntando al mismo "mejor" bloque si
// ambos lo calificaron alto (ej. todos prefieren el mismo horario popular). Esta
// pasada evita que dos partidos del mismo batch queden agendados a la misma hora:
// procesa los pares de menor a mayor gap (los más ajustados tienen prioridad sobre
// su mejor bloque) y, si el bloque ya está tomado, busca el siguiente mejor bloque en
// común que siga libre. Si un par no tiene NINGÚN bloque en común alternativo, el
// choque queda como último recurso — límite conocido, documentado en vez de reventar.
function resolveBlockCollisions(pairEdges, normalized) {
    const used = new Set();
    const order = [...pairEdges].sort((a, b) => a.edge.gap - b.edge.gap);

    for (const p of order) {
        if (!used.has(p.edge.block)) {
            used.add(p.edge.block);
            continue;
        }

        const normA = normalized[p.i];
        const normB = normalized[p.j];
        const alternatives = Object.keys(normA).filter((b) => b in normB && !used.has(b));
        if (alternatives.length === 0) {
            used.add(p.edge.block);
            continue;
        }

        let best = null;
        for (const block of alternatives) {
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
        p.edge = best;
        used.add(best.block);
    }
}

// Orquestación completa: recibe una cantidad PAR de equipos (el caller resuelve el
// bye antes de llamar) y devuelve la propuesta de emparejamiento con ids reales.
// `excludedPairs` (Set de pairKey, opcional) evita que el batch proponga un partido
// entre dos equipos que ya se enfrentaron (según el criterio que decida el caller).
function proposeMatches(teams, happinessByTeam, excludedPairs, difficultyContext) {
    if (teams.length % 2 !== 0) {
        throw new Error("proposeMatches requiere una cantidad par de equipos.");
    }
    if (teams.length === 0) {
        return { threshold: null, totalScore: 0, matches: [], infeasible: false };
    }

    const edges = buildEdges(teams, happinessByTeam, excludedPairs, difficultyContext);
    const threshold = findTightestThreshold(teams.length, edges);
    if (threshold === null) {
        return { threshold: null, totalScore: null, matches: null, infeasible: true };
    }

    const result = maxWeightMatching(teams.length, edges, threshold);

    const normalized = teams.map((t) => normalizeTeamHappiness((happinessByTeam || {})[t] || {}));
    const pairEdges = result.pairs.map(([i, j]) => ({ i, j, edge: edgeBetween(edges, i, j) }));
    resolveBlockCollisions(pairEdges, normalized);

    const totalScore = pairEdges.reduce((sum, p) => sum + p.edge.score, 0);
    const matches = pairEdges.map(({ i, j, edge }) => {
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

    return { threshold, totalScore, matches, infeasible: false };
}

module.exports = {
    START_HOUR,
    END_HOUR,
    DAYS_PER_WEEK,
    WEEKDAYS_PER_WEEK,
    WEEKS_WINDOW,
    DEFAULT_HAPPINESS_LEVEL,
    formatDate,
    startOfWeek,
    blockCode,
    parseBlockCode,
    windowBlockCodes,
    windowBlockRange,
    normalizeTeamHappiness,
    filterToBlocks,
    computeValidBlocks,
    fillDefaultHappiness,
    computePairEdge,
    pairKey,
    DIFFICULTY_WEIGHT,
    DEFAULT_TEMPERATURE,
    difficultyBalanceGain,
    buildEdges,
    findTightestThreshold,
    maxWeightMatching,
    suggestByeTeam,
    proposeMatches,
};
