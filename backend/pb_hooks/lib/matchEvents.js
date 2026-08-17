// Lógica pura del arbitraje de partidos de liga: el marcador, tarjetas y convocatoria
// NUNCA se guardan sueltos — siempre se derivan de `events`, la bitácora completa y
// ordenada de todo lo que pasó. Esto es lo que hace "eliminar un evento puntual"
// trivial (sacar ese elemento del arreglo) y el arbitraje resiliente (el arreglo
// completo es la única fuente de verdad, se puede reconstruir todo desde cero con
// solo tenerlo). La sesión de arbitraje es compartida — cualquiera con el código del
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

function isValidEvent(ev) {
    if (!ev || typeof ev !== "object") return false;
    if (!EVENT_TYPES.includes(ev.type)) return false;
    if (ev.type === "lineup") {
        return (ev.team === "A" || ev.team === "B") && Array.isArray(ev.players);
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
            typeof ev.player === "string" &&
            ev.player.length > 0 &&
            typeof ev.ownGoal === "boolean"
        );
    }
    if (ev.type === "yellow_card" || ev.type === "red_card") {
        return (ev.team === "A" || ev.team === "B") && typeof ev.player === "string" && ev.player.length > 0;
    }
    if (ev.type === "penalty") {
        return (
            (ev.team === "A" || ev.team === "B") &&
            typeof ev.player === "string" &&
            ev.player.length > 0 &&
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
        if (!isValidEvent(ev)) continue;
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
        if (!isValidEvent(ev)) continue;

        if (ev.type === "lineup") {
            if (ev.team === "A") lineupA = ev.players;
            else lineupB = ev.players;
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
};
