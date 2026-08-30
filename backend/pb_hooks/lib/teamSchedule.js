// Lógica pura del sistema de "Horarios": la ventana de fechas marcable, normalización
// anti-trampa, y el emparejamiento de equipos que minimiza la diferencia de felicidad
// y, dentro de eso, maximiza la felicidad total. Sin $app — testeado en
// __tests__/teamSchedule.test.js.

const START_HOUR = 8;
const END_HOUR = 20; // último bloque: 20:00-21:00
const DAYS_PER_WEEK = 7; // largo real de una semana calendario, para el offset entre semanas
const WEEKDAYS_PER_WEEK = 5; // lunes a viernes — sábado/domingo quedan fuera de horarios
const WEEKS_WINDOW = 3; // semana actual + 2 más
// Nota con la que se lee un bloque que un equipo no calificó. Es el MISMO valor con el
// que la grilla del frontend (AvailabilityGrid/TeamScheduleScreen, defaultLevel =
// MIN_LEVEL) llega precargada: si acá fuera más alto, un bloque que el equipo nunca vio
// —porque la ventana móvil corrió, o porque estaba ocupado cuando marcó y después se
// liberó— quedaría por ENCIMA de todos los que sí marcó "Muy mala", y la normalización
// lo convertiría en su bloque favorito sin que nadie lo haya pedido nunca. Los dos
// valores tienen que moverse juntos.
const DEFAULT_HAPPINESS_LEVEL = 1; // "Muy mala", igual que MIN_LEVEL en el frontend

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

// Bloques de `windowBlocks` que ya empezaron (o ya pasaron) respecto a `now` — nunca
// deberían ofrecerse como candidatos para un partido NUEVO, aunque sigan técnicamente
// "libres" (nadie los ocupó). `startOfWeek` redondea al lunes de la semana ACTUAL, así
// que si `now` cae un fin de semana (o cualquier día después del lunes), la ventana
// móvil igual incluye los días de esa semana que ya pasaron — sin este filtro, una
// sugerencia podía terminar apuntando a un bloque de, por ejemplo, el lunes recién
// pasado. Aparte de windowBlockCodes a propósito: esa función también arma la grilla
// donde los equipos marcan disponibilidad, y ahí no correspondería hacer desaparecer
// bloques pasados bajo los pies de nadie — el filtro de "ya pasó" es una decisión de
// AGENDAMIENTO, no de la ventana marcable en sí (se aplica en el caller, junto a los
// bloques bloqueados/ocupados, vía computeValidBlocks).
function pastBlockCodes(windowBlocks, now) {
    const ref = now || new Date();
    const nowCode = blockCode(formatDate(ref), ref.getHours());
    return windowBlocks.filter((b) => b <= nowCode);
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
// DEFAULT_HAPPINESS_LEVEL en cada bloque hasta que lo cambie explícitamente. Esto
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

// { worst, gap, score } de un bloque para un par ya normalizado.
//
// `worst` es la felicidad del que queda PEOR de los dos: es el eje de justicia. `gap` ya
// no decide nada; se sigue calculando porque se guarda en league_matches.gap y el panel
// lo muestra como "Diferencia".
function blockMetrics(normA, normB, block) {
    const a = normA[block];
    const b = normB[block];
    return { worst: Math.min(a, b), gap: Math.abs(a - b), score: a + b };
}

// Cuánta felicidad del equipo peor parado se está dispuesto a resignar a cambio de que
// el horario sea claramente mejor para los DOS. En la escala normalizada [0,1], 0.25 es
// una nota entera de la escala 1-5 para un equipo que la usó completa (de "Buena" a
// "Regular", por ejemplo) — y es también el mínimo que sirve de algo: con notas enteras
// las diferencias entre bloques son múltiplos de esa nota, así que una tolerancia más
// chica casi nunca admitiría ninguna opción que la regla estricta no eligiera ya.
const FAIRNESS_TOLERANCE = 0.25;

// Mejor bloque entre dos equipos ya normalizados, restringido a `blocks`.
//
// La regla tiene dos escalones y el orden importa:
//
//   1. JUSTICIA CON BANDA. Se calcula el mejor "peor parado" alcanzable y se descartan
//      los bloques que queden más de FAIRNESS_TOLERANCE por debajo. Esto es lo que
//      impide el resultado que nadie quiere —dejar a un equipo con un horario pésimo
//      para que el otro tenga uno excelente— sin convertir la justicia en un absoluto.
//   2. FELICIDAD. Dentro de la banda gana la suma más alta, es decir el horario que
//      mejor les viene a los dos. Los empates de suma se rompen por mejor peor parado.
//
// El criterio de justicia era antes "minimizar la DIFERENCIA entre los dos", y esa
// versión leía un bloque que ambos calificaron "Muy mala" como justicia PERFECTA
// (diferencia 0) y lo prefería sobre cualquier horario bueno para los dos, que casi
// siempre tiene alguna diferencia. Caso real que lo destapó: LOS LABUBU vs Vo Sai Po,
// con 142 bloques "Muy mala/Muy mala" y un único 2026-09-02-14 donde los dos habían
// marcado "Buena" — se agendaba en uno de los 142. Le pasaba a 60 de los 630 pares
// posibles de la Copa CDI Masculina.
//
// Mirar al peor parado en vez de a la diferencia dice lo mismo donde el criterio viejo
// tenía razón (5/1 deja al peor en 0 y pierde contra un 3/3) sin premiar la miseria
// compartida. Y la banda evita el defecto que tendría el peor-parado a secas, que es
// exactamente el mismo de antes en otro eje: sin ella, 0.01 más de justicia justificaba
// resignar cualquier cantidad de felicidad total.
//
// Como efecto colateral desaparece el caso especial que había para los equipos sin
// preferencia real: normalizeTeamHappiness ya los deja planos en 0.5, y un valor
// constante ordena los bloques igual sea cual sea, así que el equipo indiferente
// simplemente no interviene y gana el mejor bloque del otro.
//
// `tieBreak` (opcional, una función que devuelve [0,1)) decide los empates EXACTOS
// eligiendo uniformemente entre todos los empatados en vez de quedarse siempre con el
// primero. Importa porque el primero es siempre el más temprano del arreglo: sin esto,
// todo par sin preferencias marcadas terminaba invariablemente el lunes a las 08:00, y
// dos corridas seguidas de "Sugerir partidos" daban el mismo horario aunque hubiera
// decenas de bloques igual de buenos. Sin `tieBreak` la elección es determinista (el más
// temprano), que es lo que corresponde en los tests.
function chooseBestBlock(normA, normB, blocks, tieBreak) {
    if (blocks.length === 0) return null;

    let bestWorst = -Infinity;
    for (const block of blocks) {
        const w = Math.min(normA[block], normB[block]);
        if (w > bestWorst) bestWorst = w;
    }
    const limit = bestWorst - FAIRNESS_TOLERANCE;

    let best = null;
    let tied = 0;
    for (const block of blocks) {
        const m = blockMetrics(normA, normB, block);
        if (m.worst < limit - EPS) continue;
        const candidate = { block: block, worst: m.worst, gap: m.gap, score: m.score };
        if (
            best === null ||
            m.score > best.score + EPS ||
            (Math.abs(m.score - best.score) <= EPS && m.worst > best.worst + EPS)
        ) {
            best = candidate;
            tied = 1;
        } else if (
            tieBreak &&
            Math.abs(m.score - best.score) <= EPS &&
            Math.abs(m.worst - best.worst) <= EPS
        ) {
            tied++;
            if (tieBreak() * tied < 1) best = candidate;
        }
    }
    return best;
}

// Mejor bloque en común entre dos equipos ya normalizados. null si no comparten ningún
// bloque candidato (par infactible).
//
// `candidateBlocks` (opcional) restringe DÓNDE se puede agendar sin tocar la escala con
// la que se normalizó cada equipo. Son dos cosas distintas a propósito: la escala de un
// equipo es su opinión sobre toda la ventana marcable, mientras que los candidatos son
// los bloques que hoy se pueden usar (ni bloqueados, ni ocupados, ni pasados, y dentro
// de los horarios que la liga eligió para esta tanda). Normalizar sobre el conjunto ya
// recortado inflaba diferencias triviales: con 3 horarios permitidos, un equipo cuya
// única variación entre ellos era "Muy mala" vs "Mala" quedaba con un 1.0 que competía
// de igual a igual contra el "Excelente" real del rival.
function computePairEdge(normA, normB, candidateBlocks, tieBreak) {
    const commonBlocks = candidateBlocks
        ? candidateBlocks.filter((b) => b in normA && b in normB)
        : Object.keys(normA).filter((b) => b in normB);
    return chooseBestBlock(normA, normB, commonBlocks, tieBreak);
}

// Clave estable para un par de equipos, sin importar el orden en que se pasen — usada
// tanto para excluir rivales que ya se enfrentaron como para que el caller (league.pb.js)
// arme el set de pares excluidos con el mismo criterio.
function pairKey(teamIdA, teamIdB) {
    return teamIdA < teamIdB ? `${teamIdA}|${teamIdB}` : `${teamIdB}|${teamIdA}`;
}

// score de felicidad normalizada ∈ [0,2] (computePairEdge: a+b con a,b∈[0,1]). El
// aporte de dificultad se acota a ±DIFFICULTY_WEIGHT sobre esa escala: pesa parecido a
// la diferencia entre un horario bueno y uno regular, sin poder tapar por sí solo una
// diferencia grande de felicidad — la justicia de horario sigue siendo la prioridad.
const DIFFICULTY_WEIGHT = 0.25;
// difficultyBalanceGain devuelve PUNTOS DE DIFICULTAD (la nota del admin es 1-10), una
// escala que no tiene nada que ver con la del score. Sin dividir por el gain máximo
// posible —4,5 por equipo, 9 entre los dos— un solo emparejamiento bien balanceado
// sumaba hasta 2,25 al score, más que el rango COMPLETO de la felicidad: la dificultad
// dejaba de ser un desempate y pasaba a decidir sola.
const MAX_DIFFICULTY_GAIN = 9;
// Math.random()-0.5 ∈ [-0.5,0.5]; con este factor el aporte de temperatura queda en
// ±0.15 — variedad perceptible entre corridas sucesivas de "Sugerir partidos" sin
// dominar sobre felicidad ni dificultad. Además, cualquier temperatura > 0 activa el
// desempate aleatorio ENTRE BLOQUES (ver chooseBestBlock): la temperatura sola es un
// número por PAR, igual para todos sus bloques, así que variaba a quién le tocaba con
// quién pero jamás el horario elegido.
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
//
// `candidateBlocks` (opcional) — dónde se puede agendar, sin afectar la escala con la
// que se normalizó cada equipo (ver computePairEdge).
function buildEdges(teams, happinessByTeam, excludedPairs, difficultyContext, candidateBlocks) {
    const normalized = teams.map((t) => normalizeTeamHappiness((happinessByTeam || {})[t] || {}));
    const tieBreak = difficultyContext && difficultyContext.temperature ? Math.random : null;
    const n = teams.length;
    const edges = {};
    for (let i = 0; i < n; i++) {
        edges[i] = {};
        for (let j = i + 1; j < n; j++) {
            if (excludedPairs && excludedPairs.has(pairKey(teams[i], teams[j]))) {
                edges[i][j] = null;
                continue;
            }
            const edge = computePairEdge(normalized[i], normalized[j], candidateBlocks, tieBreak);
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
                const normalizedGain = Math.max(-1, Math.min(1, gain / MAX_DIFFICULTY_GAIN));
                // El ajuste se guarda aparte porque si el par tiene que ceder su bloque
                // (resolveBlockCollisions) el edge se recalcula desde cero, y sin esto
                // el partido reasignado quedaba en otra escala que el resto del batch.
                edge.bonus = DIFFICULTY_WEIGHT * normalizedGain + (dc.temperature || 0) * (Math.random() - 0.5);
                edge.score += edge.bonus;
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
// cuyo equipo peor parado llegue al menos a `floor`? DP con bitmask sobre subconjuntos
// de equipos — cómodo hasta ~16-18 equipos (2^n estados).
function perfectMatchingExists(n, edges, floor) {
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
            if (edge && edge.worst >= floor - EPS) {
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

// Piso de justicia más alto posible: la mayor felicidad garantizada para el equipo peor
// parado de TODA la tanda tal que todavía exista un emparejamiento perfecto. null si no
// hay ninguno (ej. algún equipo quedaría sin ningún par posible).
//
// Es el mismo maximin de chooseBestBlock pero a nivel de tanda: primero se protege al
// que peor queda, y recién después maxWeightMatching optimiza el total. Se recorren los
// valores de mayor a menor porque la propiedad es monótona — si existe emparejamiento
// con piso F, existe con cualquier piso más bajo — así que el primero que da es el máximo.
function findBestFloor(n, edges) {
    const worsts = new Set();
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (edges[i][j]) worsts.add(edges[i][j].worst);
        }
    }
    const sorted = Array.from(worsts).sort((a, b) => b - a);
    for (const f of sorted) {
        if (perfectMatchingExists(n, edges, f)) return f;
    }
    return null;
}

// Entre los emparejamientos perfectos que respetan el piso, el que maximiza la
// felicidad total (suma de scores). Devuelve { totalScore, pairs } con pairs como
// pares de ÍNDICES (no ids), o null si no hay ningún emparejamiento válido sobre el piso.
function maxWeightMatching(n, edges, floor) {
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
            if (edge && edge.worst >= floor - EPS) {
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
            if (!edge || edge.worst < floor - EPS) continue;
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

// Con cantidad impar de equipos hay que dejar a uno libre. El candidato natural es el
// más difícil de emparejar con una felicidad alta para ambos lados: el que tiene menos
// bloques bien calificados (Buena o Excelente) entre los candidatos de esta tanda.
//
// Con dos salvedades que la versión anterior no tenía:
//
// 1. Un equipo SIN preferencia real (todo igual, típicamente porque nunca abrió la
//    pantalla) es el MÁS fácil de emparejar, no el más difícil — le sirve cualquier
//    horario. Contando bloques >= 4 quedaba siempre en 0 y salía sugerido para el bye
//    todas las fechas, que es exactamente al revés. Va al final de la lista.
// 2. A igualdad de flexibilidad, se banca a quien MÁS partidos lleva jugados. Sin este
//    desempate el orden lo decidía el arreglo de entrada, siempre igual, y el mismo
//    equipo se quedaba sin jugar fecha tras fecha.
const FLEXIBLE_THRESHOLD = 4; // Buena=4, Excelente=5

// Todos los equipos ordenados de "mejor candidato a quedar libre" a peor. El caller la
// usa para caer al siguiente si el bye elegido deja un conjunto infactible.
function rankByeCandidates(teams, happinessByTeam, candidateBlocks, matchesCountByTeam) {
    return teams
        .map((t) => {
            const happiness = (happinessByTeam || {})[t] || {};
            const keys = candidateBlocks ? candidateBlocks.filter((b) => b in happiness) : Object.keys(happiness);
            const values = keys.map((b) => happiness[b]);
            return {
                team: t,
                indifferent: values.length === 0 || values.every((v) => v === values[0]),
                flexible: values.filter((v) => v >= FLEXIBLE_THRESHOLD).length,
                played: (matchesCountByTeam || {})[t] || 0,
            };
        })
        .sort((a, b) => {
            if (a.indifferent !== b.indifferent) return a.indifferent ? 1 : -1;
            if (a.flexible !== b.flexible) return a.flexible - b.flexible;
            return b.played - a.played;
        })
        .map((x) => x.team);
}

function suggestByeTeam(teams, happinessByTeam, candidateBlocks, matchesCountByTeam) {
    const ranked = rankByeCandidates(teams, happinessByTeam, candidateBlocks, matchesCountByTeam);
    return ranked.length ? ranked[0] : null;
}

// buildEdges elige el mejor bloque de cada PAR de forma independiente — dos pares
// distintos del mismo batch pueden terminar apuntando al mismo "mejor" bloque si ambos
// lo calificaron alto (ej. todos prefieren el mismo horario popular). Esta pasada evita
// que dos partidos del mismo batch queden agendados a la misma hora.
//
// Dos cosas que esta pasada tiene que respetar y antes no respetaba:
//
// 1. EL PISO DE JUSTICIA. findBestFloor busca la mayor felicidad garantizada al equipo
//    peor parado con la que todavía existe un emparejamiento perfecto, y todo el
//    emparejamiento se elige bajo esa restricción — pero después esta pasada reasignaba
//    bloques sin volver a mirarla. Se llegaba a anunciar un peor caso y agendar un
//    partido mucho peor que ése. Ahora las alternativas se filtran por el piso; solo si
//    NINGUNA lo respeta se cede (antes que dejar dos partidos a la misma hora, que es
//    físicamente imposible: hay una sola cancha) y el partido queda marcado con
//    `belowFloor` para que el panel lo diga.
//
// 2. QUIÉN TIENE PRIORIDAD. Ordenar por gap ascendente parecía razonable, pero el gap
//    valía 0 tanto para un acuerdo real como para dos equipos a los que les da lo mismo
//    todo: los pares indiferentes ordenaban PRIMERO y se quedaban con el bloque
//    disputado. Ahora se ordena por arrepentimiento — cuánto score pierde el par si
//    tiene que ceder su mejor bloque — así que cede quien menos pierde, y un par
//    indiferente (arrepentimiento 0) cede siempre.
function resolveBlockCollisions(pairEdges, normalized, candidateBlocks, floor, tieBreak) {
    const prepared = pairEdges.map((p) => {
        const normA = normalized[p.i];
        const normB = normalized[p.j];
        const blocks = candidateBlocks.filter((b) => b in normA && b in normB);
        const fair = blocks.filter((b) => blockMetrics(normA, normB, b).worst >= floor - EPS);
        const alternative = chooseBestBlock(normA, normB, fair.filter((b) => b !== p.edge.block), null);
        // Sin restar el bonus, el arrepentimiento se comparaba contra un score que lo
        // incluye y otro que no: un par con mucho ajuste de dificultad se ganaba una
        // prioridad que no le corresponde. El bonus es del PAR, igual en todos sus
        // bloques, así que en una diferencia entre bloques tiene que cancelarse.
        const baseScore = p.edge.score - (p.edge.bonus || 0);
        return {
            p,
            normA,
            normB,
            blocks,
            fair,
            regret: alternative ? baseScore - alternative.score : Infinity,
        };
    });
    prepared.sort((a, b) => b.regret - a.regret);

    const used = new Set();
    for (const it of prepared) {
        if (!used.has(it.p.edge.block)) {
            used.add(it.p.edge.block);
            continue;
        }

        const bonus = it.p.edge.bonus || 0;
        let next = chooseBestBlock(it.normA, it.normB, it.fair.filter((b) => !used.has(b)), tieBreak);
        if (!next) {
            next = chooseBestBlock(it.normA, it.normB, it.blocks.filter((b) => !used.has(b)), tieBreak);
            if (next) next.belowFloor = true;
        }
        if (!next) {
            // Ni un solo bloque libre en común: el choque queda como último recurso,
            // marcado para que el panel no lo agende a ciegas.
            it.p.edge.collision = true;
            used.add(it.p.edge.block);
            continue;
        }
        next.bonus = bonus;
        next.score += bonus;
        it.p.edge = next;
        used.add(next.block);
    }
}

// El emparejamiento óptimo es un DP con máscara de bits: 2^n estados y un `1 << n` que
// deja de funcionar en 31. Ninguna tanda real se acerca ni de lejos, pero sin tope el
// panel podía mandar cualquier cantidad y colgar el proceso (o peor, calcular mal en
// silencio) en un servidor de 2 GB.
const MAX_TEAMS = 24;

// El conjunto de bloques donde se puede agendar. Sin `candidateBlocks` explícito, son
// todos los que aparezcan en la disponibilidad de algún equipo (comportamiento de
// siempre; cada par se queda igual con los que tenga en común).
function resolveCandidateBlocks(teams, happinessByTeam, candidateBlocks) {
    if (candidateBlocks) return candidateBlocks;
    const all = [];
    const seen = new Set();
    for (const t of teams) {
        for (const b of Object.keys((happinessByTeam || {})[t] || {})) {
            if (!seen.has(b)) {
                seen.add(b);
                all.push(b);
            }
        }
    }
    return all;
}

// ¿Existe algún emparejamiento perfecto para este conjunto de equipos? Es la mitad
// barata de proposeMatches (solo la fase de justicia), para que el caller pueda probar
// candidatos a bye sin calcular la propuesta completa de cada uno.
function isPairingFeasible(teams, happinessByTeam, excludedPairs, candidateBlocks) {
    if (teams.length === 0) return true;
    if (teams.length % 2 !== 0) return false;
    const blocks = resolveCandidateBlocks(teams, happinessByTeam, candidateBlocks);
    const edges = buildEdges(teams, happinessByTeam, excludedPairs, null, blocks);
    return findBestFloor(teams.length, edges) !== null;
}

// Orquestación completa: recibe una cantidad PAR de equipos (el caller resuelve el
// bye antes de llamar) y devuelve la propuesta de emparejamiento con ids reales.
// `excludedPairs` (Set de pairKey, opcional) evita que el batch proponga un partido
// entre dos equipos que ya se enfrentaron (según el criterio que decida el caller).
//
// Devuelve `floor` (el mejor "peor parado" alcanzable para la tanda) y `worst` (el que
// quedó DE VERDAD, que es el número honesto: la banda de tolerancia y los choques de
// bloque pueden dejarlo por debajo). `maxGap` es la mayor diferencia entre los dos
// equipos de un mismo partido; ya no es un criterio, se informa porque el panel la
// muestra y se guarda en league_matches.gap.
//
// La banda de FAIRNESS_TOLERANCE se aplica en los DOS lugares donde hay una elección —
// qué horario le toca a un par (chooseBestBlock) y qué pares forman la tanda (acá) —
// porque en los dos la regla estricta resignaba mucha felicidad total por diferencias
// mínimas de justicia. Ejemplo del segundo caso: un emparejamiento donde el peor parado
// queda en 0.49 pero todos los demás juegan felices perdía contra uno donde el peor
// queda en 0.50 y el resto juega mal.
function proposeMatches(teams, happinessByTeam, excludedPairs, difficultyContext, candidateBlocks) {
    if (teams.length % 2 !== 0) {
        throw new Error("proposeMatches requiere una cantidad par de equipos.");
    }
    if (teams.length === 0) {
        return { floor: null, worst: null, maxGap: null, totalScore: 0, matches: [], infeasible: false };
    }
    // Un id repetido no es un caso raro sino un dato corrupto con consecuencias: el par
    // (X,X) tiene gap 0 y el score máximo posible, así que el optimizador lo PREFIERE y
    // la propuesta termina con "X vs X".
    if (new Set(teams).size !== teams.length) {
        throw new Error("proposeMatches recibió el mismo equipo más de una vez.");
    }
    if (teams.length > MAX_TEAMS) {
        throw new Error(`El emparejamiento óptimo admite hasta ${MAX_TEAMS} equipos por tanda; elige menos.`);
    }

    const blocks = resolveCandidateBlocks(teams, happinessByTeam, candidateBlocks);
    const edges = buildEdges(teams, happinessByTeam, excludedPairs, difficultyContext, blocks);
    const floor = findBestFloor(teams.length, edges);
    if (floor === null) {
        return { floor: null, worst: null, maxGap: null, totalScore: null, matches: null, infeasible: true };
    }
    const tolerantFloor = floor - FAIRNESS_TOLERANCE;

    const result = maxWeightMatching(teams.length, edges, tolerantFloor);

    const normalized = teams.map((t) => normalizeTeamHappiness((happinessByTeam || {})[t] || {}));
    const pairEdges = result.pairs.map(([i, j]) => ({ i, j, edge: edgeBetween(edges, i, j) }));
    const tieBreak = difficultyContext && difficultyContext.temperature ? Math.random : null;
    resolveBlockCollisions(pairEdges, normalized, blocks, tolerantFloor, tieBreak);

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
            worst: edge.worst,
            belowFloor: !!edge.belowFloor,
            collision: !!edge.collision,
        };
    });
    const maxGap = matches.reduce((peor, m) => Math.max(peor, m.gap), 0);
    const worst = matches.reduce((peor, m) => Math.min(peor, m.worst), Infinity);

    return { floor, worst, maxGap, totalScore, matches, infeasible: false };
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
    pastBlockCodes,
    normalizeTeamHappiness,
    filterToBlocks,
    computeValidBlocks,
    fillDefaultHappiness,
    computePairEdge,
    FAIRNESS_TOLERANCE,
    pairKey,
    DIFFICULTY_WEIGHT,
    DEFAULT_TEMPERATURE,
    difficultyBalanceGain,
    buildEdges,
    findBestFloor,
    maxWeightMatching,
    suggestByeTeam,
    rankByeCandidates,
    isPairingFeasible,
    proposeMatches,
    MAX_TEAMS,
};
