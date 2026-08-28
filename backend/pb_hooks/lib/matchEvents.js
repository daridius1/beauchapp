// Lógica pura del arbitraje de partidos de liga: el marcador, tarjetas y convocatoria
// NUNCA se guardan sueltos — siempre se derivan de `events`, la bitácora completa y
// ordenada de todo lo que pasó. Eliminar un evento puntual es marcarlo con
// `deleted: true` (soft delete, ver isDeletedEvent) — nunca se saca del arreglo: la
// bitácora es la evidencia de lo que se registró en cancha y un arbitraje se corrige en
// caliente y a veces se discute después. Todo lo derivado (marcador, tarjetas,
// convocatoria, reloj, goleadores) ignora los eventos marcados, así que el arbitraje
// sigue siendo resiliente: el arreglo completo es la única fuente de verdad y se puede
// reconstruir todo desde cero con solo tenerlo. La sesión de arbitraje es compartida — cualquiera con el código del
// partido puede agregar eventos, no hay un árbitro "dueño". Sin $app — testeado en
// __tests__/matchEvents.test.js.

const EVENT_TYPES = [
    "lineup",
    "half_start",
    "half_end",
    "pause",
    "resume",
    "goal",
    "yellow_card",
    "red_card",
    "penalty",
];

// Eventos de jugada real — solo estos requieren que el reloj esté corriendo (no
// pausado, no en entretiempo, no antes/después del partido). Convocatoria y los
// propios controles de tiempo/pausa no cuentan.
const CLOCK_GATED_TYPES = ["goal", "yellow_card", "red_card", "penalty"];

// Un elemento de `lineup.players` es o bien un string suelto (partidos viejos, de
// antes de que existiera el roster de equipo) o un objeto {playerId?, name, photo?}
// apuntando a un team_players (partidos nuevos) — ambas formas conviven, nunca se
// migran los datos ya guardados, `summarizeEvents` es quien las normaliza al leer.
function isValidLineupEntry(p) {
    if (typeof p === "string") return p.length > 0;
    if (p && typeof p === "object") return typeof p.name === "string" && p.name.length > 0;
    return false;
}

// `playerId`, si viene, es solo una referencia opcional a team_players — no se valida
// que exista (este archivo es deliberadamente puro/sin $app, ver comentario de
// cabecera); la única defensa real es de UI (el selector de arbitraje solo ofrece
// jugadores del roster).
function isValidOptionalPlayerId(playerId) {
    return playerId === undefined || (typeof playerId === "string" && playerId.length > 0);
}

// `player` (el nombre) también es opcional — el árbitro puede dejar un gol/tarjeta/
// penal sin asignar a nadie en particular, queda "en blanco" a propósito.
function isValidOptionalPlayer(player) {
    return player === undefined || typeof player === "string";
}

// Un evento borrado NO se saca de la bitácora: se marca. La bitácora es el registro
// de lo que pasó en el partido, y un arbitraje se corrige en caliente y a veces se
// discute después, así que borrar de verdad destruye la única evidencia de que algo se
// había registrado. Marcarlo además hace la fusión entre árbitros trivial: un borrado
// es una edición más del evento, se resuelve por id como cualquier otra y ya no depende
// de que el cliente mande `baseKeys`.
function isDeletedEvent(ev) {
    return Boolean(ev && ev.deleted);
}

function isValidEvent(ev) {
    if (!ev || typeof ev !== "object") return false;
    if (!EVENT_TYPES.includes(ev.type)) return false;
    if (ev.deleted !== undefined && typeof ev.deleted !== "boolean") return false;
    if (ev.type === "lineup") {
        return (
            (ev.team === "A" || ev.team === "B") &&
            Array.isArray(ev.players) &&
            ev.players.every(isValidLineupEntry)
        );
    }
    if (ev.type === "half_start" || ev.type === "half_end") {
        return ev.half === 1 || ev.half === 2;
    }
    if (ev.type === "pause" || ev.type === "resume") {
        return true;
    }
    if (ev.type === "goal") {
        return (
            (ev.team === "A" || ev.team === "B") &&
            isValidOptionalPlayer(ev.player) &&
            isValidOptionalPlayerId(ev.playerId) &&
            typeof ev.ownGoal === "boolean"
        );
    }
    if (ev.type === "yellow_card" || ev.type === "red_card") {
        return (
            (ev.team === "A" || ev.team === "B") &&
            isValidOptionalPlayer(ev.player) &&
            isValidOptionalPlayerId(ev.playerId)
        );
    }
    if (ev.type === "penalty") {
        return (
            (ev.team === "A" || ev.team === "B") &&
            isValidOptionalPlayer(ev.player) &&
            isValidOptionalPlayerId(ev.playerId) &&
            typeof ev.scored === "boolean"
        );
    }
    return false;
}

// ¿Todo evento de jugada real (gol/tarjeta/penal) ocurre mientras el reloj estaba
// efectivamente corriendo? half_start/resume lo prenden, half_end/pause lo apagan.
// Es la validación server-side de "mientras el partido esté pausado o en el
// descanso no se pueden crear eventos" — se re-chequea sobre el arreglo completo en
// cada push (nunca se confía en que el cliente ya lo filtró).
function isClockGatedSequenceValid(events) {
    const list = Array.isArray(events) ? events : [];
    let running = false;
    for (const ev of list) {
        if (!isValidEvent(ev) || isDeletedEvent(ev)) continue;
        if (ev.type === "half_start" || ev.type === "resume") {
            running = true;
        } else if (ev.type === "half_end" || ev.type === "pause") {
            running = false;
        } else if (CLOCK_GATED_TYPES.includes(ev.type)) {
            if (!running) return false;
        }
    }
    return true;
}

// Normaliza un elemento de lineup.players a la forma uniforme {playerId, name, photo}
// sin importar si viene en el formato viejo (string suelto) o nuevo (objeto) — todo
// consumidor de MatchSummary.lineupA/lineupB trabaja siempre con esta forma, nunca con
// las dos por separado.
function normalizeLineupEntry(p) {
    if (typeof p === "string") return { playerId: null, name: p, photo: null };
    return { playerId: p.playerId || null, name: p.name, photo: p.photo || null };
}

// Recorre toda la bitácora y arma el estado derivado completo: marcador, tarjetas,
// última convocatoria de cada equipo, y la lista de goles en orden (para el resumen).
// `team` en cada evento es SIEMPRE de quién hizo la jugada (el jugador), no a quién
// benefició — un autogol resta... no, suma para el equipo contrario, por eso goal con
// ownGoal:true acredita el punto al lado opuesto de `team`.
function summarizeEvents(events) {
    const list = Array.isArray(events) ? events : [];

    let scoreA = 0;
    let scoreB = 0;
    const cardsA = { yellow: 0, red: 0 };
    const cardsB = { yellow: 0, red: 0 };
    let lineupA = [];
    let lineupB = [];
    const goals = [];
    const cards = [];
    const penalties = [];
    let currentHalf = 0;
    const halfStarted = { 1: false, 2: false };
    const halfEnded = { 1: false, 2: false };
    let clockRunning = false;

    for (const ev of list) {
        if (!isValidEvent(ev) || isDeletedEvent(ev)) continue;

        if (ev.type === "lineup") {
            const normalized = ev.players.map(normalizeLineupEntry);
            if (ev.team === "A") lineupA = normalized;
            else lineupB = normalized;
        } else if (ev.type === "half_start") {
            halfStarted[ev.half] = true;
            currentHalf = ev.half;
            clockRunning = true;
        } else if (ev.type === "half_end") {
            halfEnded[ev.half] = true;
            clockRunning = false;
        } else if (ev.type === "pause") {
            clockRunning = false;
        } else if (ev.type === "resume") {
            clockRunning = true;
        } else if (ev.type === "goal") {
            const scoringTeam = ev.ownGoal ? (ev.team === "A" ? "B" : "A") : ev.team;
            if (scoringTeam === "A") scoreA++;
            else scoreB++;
            goals.push({ ...ev, scoringTeam });
        } else if (ev.type === "yellow_card") {
            (ev.team === "A" ? cardsA : cardsB).yellow++;
            cards.push(ev);
        } else if (ev.type === "red_card") {
            (ev.team === "A" ? cardsA : cardsB).red++;
            cards.push(ev);
        } else if (ev.type === "penalty") {
            if (ev.scored) {
                if (ev.team === "A") scoreA++;
                else scoreB++;
            }
            penalties.push(ev);
        }
    }

    return {
        scoreA,
        scoreB,
        cardsA,
        cardsB,
        lineupA,
        lineupB,
        goals,
        cards,
        penalties,
        currentHalf,
        halfStarted,
        halfEnded,
        clockRunning,
    };
}

// ---------------------------------------------------------------------------------
// Tabla de goleadores de un campeonato.
//
// Se deriva de las mismas bitácoras que todo lo demás — no hay ningún contador de goles
// guardado por jugador, ni hace falta: el cálculo es sobre datos que el cliente ya tiene
// cargados para pintar la liga (PRINCIPLES.md §1, "si se puede hacer en el cliente, se
// hace en el cliente"). Vive acá, y no solo en el .ts del frontend, para poder testearla.
//
// Cuenta como gol del jugador: un `goal` que NO sea en contra, y un `penalty` convertido.
// Un autogol suma al marcador rival pero nunca al goleador, que es como se cuenta en
// cualquier tabla real.
//
// `matchEntries`: [{ events, teamAId, teamBId }]. La identidad de un goleador es su
// `playerId` del roster; para los eventos viejos que no lo tienen se cae al par
// equipo+nombre, para no fusionar a dos jugadores homónimos de equipos distintos.
// ---------------------------------------------------------------------------------
function computeTopScorers(matchEntries) {
    const entries = Array.isArray(matchEntries) ? matchEntries : [];
    const byKey = {};

    function scorerKey(playerId, teamId, name) {
        if (playerId) return "p:" + playerId;
        return "n:" + String(teamId || "") + ":" + String(name || "");
    }

    for (const entry of entries) {
        const events = Array.isArray(entry && entry.events) ? entry.events : [];
        const teamIdFor = (side) => (side === "A" ? entry.teamAId : entry.teamBId);

        // Las fotos viven en los eventos de convocatoria, no en los de gol: se indexan
        // primero para poder adjuntarlas al goleador sin volver a consultar el roster.
        const photoByPlayerId = {};
        const photoByName = {};
        for (const ev of events) {
            if (!ev || ev.type !== "lineup" || !Array.isArray(ev.players)) continue;
            if (isDeletedEvent(ev)) continue;
            for (const raw of ev.players) {
                const p = normalizeLineupEntry(raw);
                if (p.playerId && p.photo) photoByPlayerId[p.playerId] = p.photo;
                if (p.name && p.photo) photoByName[p.name] = p.photo;
            }
        }

        for (const ev of events) {
            if (!isValidEvent(ev) || isDeletedEvent(ev)) continue;
            const isGoal = ev.type === "goal" && !ev.ownGoal;
            const isScoredPenalty = ev.type === "penalty" && ev.scored;
            if (!isGoal && !isScoredPenalty) continue;

            // Un gol sin jugador asignado es válido (el árbitro puede dejarlo en blanco),
            // pero no tiene a quién acreditarse, así que no entra en la tabla.
            const name = ev.player;
            if (!name) continue;

            const teamId = teamIdFor(ev.team);
            const key = scorerKey(ev.playerId, teamId, name);
            if (!byKey[key]) {
                byKey[key] = {
                    key: key,
                    name: name,
                    playerId: ev.playerId || null,
                    teamId: teamId || null,
                    photo: (ev.playerId && photoByPlayerId[ev.playerId]) || photoByName[name] || null,
                    goals: 0,
                };
            }
            byKey[key].goals += 1;
        }
    }

    // Más goles primero; a igualdad, orden alfabético para que la tabla sea estable
    // entre recargas en vez de depender del orden en que se recorrieron los partidos.
    return Object.keys(byKey)
        .map((k) => byKey[k])
        .sort((a, b) => (b.goals - a.goals) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------------
// Fusión de bitácoras concurrentes (lost update)
//
// La sesión de arbitraje es compartida: varias personas con el mismo código escriben
// sobre el MISMO match_reports.events. Antes cada push guardaba el arreglo completo
// del cliente tal cual, así que dos árbitros simultáneos se pisaban: A registraba un
// gol, B —que todavía no había sincronizado, el poll es cada 10 s— mandaba su propio
// arreglo sin ese gol y lo borraba en silencio, sin error para nadie.
//
// Es exactamente el mismo lost update que ladders.pb.js ya había resuelto para
// `confirmations` fusionando contra el estado persistido en vez de confiar en el blob
// del cliente. Acá se hace lo mismo, pero con fusión de TRES vías porque además hay
// que poder distinguir "este evento todavía no lo conozco" de "este evento lo borré a
// propósito" — la bitácora admite eliminar un evento puntual sacándolo del arreglo.
// Ver auditoria-2026-08-19.md §4.1.
// ---------------------------------------------------------------------------------

// Identidad estable de un evento. Los eventos nuevos traen `id` generado en el
// cliente al crearlos; los guardados antes de este cambio no tienen ninguno, así que
// se les deriva una clave del contenido: `at` es un ISO con milisegundos tomado en el
// instante del click, por lo que tipo+at no colisiona en la práctica dentro de un
// mismo partido.
function eventKey(ev) {
    if (ev && typeof ev.id === "string" && ev.id) return ev.id;
    return "legacy:" + String((ev && ev.type) || "") + "@" + String((ev && ev.at) || "");
}

// Fusión de tres vías entre lo que hay guardado y lo que manda un cliente.
//
// - `stored`   : la bitácora persistida ahora mismo (incluye lo que subieron otros).
// - `incoming` : la bitácora completa del cliente que está escribiendo.
// - `baseKeys` : las claves que ese cliente tenía cuando empezó a editar, es decir el
//                estado del servidor que él vio por última vez. Es lo que permite leer
//                una ausencia como borrado deliberado y no como desconocimiento.
//
// Sin `baseKeys` (cliente viejo que todavía no manda el campo) la fusión degrada a
// unión pura: nunca pierde eventos, pero tampoco propaga borrados. Es el lado seguro.
function mergeEvents(stored, incoming, baseKeys) {
    const storedList = Array.isArray(stored) ? stored : [];
    const incomingList = Array.isArray(incoming) ? incoming : [];
    const knownBase = Array.isArray(baseKeys) ? baseKeys : null;

    const incomingKeys = {};
    for (const ev of incomingList) incomingKeys[eventKey(ev)] = true;

    // Borrado deliberado = estaba en la base sobre la que este cliente editó, y ya no
    // lo manda. Un evento que subió otra persona después de esa base no está en
    // `baseKeys`, así que jamás se interpreta como borrado.
    const deleted = {};
    if (knownBase) {
        for (const key of knownBase) {
            if (!incomingKeys[key]) deleted[key] = true;
        }
    }

    const byKey = {};
    const order = [];
    function put(ev) {
        const key = eventKey(ev);
        if (deleted[key]) return;
        if (!Object.prototype.hasOwnProperty.call(byKey, key)) order.push(key);
        // El último gana: `incoming` se aplica después que `stored`, así que una
        // edición del cliente sobre un evento que ya existía sí se conserva.
        byKey[key] = ev;
    }
    for (const ev of storedList) put(ev);
    for (const ev of incomingList) put(ev);

    // Orden cronológico real por `at` — es lo que reconstruye una secuencia coherente
    // cuando dos árbitros escribieron en paralelo. Estable respecto al orden de
    // inserción para eventos con el mismo timestamp o sin `at`.
    return order
        .map((key, idx) => ({ ev: byKey[key], idx: idx }))
        .sort((a, b) => {
            const ta = Date.parse((a.ev && a.ev.at) || "") || 0;
            const tb = Date.parse((b.ev && b.ev.at) || "") || 0;
            if (ta !== tb) return ta - tb;
            return a.idx - b.idx;
        })
        .map((x) => x.ev);
}

// ---------------------------------------------------------------------------------
// ¿Quién puede escribir sobre el informe de un partido?
//
//  - 'confirmed' (en juego): basta el código del partido. Es justo lo que se reparte
//    en cancha entre quienes van a arbitrar, y es el diseño querido.
//  - 'played' (resultado oficial): solo la cuenta de la liga dueña del partido. Antes
//    el código seguía sirviendo para siempre, así que cualquiera que lo hubiera tenido
//    alguna vez podía reescribir el marcador de un partido cerrado semanas atrás.
//  - cualquier otro estado: nadie.
//
// Devuelve { ok, isAmend, error, reason } en vez de lanzar, para que este módulo siga
// siendo puro (sin BadRequestError ni nada del runtime de PocketBase) y testeable con
// Node. Va acá y no en el .pb.js porque PocketBase ejecuta cada routerAdd en una VM
// aislada: una función declarada en el scope del módulo NO es visible dentro del
// handler (verificado: "assertMatchWritable is not defined"). Lo único que cruza esa
// frontera es un require() hecho dentro del propio handler.
// `reason` es la versión máquina-legible de `error` — el cliente la usa para decidir
// si conviene reintentar solo (nunca, para ninguno de estos casos: todos son rechazos
// estructurales, no cortes de red transitorios) o si además hay que avisarle al usuario
// que algo pendiente en su dispositivo no se va a guardar solo (`amend_forbidden`, el
// caso de un árbitro que reconecta después de que el partido se cerró por otra vía).
// Ver auditoria-2026-08-19.md §4.4.
// ---------------------------------------------------------------------------------
function matchWriteDecision(status, matchLeagueId, matchCode, authId, providedCode) {
    if (status !== "confirmed" && status !== "played") {
        return { ok: false, isAmend: false, error: "Este partido ya no se puede arbitrar.", reason: "not_arbitrable" };
    }

    const isAmend = status === "played";
    if (isAmend) {
        if (matchLeagueId !== authId) {
            return {
                ok: false,
                isAmend: true,
                error: "Este partido ya está finalizado. Solo la liga organizadora puede corregir el informe.",
                reason: "amend_forbidden",
            };
        }
        return { ok: true, isAmend: true, error: "", reason: null };
    }

    if (matchCode !== providedCode) {
        return { ok: false, isAmend: false, error: "Código incorrecto.", reason: "bad_code" };
    }
    return { ok: true, isAmend: false, error: "", reason: null };
}

// 6 caracteres, mayúsculas + dígitos, sin O/0/I/1 (fáciles de confundir al
// transcribirlos de palabra) — el código que un grupo de árbitros se pasa entre sí
// para poder escribir en la misma sesión de arbitraje.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

module.exports = {
    EVENT_TYPES,
    CLOCK_GATED_TYPES,
    CODE_ALPHABET,
    CODE_LENGTH,
    isValidEvent,
    isClockGatedSequenceValid,
    summarizeEvents,
    normalizeLineupEntry,
    eventKey,
    mergeEvents,
    matchWriteDecision,
    computeTopScorers,
    isDeletedEvent,
};
