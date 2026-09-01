// Lógica pura del sistema de "Horarios": la ventana de fechas marcable y el
// emparejamiento de equipos, que maximiza la felicidad total de la tanda medida en la
// escala real de notas (1-5) y, dentro de eso, minimiza a cuántos equipos les toca un
// horario malo — repartiendo esos sacrificios entre los que menos disponibilidad
// ofrecieron. Sin $app — testeado en __tests__/teamSchedule.test.js.

const START_HOUR = 8;
const END_HOUR = 20; // último bloque: 20:00-21:00
const DAYS_PER_WEEK = 7; // largo real de una semana calendario, para el offset entre semanas
const WEEKDAYS_PER_WEEK = 5; // lunes a viernes — sábado/domingo quedan fuera de horarios
const WEEKS_WINDOW = 3; // semana actual + 2 más
// Nota con la que se lee un bloque que un equipo no calificó. Es el MISMO valor con el
// que la grilla del frontend (AvailabilityGrid/TeamScheduleScreen, defaultLevel =
// MIN_LEVEL) llega precargada: si acá fuera más alto, un bloque que el equipo nunca vio
// —porque la ventana móvil corrió, o porque estaba ocupado cuando marcó y después se
// liberó— competiría por encima de los que sí marcó "Muy mala", y podría terminar
// agendándose un partido en una hora que nadie pidió nunca. Los dos valores tienen que
// moverse juntos.
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

// ---------------------------------------------------------------------------------
// La escala de felicidad, compartida por todos los equipos
//
// Antes cada equipo se reescalaba contra SU PROPIA distribución (min→0, max→1) antes de
// compararlo con los demás. Esa normalización tenía una consecuencia que en los datos
// reales resultó fatal: para un equipo que marcó 43 bloques "Muy mala" y 3 "Excelente",
// un "Muy mala" valía lo mismo (0) que el "Muy mala" de cualquier otro, pero para un
// equipo cuyo mejor bloque de la tanda era apenas un "Regular", ese "Regular" valía 1.0
// — un diez perfecto. El optimizador maximizaba esa escala inventada y anunciaba tandas
// excelentes en las que la mitad de los equipos jugaba en horarios que ellos mismos
// habían calificado "Mala". Medido sobre la disponibilidad real de la Copa CDI Masculina
// (24 equipos, cancha acotada al mediodía): la nota promedio de la tanda sube de 3.86 a
// 4.45 y los equipos que quedan con horario malo bajan de 4.5 a 1.5.
//
// Ahora la nota vale lo que dice la etiqueta que vio el equipo al marcarla, y vale lo
// mismo para todos: 1 "Muy mala", 2 "Mala", 3 "Regular", 4 "Buena", 5 "Excelente".
//
// Eso no reabre la puerta a hacer trampa inflando o desinflando todo, y por una razón
// estructural: en un emparejamiento perfecto CADA equipo juega exactamente un partido,
// así que cualquier corrimiento parejo de sus notas suma una constante al total y no
// puede cambiar ninguna decisión. Un equipo que marca todo "Excelente" queda plano y
// simplemente no opina; uno que marca todo "Muy mala" tampoco. Lo único que pesa es la
// DIFERENCIA entre los bloques de un mismo equipo, que es exactamente lo que se le pidió
// que expresara.
//
// La curva es levemente cóncava a propósito: subir a un equipo de "Mala" a "Regular"
// (+0.28) vale más que subir a otro de "Buena" a "Excelente" (+0.20). Es lo que hace
// que, a igual suma de notas, gane el reparto parejo — (Buena, Buena) le gana a
// (Excelente, Regular) por poco, sin poder nunca dar vuelta una diferencia real.
const HAPPINESS_UTILITY = { 1: 0, 2: 0.28, 3: 0.56, 4: 0.8, 5: 1 };

// Hasta qué nota se considera que al equipo le tocó un horario MALO. Lo definió el
// usuario: "Muy mala" y "Mala" son sacrificio, "Regular" ya es aceptable.
const BAD_LEVEL = 2;

// Cuánto pesa sacar a UN equipo de la zona mala, medido en el rango completo de
// felicidad de otro equipo (la utilidad va de 0 a 1). Con 1.0 el optimizador está
// dispuesto a bajar a un equipo de "Excelente" a "Regular" con tal de subir a otro de
// "Mala" a "Regular", pero jamás sacrifica a alguien nuevo para mejorar a quien ya
// está bien: eso solo movería el problema de lugar. Es el mecanismo que implementa
// "minimizar la cantidad de equipos que quedan con mala disponibilidad".
const SACRIFICE_PENALTY = 1;

// Y un extra para el fondo de la escala, que hace cumplir una regla aparte: si a un
// equipo igual le va a tocar un horario malo, que al menos le toque el MENOS malo, y
// que ninguna mejora de alguien que ya está bien valga quitarle eso.
//
// El número sale de esa regla y no del gusto. El escalón "Muy mala" -> "Mala" vale
// 0.28 + VERY_BAD_EXTRA; el escalón más caro de la zona buena es "Regular" -> "Buena"
// (0.24). Como el karma puede darle al sacrificado el peso mínimo (0.65) y al otro el
// máximo (1.35), para que el sacrificado gane igual hace falta
// 0.28 + extra > 0.24 · 1.35 / 0.65 = 0.499. Con 0.3 se cumple con margen.
const VERY_BAD_EXTRA = 0.3;

// Toda nota que entra al algoritmo pasa por acá: entero entre 1 y 5. El schema ya lo
// valida al guardar, pero un dato viejo o corrupto no puede convertirse en un NaN que
// se propague en silencio por todo el optimizador — se lee como el peor caso.
function clampLevel(level) {
    const n = Math.round(Number(level));
    if (!Number.isFinite(n) || n < 1) return 1;
    return n > 5 ? 5 : n;
}

function happinessUtility(level) {
    return HAPPINESS_UTILITY[clampLevel(level)];
}

function isBadLevel(level) {
    return clampLevel(level) <= BAD_LEVEL;
}

// Lo que aporta al total un equipo al que le toca `level`: la utilidad de la nota menos
// las penalizaciones por caer en la zona mala.
function levelValue(level) {
    const n = clampLevel(level);
    let value = HAPPINESS_UTILITY[n];
    if (n <= BAD_LEVEL) value -= SACRIFICE_PENALTY;
    if (n <= 1) value -= VERY_BAD_EXTRA;
    return value;
}

// ---------------------------------------------------------------------------------
// Karma: cuánto puso de su parte cada equipo EN ESTA TANDA
//
// No es un contador persistente ni tiene nada que ver con el karma del perfil: se
// calcula de cero en cada propuesta, a partir de la disponibilidad que los equipos
// ofrecieron sobre los bloques donde esta tanda se puede agendar. Un equipo que abrió
// la grilla y marcó horarios de verdad "puso de su parte"; uno que dejó todo en "Muy
// mala" (o que nunca abrió la pantalla) no ofreció nada.
//
// El karma entra al problema como un PESO que multiplica la felicidad de ese equipo, y
// con eso hace las dos cosas que se le pidieron de una sola vez:
//
//   - Si hay que sacrificar a alguien, se sacrifica primero al que menos ofreció: su
//     penalización pesa menos.
//   - Si hay varios horarios buenos para repartir, el mejor se lo lleva el que más
//     ofreció: su felicidad pesa más.
//
// Es deliberadamente un peso suave. Con KARMA_SPREAD = 0.35 el equipo más generoso pesa
// 1.35 y el más tacaño 0.65: alcanza para decidir a quién le toca la peor parte y quién
// se queda con el mejor horario, y no alcanza para mover a nadie de un horario aceptable
// a uno malo. Eso último está acotado: bajar a un equipo de "Regular" a "Mala" cuesta,
// en el caso más barato posible, 0.65 · 1.28 = 0.83, y todo lo que el karma puede ganar
// a cambio subiendo a otro dentro de la zona buena es 1.35 · 0.44 = 0.59.
const KARMA_SPREAD = 0.35;

// A partir de qué diferencia de generosidad el karma pesa al máximo. Sin esto, el karma
// se calcula por RANGO y el rango siempre reparte el eje entero: en una tanda donde
// todos ofrecieron casi lo mismo, una hora de diferencia entre el primero y el último
// bastaba para darle a uno 1.35 y al otro 0.65. Con este factor el karma se atenúa
// proporcionalmente cuando no hay una diferencia real que premiar, y llega a pleno solo
// cuando el más generoso y el más tacaño se separan por 0.2 — más o menos lo que aporta
// marcar "Excelente" una quinta parte de los bloques de la tanda.
const KARMA_FULL_SPREAD = 0.2;

// Cuánta disponibilidad ofreció un equipo sobre `blocks`, en [0,1]: el promedio de la
// utilidad de sus notas. Un bloque que el equipo no tiene calificado cuenta 0 — no lo
// ofreció. Se mide sobre los bloques CANDIDATOS y no sobre la ventana entera porque el
// karma es local a la tanda: lo que importa es qué tan generoso fue con las horas que
// esta fecha realmente puede usar, no con las de dentro de tres semanas.
function teamOffer(happiness, blocks) {
    if (!blocks || blocks.length === 0) return 0;
    let sum = 0;
    for (const b of blocks) {
        const level = (happiness || {})[b];
        if (level !== undefined) sum += happinessUtility(level);
    }
    return sum / blocks.length;
}

// Peso de karma de cada equipo, en el mismo orden que `teams`.
//
// Se usa el RANGO (posición en el orden de generosidad) y no el valor crudo, con rango
// promedio para los empates, porque las cifras crudas de una liga real se apelotonan:
// casi todos los equipos ofrecen entre 0.05 y 0.2 y un par ofrece 0.5, así que un peso
// proporcional al valor dejaba a treinta equipos indistinguibles y a uno con todo el
// karma. El rango reparte el eje completo entre los equipos de ESTA tanda, que es lo
// que se quiere comparar. Si todos ofrecieron exactamente lo mismo, todos empatan en el
// rango promedio y el karma queda neutro (peso 1) sin ningún caso especial.
function karmaWeights(teams, happinessByTeam, blocks) {
    const n = teams.length;
    const offers = teams.map((t) => teamOffer((happinessByTeam || {})[t], blocks));
    if (n <= 1) return offers.map(() => 1);

    const order = offers.map((v, i) => i).sort((a, b) => offers[a] - offers[b]);
    const rank = new Array(n);
    let i = 0;
    while (i < n) {
        let j = i;
        while (j + 1 < n && Math.abs(offers[order[j + 1]] - offers[order[i]]) <= EPS) j++;
        const avg = (i + j) / 2;
        for (let k = i; k <= j; k++) rank[order[k]] = avg;
        i = j + 1;
    }
    const spread = offers[order[n - 1]] - offers[order[0]];
    const strength = Math.min(1, spread / KARMA_FULL_SPREAD);
    return rank.map((r) => 1 + KARMA_SPREAD * strength * ((2 * r) / (n - 1) - 1));
}

// Clave estable para un par de equipos, sin importar el orden en que se pasen — usada
// tanto para excluir rivales que ya se enfrentaron como para que el caller (league.pb.js)
// arme el set de pares excluidos con el mismo criterio.
function pairKey(teamIdA, teamIdB) {
    return teamIdA < teamIdB ? `${teamIdA}|${teamIdB}` : `${teamIdB}|${teamIdA}`;
}

// El aporte de dificultad se acota a ±DIFFICULTY_WEIGHT. En la escala nueva un partido
// bien repartido vale hasta 2.0 (dos "Excelente") y uno con un sacrificio baja de 0, así
// que 0.25 pesa parecido a la diferencia entre un horario bueno y uno regular: alcanza
// para desempatar entre emparejamientos parecidos y no para tapar una diferencia de
// felicidad de verdad.
const DIFFICULTY_WEIGHT = 0.25;
// difficultyBalanceGain devuelve PUNTOS DE DIFICULTAD (la nota del admin es 1-10), una
// escala que no tiene nada que ver con la del score. Sin dividir por el gain máximo
// posible —4,5 por equipo, 9 entre los dos— un solo emparejamiento bien balanceado
// sumaba hasta 2,25 al score, más que el rango COMPLETO de la felicidad: la dificultad
// dejaba de ser un desempate y pasaba a decidir sola.
const MAX_DIFFICULTY_GAIN = 9;
// Math.random()-0.5 ∈ [-0.5,0.5]; con este factor el aporte de temperatura queda en
// ±0.15 — variedad perceptible entre corridas sucesivas de "Sugerir partidos" sin
// dominar sobre felicidad ni dificultad.
const DEFAULT_TEMPERATURE = 0.3;
// La temperatura mueve a QUIÉN le toca con quién, pero es un número por PAR: igual en
// todos sus bloques, así que sola no cambiaría nunca el horario elegido. Este ruido
// mucho más chico se suma por (partido, bloque) al resolver la agenda y solo alcanza
// para romper empates EXACTOS al azar — sin él, dos corridas seguidas dejaban siempre
// el mismo horario aunque hubiera decenas de bloques igual de buenos. El salto real más
// chico que puede haber entre dos bloques de un mismo equipo es 0.20 (de "Buena" a
// "Excelente") por el peso de karma mínimo (0.65), o sea 0.13 — más de veinte veces el
// ruido, que como mucho llega a 0.005.
const BLOCK_JITTER = 0.01;

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

// ---------------------------------------------------------------------------------
// El problema, y por qué ahora se puede resolver bien
//
// Con la escala compartida el total de una tanda es SEPARABLE por equipo:
//
//     total = Σ_equipos  karma(e) · valor(nota que le tocó a e)   +   ajustes por par
//
// El aporte de un equipo depende solo del BLOQUE que le toca, no de contra quién juega.
// Eso convierte la parte difícil del problema en "repartir bloques", y permite resolver
// esa mitad de forma exacta (algoritmo húngaro) en vez de la pasada codiciosa que había
// antes, que elegía el mejor bloque de cada par por separado y después iba destrabando
// los choques uno a uno según quién perdía menos.
//
// La orquestación queda en tres pasos:
//   1. Emparejar con el DP de siempre, usando como peso de cada par el mejor total que
//      podría alcanzar si tuviera su bloque favorito disponible (una cota optimista).
//   2. Repartir los bloques de forma ÓPTIMA dado ese emparejamiento (húngaro).
//   3. Corregir el emparejamiento con intercambios 2 a 2, que es donde se paga la
//      diferencia entre la cota optimista del paso 1 y la realidad del paso 2.
// ---------------------------------------------------------------------------------

// values[i][b] = aporte del equipo i si juega en el bloque de índice b, o null si ese
// equipo no tiene calificado ese bloque (no puede jugar ahí).
function buildTeamValues(teams, happinessByTeam, blocks, weights) {
    return teams.map((team, i) => {
        const happiness = (happinessByTeam || {})[team] || {};
        const w = weights[i];
        return blocks.map((b) => {
            const level = happiness[b];
            return level === undefined ? null : w * levelValue(level);
        });
    });
}

// Los `k` mejores bloques del par (i,j), de mejor a peor. Devuelve los índices, o un
// arreglo vacío si no comparten ningún bloque usable.
//
// Quedarse con unos pocos y no con todos no pierde nada, y esa es la clave de que una
// tanda de 20 partidos sea viable: cuando hay que ubicar un partido, los demás ocupan a
// lo sumo m-1 bloques, así que entre los m+1 mejores de un par siempre quedan al menos
// dos libres. Buscar más abajo en su lista es imposible que sirva. Con la ventana
// completa eso baja el recorrido de 177 bloques a 21 en el bucle más caliente de todos.
function pairShortlist(values, i, j, nb, k) {
    const vi = values[i];
    const vj = values[j];
    const idx = [];
    const val = [];
    for (let b = 0; b < nb; b++) {
        const a = vi[b];
        if (a === null) continue;
        const c = vj[b];
        if (c === null) continue;
        const v = a + c;
        if (idx.length === k && v <= val[k - 1]) continue;
        let pos = idx.length < k ? idx.length : k - 1;
        while (pos > 0 && val[pos - 1] < v) {
            val[pos] = val[pos - 1];
            idx[pos] = idx[pos - 1];
            pos--;
        }
        val[pos] = v;
        idx[pos] = b;
    }
    return idx;
}

// weight[i][j] (i<j) = cota optimista del par: su mejor bloque + el ajuste de dificultad
// y temperatura. null cuando el par es imposible (excluido por revancha, o sin ningún
// bloque en común). `bonus[i][j]` se devuelve aparte porque el reparto de bloques no lo
// mira (es constante en todos los bloques del par) pero los intercambios del paso 3 sí.
function buildPairWeights(teams, values, nb, excludedPairs, difficultyContext) {
    const n = teams.length;
    // Los m-1 partidos restantes ocupan a lo sumo m-1 bloques; con m+1 candidatos por
    // par siempre quedan dos libres, que es lo que la búsqueda necesita mirar.
    const shortlistSize = Math.min(nb, n / 2 + 1);
    const weight = {};
    const bonus = {};
    const shortlist = {};
    for (let i = 0; i < n; i++) {
        weight[i] = {};
        bonus[i] = {};
        shortlist[i] = {};
        for (let j = i + 1; j < n; j++) {
            bonus[i][j] = 0;
            shortlist[i][j] = null;
            if (excludedPairs && excludedPairs.has(pairKey(teams[i], teams[j]))) {
                weight[i][j] = null;
                continue;
            }
            const top = pairShortlist(values, i, j, nb, shortlistSize);
            if (top.length === 0) {
                weight[i][j] = null;
                continue;
            }
            shortlist[i][j] = top;
            const best = { blockIndex: top[0], value: values[i][top[0]] + values[j][top[0]] };
            if (difficultyContext) {
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
                bonus[i][j] = DIFFICULTY_WEIGHT * normalizedGain + (dc.temperature || 0) * (Math.random() - 0.5);
            }
            weight[i][j] = best.value + bonus[i][j];
        }
    }
    return { weight, bonus, shortlist };
}

function pairLookup(matrix, i, j) {
    return i < j ? matrix[i][j] : matrix[j][i];
}

// ---------------------------------------------------------------------------------
// Quién juega contra quién
//
// Acá había un DP con máscara de bits que resolvía el emparejamiento de peso máximo de
// forma exacta. Era exacto y era un callejón sin salida: 2^n estados, con un `1 << n`
// que deja de funcionar en 31, así que el tope de equipos por tanda no podía pasar de
// ~24. Con ligas de 36 equipos eso obligaba a partir la fecha en dos tandas a mano.
//
// Lo reemplaza un arranque codicioso más la búsqueda local que ya estaba. La razón por
// la que se puede: el emparejamiento inicial casi no importa. Medido sobre la
// disponibilidad real de la Copa CDI Masculina, en 16 escenarios (4 rangos de cancha ×
// 4 tamaños de tanda) la búsqueda local llega EXACTAMENTE al mismo total partiendo del
// óptimo del DP, del codicioso o de un emparejamiento al azar — y en uno de los 16
// termina mejor sin el DP, porque el DP optimizaba una cota optimista (cada par supone
// que va a conseguir su bloque favorito) que después no se puede cumplir.
//
// Lo único que sí exige una respuesta exacta es la FACTIBILIDAD: si "evitar revanchas"
// deja a alguien sin ningún rival posible, hay que decirlo con certeza y no porque al
// codicioso no se le ocurrió cómo. Eso lo resuelve Edmonds más abajo.
// ---------------------------------------------------------------------------------

// Emparejamiento de cardinalidad máxima en un grafo general (algoritmo de flores de
// Edmonds), O(n³). `match[i]` es el rival de i, o -1 si quedó suelto.
//
// Las "flores" son el motivo por el que esto no es simplemente la búsqueda de caminos
// aumentantes de un grafo bipartito: en un grafo general un ciclo de largo impar puede
// esconder un camino aumentante, y hay que contraerlo a un solo nodo para verlo. No es
// código para leer de corrido; está validado contra fuerza bruta sobre 6.000 grafos
// aleatorios de hasta 12 nodos, y el test de abajo mantiene esa comparación.
//
// `initialMatch` (opcional) permite arrancar de un emparejamiento ya armado —el
// codicioso— en vez de desde cero. El resultado es el mismo (también verificado); lo
// que cambia es que conserva los pares buenos que el codicioso ya eligió.
function maximumMatching(n, allowed, initialMatch) {
    const match = new Array(n).fill(-1);
    if (initialMatch) for (let i = 0; i < n; i++) match[i] = initialMatch[i];

    const p = new Array(n);
    const base = new Array(n);
    const used = new Array(n);
    const blossom = new Array(n);

    // Ancestro común más bajo de a y b en el árbol alternante.
    function lca(a, b) {
        const seen = new Array(n).fill(false);
        let x = a;
        for (;;) {
            x = base[x];
            seen[x] = true;
            if (match[x] === -1) break;
            x = p[match[x]];
        }
        let y = b;
        for (;;) {
            y = base[y];
            if (seen[y]) return y;
            y = p[match[y]];
        }
    }

    // Marca los nodos del ciclo impar que se va a contraer.
    function markPath(v, b, child) {
        while (base[v] !== b) {
            blossom[base[v]] = true;
            blossom[base[match[v]]] = true;
            p[v] = child;
            child = match[v];
            v = p[match[v]];
        }
    }

    // Camino aumentante desde `root`, o -1 si no hay.
    function findPath(root) {
        used.fill(false);
        p.fill(-1);
        for (let i = 0; i < n; i++) base[i] = i;
        used[root] = true;
        const queue = [root];
        for (let qh = 0; qh < queue.length; qh++) {
            const v = queue[qh];
            for (let to = 0; to < n; to++) {
                if (to === v || !allowed(v, to)) continue;
                if (base[v] === base[to] || match[v] === to) continue;
                if (to === root || (match[to] !== -1 && p[match[to]] !== -1)) {
                    const curbase = lca(v, to);
                    blossom.fill(false);
                    markPath(v, curbase, to);
                    markPath(to, curbase, v);
                    for (let i = 0; i < n; i++) {
                        if (blossom[base[i]]) {
                            base[i] = curbase;
                            if (!used[i]) {
                                used[i] = true;
                                queue.push(i);
                            }
                        }
                    }
                } else if (p[to] === -1) {
                    p[to] = v;
                    if (match[to] === -1) return to;
                    used[match[to]] = true;
                    queue.push(match[to]);
                }
            }
        }
        return -1;
    }

    for (let v = 0; v < n; v++) {
        if (match[v] !== -1) continue;
        const u = findPath(v);
        if (u === -1) continue;
        let x = u;
        while (x !== -1) {
            const pv = p[x];
            const ppv = match[pv];
            match[x] = pv;
            match[pv] = x;
            x = ppv;
        }
    }
    return match;
}

// Emparejamiento codicioso por peso: el mejor par disponible, sacarlo, repetir. Puede
// dejar equipos sueltos si los pares excluidos lo acorralan; de eso se encarga Edmonds.
function greedyMatch(n, weight) {
    const candidates = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const w = weight[i][j];
            if (w !== null) candidates.push([w, i, j]);
        }
    }
    // El desempate por índice no es cosmético: sin él el orden de los pares empatados
    // —y hay muchísimos, porque los pesos se repiten— dependería de si el motor tiene
    // un sort estable, y la propuesta dejaría de ser reproducible con temperatura 0.
    candidates.sort((a, b) => (b[0] - a[0]) || (a[1] - b[1]) || (a[2] - b[2]));
    const match = new Array(n).fill(-1);
    for (const [, i, j] of candidates) {
        if (match[i] !== -1 || match[j] !== -1) continue;
        match[i] = j;
        match[j] = i;
    }
    return match;
}

// ¿Existe un emparejamiento perfecto (todos los equipos cubiertos) usando solo pares
// posibles?
function perfectMatchingExists(n, weight) {
    if (n % 2 !== 0) return false;
    const allowed = (a, b) => pairLookup(weight, a, b) !== null;
    const match = maximumMatching(n, allowed, greedyMatch(n, weight));
    return match.every((x) => x !== -1);
}

// Emparejamiento de arranque para la búsqueda local: el codicioso, completado por
// Edmonds si dejó a alguien suelto. Devuelve pares de ÍNDICES con i<j, o null si no
// existe ningún emparejamiento perfecto.
function buildPairing(n, weight) {
    if (n % 2 !== 0) return null;
    const allowed = (a, b) => pairLookup(weight, a, b) !== null;
    const match = maximumMatching(n, allowed, greedyMatch(n, weight));
    if (match.some((x) => x === -1)) return null;

    const pairs = [];
    for (let i = 0; i < n; i++) {
        if (match[i] > i) pairs.push([i, match[i]]);
    }
    return pairs;
}

// Costo prohibitivo para un (partido, bloque) imposible. Es finito a propósito: si la
// tanda tiene menos bloques usables que partidos, el húngaro igual devuelve un reparto
// —minimizando cuántos partidos quedan mal ubicados— en vez de no devolver nada.
const FORBIDDEN = 1e6;

// Lo que cuesta que dos partidos compartan hora. Hay una sola cancha, así que eso es
// físicamente imposible y el admin va a tener que descartar uno de los dos: repetir un
// bloque es siempre peor que cualquier diferencia de felicidad, y por eso el número es
// enorme al lado de la escala real (un partido aporta como mucho 2.8). Queda entre
// medio: por debajo de FORBIDDEN, así que ante la disyuntiva el reparto prefiere
// repetir hora antes que mandar a un par a un bloque que no puede usar.
//
// Sin esto, el objetivo era indiferente a los choques y en una tanda sobre-suscrita
// —20 partidos para 15 horas— dejaba 11 bloques usados y 18 partidos chocando, cuando
// usando los 15 quedaban solo 10.
const COLLISION_PENALTY = 1e3;

// Algoritmo húngaro (versión de caminos aumentantes con potenciales, O(m²·nb)) para
// MINIMIZAR. `cost` es m×nb con m ≤ nb. Devuelve assignment[fila] = columna.
function hungarian(cost, m, nb) {
    const u = new Array(m + 1).fill(0);
    const v = new Array(nb + 1).fill(0);
    const p = new Array(nb + 1).fill(0);
    const way = new Array(nb + 1).fill(0);

    for (let i = 1; i <= m; i++) {
        p[0] = i;
        let j0 = 0;
        const minv = new Array(nb + 1).fill(Infinity);
        const used = new Array(nb + 1).fill(false);
        do {
            used[j0] = true;
            const i0 = p[j0];
            let delta = Infinity;
            let j1 = -1;
            for (let j = 1; j <= nb; j++) {
                if (used[j]) continue;
                const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
                if (cur < minv[j]) {
                    minv[j] = cur;
                    way[j] = j0;
                }
                if (minv[j] < delta) {
                    delta = minv[j];
                    j1 = j;
                }
            }
            for (let j = 0; j <= nb; j++) {
                if (used[j]) {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }
            j0 = j1;
        } while (p[j0] !== 0);
        do {
            const j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
        } while (j0);
    }

    const assignment = new Array(m).fill(-1);
    for (let j = 1; j <= nb; j++) {
        if (p[j]) assignment[p[j] - 1] = j - 1;
    }
    return assignment;
}

// Reparto ÓPTIMO de bloques dado el emparejamiento: cada partido a un bloque distinto,
// maximizando la felicidad total. Devuelve un arreglo de índices de bloque, uno por par.
//
// Cuando hay menos bloques que partidos no queda otra que repetir alguno (hay una sola
// cancha, así que eso es físicamente imposible y el panel lo avisa): se duplican las
// columnas las veces necesarias y el caller marca como `collision` los partidos que
// terminan compartiendo hora.
function assignBlocks(pairs, values, nb, jitter, shortlist) {
    const m = pairs.length;
    if (m === 0) return [];

    // Solo hacen falta los bloques que alguno de los partidos tiene entre sus mejores m:
    // en un reparto óptimo ningún partido usa un bloque peor que ésos, porque los otros
    // m-1 partidos no pueden bloquearle más de m-1. Con la ventana completa y 20
    // partidos esto suele recortar el húngaro de 177 columnas a unas pocas decenas.
    const useful = [];
    if (shortlist) {
        const seen = new Array(nb).fill(false);
        for (const [i, j] of pairs) {
            const top = pairLookup(shortlist, i, j);
            if (!top) continue;
            for (const b of top) {
                if (!seen[b]) {
                    seen[b] = true;
                    useful.push(b);
                }
            }
        }
        useful.sort((a, b) => a - b);
    } else {
        for (let b = 0; b < nb; b++) useful.push(b);
    }
    const base = useful.length ? useful : (() => { const all = []; for (let b = 0; b < nb; b++) all.push(b); return all; })();

    const copies = Math.max(1, Math.ceil(m / base.length));
    const columns = [];
    const columnCopy = [];
    for (let c = 0; c < copies; c++) {
        for (const b of base) {
            columns.push(b);
            columnCopy.push(c);
        }
    }

    const cost = [];
    for (let r = 0; r < m; r++) {
        const [i, j] = pairs[r];
        const row = new Array(columns.length);
        for (let c = 0; c < columns.length; c++) {
            const b = columns[c];
            const a = values[i][b];
            const d = values[j][b];
            if (a === null || d === null) {
                row[c] = FORBIDDEN;
            } else {
                // Se minimiza, así que el valor va con signo cambiado. El ruido rompe
                // empates exactos al azar sin poder alterar ninguna diferencia real, y
                // las copias extra de un bloque cargan la penalización por chocar: así
                // el húngaro llena primero todas las horas distintas y solo dobla las
                // que no le queda más remedio que doblar.
                row[c] = -(a + d) + COLLISION_PENALTY * columnCopy[c] + (jitter ? jitter * (Math.random() - 0.5) : 0);
            }
        }
        cost.push(row);
    }

    const assignment = hungarian(cost, m, columns.length);
    return assignment.map((c) => columns[c]);
}

// Total de una solución completa: felicidad de los bloques asignados, ajustes por par,
// y la penalización por cada partido de más que comparte hora con otro. Lo último tiene
// que estar acá y no solo dentro del húngaro, porque es lo que compara las soluciones
// entre sí a lo largo de la búsqueda.
function solutionScore(pairs, blockIndexes, values, bonus) {
    let total = 0;
    for (let r = 0; r < pairs.length; r++) {
        const [i, j] = pairs[r];
        const b = blockIndexes[r];
        const a = values[i][b];
        const c = values[j][b];
        total += (a === null ? -FORBIDDEN : a) + (c === null ? -FORBIDDEN : c);
        total += pairLookup(bonus, i, j);
    }
    const seen = {};
    let repeated = 0;
    for (const b of blockIndexes) {
        if (seen[b]) repeated += 1;
        else seen[b] = true;
    }
    return total - COLLISION_PENALTY * repeated;
}

// Mejor forma de ubicar DOS pares en dos bloques distintos entre los libres (los que
// `usedCount` no marca como ocupados). Devuelve { blocks: [b1, b2], value } o null si no
// se puede — alguno de los dos no tiene ningún bloque usable, o solo hay uno y lo
// comparten.
//
// Está escrito sin asignar ni un objeto por bloque examinado, con los mejores y segundos
// mejores como escalares sueltos, y recorriendo los índices en vez de recibir una lista
// ya filtrada de bloques libres. No es microoptimización gratuita: esto corre dentro de
// los dos bucles anidados de cada barrida de mejora, y con 12 partidos y 177 bloques la
// versión que armaba una lista y creaba un objeto por candidato hacía millones de
// asignaciones por tanda — en Goja eso era la mayor parte del tiempo de la propuesta.
function bestTwoBlocks(values, pairA, pairB, usedCount, shortlist) {
    // Las listas ya vienen ordenadas de mejor a peor, así que los dos primeros libres
    // son los dos mejores libres: no hace falta comparar nada.
    const topA = pairLookup(shortlist, pairA[0], pairA[1]);
    const topB = pairLookup(shortlist, pairB[0], pairB[1]);
    if (!topA || !topB) return null;

    let aBestIdx = -1, aBestVal = 0, aSecondIdx = -1, aSecondVal = 0;
    for (const b of topA) {
        if (usedCount[b] > 0) continue;
        const v = values[pairA[0]][b] + values[pairA[1]][b];
        if (aBestIdx === -1) { aBestIdx = b; aBestVal = v; }
        else { aSecondIdx = b; aSecondVal = v; break; }
    }
    let bBestIdx = -1, bBestVal = 0, bSecondIdx = -1, bSecondVal = 0;
    for (const b of topB) {
        if (usedCount[b] > 0) continue;
        const v = values[pairB[0]][b] + values[pairB[1]][b];
        if (bBestIdx === -1) { bBestIdx = b; bBestVal = v; }
        else { bSecondIdx = b; bSecondVal = v; break; }
    }

    if (aBestIdx === -1 || bBestIdx === -1) return null;
    if (aBestIdx !== bBestIdx) {
        return { blocks: [aBestIdx, bBestIdx], value: aBestVal + bBestVal };
    }
    // Los dos quieren el mismo bloque: uno de los dos se queda con su segunda opción.
    const cedeA = aSecondIdx === -1 ? null : { blocks: [aSecondIdx, bBestIdx], value: aSecondVal + bBestVal };
    const cedeB = bSecondIdx === -1 ? null : { blocks: [aBestIdx, bSecondIdx], value: aBestVal + bSecondVal };
    if (cedeA && cedeB) return cedeA.value >= cedeB.value ? cedeA : cedeB;
    return cedeA || cedeB;
}

// El paso 1 empareja con una cota optimista (cada par supone que va a conseguir su
// bloque favorito), pero el paso 2 reparte los bloques de verdad y varios pares no lo
// consiguen. Esta pasada arregla esa diferencia: barre todas las parejas de partidos
// probando las dos formas alternativas de recombinar sus cuatro equipos, y se queda con
// las que mejoren el total. Al final de cada barrida se vuelven a repartir TODOS los
// bloques con el húngaro, porque un intercambio puede liberar un bloque que le sirve a
// un tercer partido; y se vuelve a barrer hasta que nada mejore.
//
// El tope de barridas es una red de seguridad, no el criterio de parada: cada barrida
// aceptada sube estrictamente el total y el ciclo corta solo en cuanto una barrida no
// mejora nada. Tiene que ser alto igual — cortar la búsqueda a mitad de camino cuesta,
// contra una búsqueda estocástica larga sobre el mismo objetivo, más de un punto en las
// tandas de 24 equipos con la cancha acotada: un equipo entero sacrificado de más.
const MAX_IMPROVE_ROUNDS = 60;

function localImprove(pairs, blockIndexes, values, nb, weight, bonus, jitter, shortlist) {
    const currentPairs = pairs.map((p) => p.slice());
    let currentBlocks = blockIndexes.slice();
    let currentScore = solutionScore(currentPairs, currentBlocks, values, bonus);

    // Cuántos partidos ocupan cada bloque. Es un conteo y no un booleano porque cuando
    // no alcanzan los horarios usables dos partidos pueden compartir bloque, y ahí
    // liberar uno no libera el bloque. Se reserva una sola vez y se va actualizando:
    // reconstruirlo para cada pareja de partidos era otro arreglo de 177 por iteración.
    const usedCount = new Array(nb).fill(0);
    currentBlocks.forEach((b) => (usedCount[b] += 1));

    for (let round = 0; round < MAX_IMPROVE_ROUNDS; round++) {
        for (let p = 0; p < currentPairs.length; p++) {
            for (let q = p + 1; q < currentPairs.length; q++) {
                usedCount[currentBlocks[p]] -= 1;
                usedCount[currentBlocks[q]] -= 1;

                const [a1, a2] = currentPairs[p];
                const [b1, b2] = currentPairs[q];
                // Un partido puede estar parado sobre un bloque que ni siquiera es usable
                // para ese par (pasa solo cuando no alcanzan los horarios y el reparto
                // tuvo que forzar alguno). Vale FORBIDDEN, igual que en solutionScore: si
                // se dejara en null, la resta daba NaN, ninguna comparación era cierta y
                // justamente ese partido —el peor de todos— era el único que la búsqueda
                // no intentaba arreglar nunca.
                const at = (team, blockIndex) => {
                    const v = values[team][blockIndex];
                    return v === null ? -FORBIDDEN : v;
                };
                const before =
                    at(a1, currentBlocks[p]) + at(a2, currentBlocks[p]) + pairLookup(bonus, a1, a2) +
                    at(b1, currentBlocks[q]) + at(b2, currentBlocks[q]) + pairLookup(bonus, b1, b2);

                const alternatives = [
                    [[a1, b1], [a2, b2]],
                    [[a1, b2], [a2, b1]],
                ];
                for (const [x, y] of alternatives) {
                    const px = x[0] < x[1] ? x : [x[1], x[0]];
                    const py = y[0] < y[1] ? y : [y[1], y[0]];
                    if (pairLookup(weight, px[0], px[1]) === null) continue;
                    if (pairLookup(weight, py[0], py[1]) === null) continue;
                    const placed = bestTwoBlocks(values, px, py, usedCount, shortlist);
                    if (!placed) continue;
                    const after = placed.value + pairLookup(bonus, px[0], px[1]) + pairLookup(bonus, py[0], py[1]);
                    if (after > before + EPS) {
                        currentPairs[p] = px;
                        currentPairs[q] = py;
                        currentBlocks[p] = placed.blocks[0];
                        currentBlocks[q] = placed.blocks[1];
                        break;
                    }
                }

                usedCount[currentBlocks[p]] += 1;
                usedCount[currentBlocks[q]] += 1;
            }
        }

        // Solo se conserva el reparto nuevo si efectivamente mejora: el ruido de
        // desempate podría, si no, empeorar el total de una barrida a la siguiente.
        const reassigned = assignBlocks(currentPairs, values, nb, jitter, shortlist);
        const reassignedScore = solutionScore(currentPairs, reassigned, values, bonus);
        const sweptScore = solutionScore(currentPairs, currentBlocks, values, bonus);
        if (reassignedScore > sweptScore + EPS) {
            currentBlocks.forEach((b) => (usedCount[b] -= 1));
            currentBlocks = reassigned;
            currentBlocks.forEach((b) => (usedCount[b] += 1));
        }
        const roundScore = Math.max(reassignedScore, sweptScore);

        if (roundScore <= currentScore + EPS) {
            currentScore = roundScore;
            break;
        }
        currentScore = roundScore;
    }

    return { pairs: currentPairs, blockIndexes: currentBlocks, score: currentScore };
}

// Generador pseudoaleatorio propio para las perturbaciones de la búsqueda. Va aparte de
// Math.random a propósito: con temperatura 0 se siembra con una constante y la propuesta
// es EXACTAMENTE reproducible, que es lo que los tests necesitan; con temperatura, se
// siembra al azar y dos corridas seguidas de "Sugerir partidos" exploran caminos
// distintos.
//
// Es un LCG clásico y no algo más moderno porque esto corre dentro de Goja: se hace todo
// con multiplicación y módulo en punto flotante (1664525 · 2³² ≈ 7.1e15, cómodamente por
// debajo del entero exacto más grande de un double) en vez de con operadores de 32 bits
// o Math.imul, cuyo soporte no conviene dar por sentado ahí.
function makeRandom(seed) {
    let state = Math.abs(Math.floor(seed)) % 4294967296 || 1;
    return function () {
        state = (1664525 * state + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

// Cuántas veces se sacude la solución para escaparse de un óptimo local, y cuántas
// sacudidas seguidas sin mejorar hacen falta para dar la búsqueda por terminada.
//
// Los intercambios 2 a 2 de localImprove no alcanzan solos: hay mejoras que exigen mover
// TRES partidos a la vez, y sin sacudidas esas tandas se quedaban cortas por más de un
// punto contra una búsqueda estocástica larga sobre el mismo objetivo — un equipo entero
// sacrificado de más. Cada sacudida repara exactamente eso: re-empareja al azar tres
// partidos, vuelve a optimizar, y solo se queda con el resultado si mejora, así que
// subir el número nunca empeora la propuesta.
//
// Los valores son los más baratos que no pierden nada. Medido sobre la disponibilidad
// real de la Copa CDI Masculina, en 20 escenarios (4 rangos de cancha × 5 tamaños de
// tanda, hasta 36 equipos) con 24/8 la propuesta iguala o supera a la búsqueda
// estocástica larga en los 20, igual que con 60/20, y tarda la mitad. Eso importa:
// esto corre en Goja sobre un Atom, donde una tanda de 20 partidos ya son segundos.
const PERTURBATIONS = 24;
const STALE_PERTURBATIONS = 8;

// Búsqueda iterada: óptimo local, sacudida, óptimo local otra vez, quedándose siempre
// con el mejor. Es lo que hace que el emparejamiento de arranque no importe: partiendo
// del codicioso, del que armaba el DP viejo o de uno al azar, se llega al mismo total.
//
// Se corta por estancamiento: cuando STALE_PERTURBATIONS sacudidas seguidas no mejoran
// nada, seguir sacudiendo es tiempo tirado. Importa porque esto corre en Goja sobre un
// servidor de 2 GB, y una tanda de 20 partidos sobre la ventana completa son 190 parejas
// de partidos por barrida.
function improvePairing(pairs, blockIndexes, values, nb, weight, bonus, jitter, random, shortlist) {
    let best = localImprove(pairs, blockIndexes, values, nb, weight, bonus, jitter, shortlist);
    const m = pairs.length;
    if (m < 3) return best;

    let stale = 0;
    for (let k = 0; k < PERTURBATIONS && stale < STALE_PERTURBATIONS; k++) {
        // Tres partidos al azar, re-emparejados al azar entre sus seis equipos.
        const picked = [];
        while (picked.length < 3) {
            const r = Math.floor(random() * m);
            if (picked.indexOf(r) === -1) picked.push(r);
        }
        const pool = [];
        picked.forEach((r) => pool.push(best.pairs[r][0], best.pairs[r][1]));
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            const tmp = pool[i];
            pool[i] = pool[j];
            pool[j] = tmp;
        }
        const shaken = best.pairs.map((p) => p.slice());
        let ok = true;
        picked.forEach((r, idx) => {
            const a = pool[idx * 2];
            const b = pool[idx * 2 + 1];
            const pair = a < b ? [a, b] : [b, a];
            if (pairLookup(weight, pair[0], pair[1]) === null) ok = false;
            shaken[r] = pair;
        });
        if (!ok) continue;

        const shakenBlocks = assignBlocks(shaken, values, nb, jitter, shortlist);
        const candidate = localImprove(shaken, shakenBlocks, values, nb, weight, bonus, jitter, shortlist);
        if (candidate.score > best.score + EPS) {
            best = candidate;
            stale = 0;
        } else {
            stale += 1;
        }
    }
    return best;
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

// Tope de equipos por tanda. Ya no lo impone la estructura del algoritmo (el DP de 2^n
// que lo dejaba en 24 se fue): lo impone el servidor, un Atom con 2 GB. El costo crece
// con el cuadrado de los partidos (cada barrida de mejora mira todas las parejas de
// partidos) y 40 equipos —20 partidos— es lo que cabe en un request razonable. Alcanza
// para agendar de una vez la fecha completa de la liga más grande (36 equipos).
const MAX_TEAMS = 40;

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
// barata de proposeMatches (solo la factibilidad), para que el caller pueda probar
// candidatos a bye sin calcular la propuesta completa de cada uno.
function isPairingFeasible(teams, happinessByTeam, excludedPairs, candidateBlocks) {
    if (teams.length === 0) return true;
    if (teams.length % 2 !== 0) return false;
    // Solo importa QUÉ pares son posibles, no cuánto valen, así que la matriz se arma a
    // mano en vez de pasar por buildTeamValues/buildPairWeights: basta con encontrar UN
    // bloque en común y cortar. El caller la llama en un bucle sobre los candidatos a
    // bye, y con 39 equipos y la ventana completa la versión que calculaba media
    // propuesta para tirarla costaba cientos de milisegundos por candidato.
    const blocks = resolveCandidateBlocks(teams, happinessByTeam, candidateBlocks);
    const n = teams.length;
    const happiness = teams.map((t) => (happinessByTeam || {})[t] || {});
    const weight = {};
    for (let i = 0; i < n; i++) {
        weight[i] = {};
        for (let j = i + 1; j < n; j++) {
            if (excludedPairs && excludedPairs.has(pairKey(teams[i], teams[j]))) {
                weight[i][j] = null;
                continue;
            }
            let comparten = false;
            for (const b of blocks) {
                if (happiness[i][b] !== undefined && happiness[j][b] !== undefined) {
                    comparten = true;
                    break;
                }
            }
            weight[i][j] = comparten ? 1 : null;
        }
    }
    return perfectMatchingExists(n, weight);
}

// Orquestación completa: recibe una cantidad PAR de equipos (el caller resuelve el
// bye antes de llamar) y devuelve la propuesta de emparejamiento con ids reales.
// `excludedPairs` (Set de pairKey, opcional) evita que el batch proponga un partido
// entre dos equipos que ya se enfrentaron (según el criterio que decida el caller).
//
// Lo que devuelve está en la escala REAL de notas (1-5), no en ninguna escala interna:
//
//   - `worst`: la peor nota que le tocó a algún equipo de la tanda.
//   - `sacrificed`: los equipos a los que les tocó "Muy mala" o "Mala", con cuánta
//     disponibilidad había ofrecido cada uno (que es la razón por la que les tocó a
//     ellos y no a otros).
//   - `avgHappiness`: la nota promedio de la tanda.
//   - `maxGap`: la mayor diferencia de nota dentro de un mismo partido. Ya no es un
//      criterio; se informa porque el panel la muestra y se guarda en league_matches.gap.
function proposeMatches(teams, happinessByTeam, excludedPairs, difficultyContext, candidateBlocks) {
    if (teams.length % 2 !== 0) {
        throw new Error("proposeMatches requiere una cantidad par de equipos.");
    }
    if (teams.length === 0) {
        return {
            worst: null, maxGap: null, avgHappiness: null, totalScore: 0,
            matches: [], sacrificed: [], infeasible: false,
        };
    }
    // Un id repetido no es un caso raro sino un dato corrupto con consecuencias: el par
    // (X,X) tiene la felicidad máxima posible, así que el optimizador lo PREFIERE y la
    // propuesta termina con "X vs X".
    if (new Set(teams).size !== teams.length) {
        throw new Error("proposeMatches recibió el mismo equipo más de una vez.");
    }
    if (teams.length > MAX_TEAMS) {
        throw new Error(`El emparejamiento admite hasta ${MAX_TEAMS} equipos por tanda; elige menos.`);
    }

    const blocks = resolveCandidateBlocks(teams, happinessByTeam, candidateBlocks);
    const nb = blocks.length;
    if (nb === 0) {
        return {
            worst: null, maxGap: null, avgHappiness: null, totalScore: null,
            matches: null, sacrificed: null, infeasible: true,
        };
    }

    const weights = karmaWeights(teams, happinessByTeam, blocks);
    const values = buildTeamValues(teams, happinessByTeam, blocks, weights);
    const { weight, bonus, shortlist } = buildPairWeights(teams, values, nb, excludedPairs, difficultyContext);

    const initialPairs = buildPairing(teams.length, weight);
    if (!initialPairs) {
        return {
            worst: null, maxGap: null, avgHappiness: null, totalScore: null,
            matches: null, sacrificed: null, infeasible: true,
        };
    }

    const temperature = (difficultyContext && difficultyContext.temperature) || 0;
    const jitter = temperature ? BLOCK_JITTER : 0;
    const random = makeRandom(temperature ? Math.floor(Math.random() * 0xffffffff) : 0x5eed5eed);
    const firstBlocks = assignBlocks(initialPairs, values, nb, jitter, shortlist);
    const solution = improvePairing(initialPairs, firstBlocks, values, nb, weight, bonus, jitter, random, shortlist);

    const usedCount = {};
    solution.blockIndexes.forEach((b) => (usedCount[b] = (usedCount[b] || 0) + 1));

    const matches = solution.pairs.map(([i, j], r) => {
        const teamA = teams[i];
        const teamB = teams[j];
        const block = blocks[solution.blockIndexes[r]];
        const happinessA = (happinessByTeam[teamA] || {})[block];
        const happinessB = (happinessByTeam[teamB] || {})[block];
        return {
            teamA,
            teamB,
            block,
            gap: Math.abs((happinessA || 0) - (happinessB || 0)),
            happinessA,
            happinessB,
            // No es un empate técnico sino "no había suficientes horas usables para
            // todos los partidos": hay una sola cancha, así que el panel tiene que
            // decirlo en vez de agendar dos partidos a la misma hora a ciegas.
            collision: usedCount[solution.blockIndexes[r]] > 1,
        };
    });

    const levels = [];
    matches.forEach((m) => levels.push(m.happinessA, m.happinessB));
    const known = levels.filter((v) => v !== undefined);
    const worst = known.length ? Math.min(...known) : null;
    const avgHappiness = known.length ? known.reduce((s, v) => s + v, 0) / known.length : null;
    const maxGap = matches.reduce((peor, m) => Math.max(peor, m.gap), 0);

    const offerByTeam = {};
    teams.forEach((t, i) => (offerByTeam[t] = { offer: teamOffer(happinessByTeam[t], blocks), karma: weights[i] }));
    const sacrificed = [];
    matches.forEach((m) => {
        [[m.teamA, m.happinessA], [m.teamB, m.happinessB]].forEach(([team, level]) => {
            if (level !== undefined && isBadLevel(level)) {
                sacrificed.push({
                    team,
                    level,
                    block: m.block,
                    offer: offerByTeam[team].offer,
                    karma: offerByTeam[team].karma,
                });
            }
        });
    });

    return {
        worst,
        maxGap,
        avgHappiness,
        totalScore: solution.score,
        matches,
        sacrificed,
        infeasible: false,
    };
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
    filterToBlocks,
    computeValidBlocks,
    fillDefaultHappiness,
    HAPPINESS_UTILITY,
    BAD_LEVEL,
    SACRIFICE_PENALTY,
    VERY_BAD_EXTRA,
    KARMA_SPREAD,
    KARMA_FULL_SPREAD,
    happinessUtility,
    isBadLevel,
    levelValue,
    teamOffer,
    karmaWeights,
    pairKey,
    DIFFICULTY_WEIGHT,
    DEFAULT_TEMPERATURE,
    difficultyBalanceGain,
    buildTeamValues,
    buildPairWeights,
    perfectMatchingExists,
    maximumMatching,
    greedyMatch,
    buildPairing,
    hungarian,
    assignBlocks,
    suggestByeTeam,
    rankByeCandidates,
    isPairingFeasible,
    proposeMatches,
    MAX_TEAMS,
};
