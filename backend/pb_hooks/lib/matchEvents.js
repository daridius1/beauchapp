// Lógica pura del arbitraje de partidos de liga: el marcador, tarjetas y convocatoria
// NUNCA se guardan sueltos — siempre se derivan de `events`, la bitácora completa y
// ordenada de todo lo que hizo el árbitro. Esto es lo que hace "deshacer última
// acción" trivial (sacar el último elemento del arreglo) y el arbitraje resiliente
// (el arreglo completo es la única fuente de verdad, se puede reconstruir todo desde
// cero con solo tenerlo). Sin $app — testeado en __tests__/matchEvents.test.js.

const EVENT_TYPES = [
    "lineup",
    "half_start",
    "half_end",
    "goal",
    "yellow_card",
    "red_card",
    "penalty",
];

function isValidEvent(ev) {
    if (!ev || typeof ev !== "object") return false;
    if (!EVENT_TYPES.includes(ev.type)) return false;
    if (ev.type === "lineup") {
        return (ev.team === "A" || ev.team === "B") && Array.isArray(ev.players);
    }
    if (ev.type === "half_start" || ev.type === "half_end") {
        return ev.half === 1 || ev.half === 2;
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

    for (const ev of list) {
        if (!isValidEvent(ev)) continue;

        if (ev.type === "lineup") {
            if (ev.team === "A") lineupA = ev.players;
            else lineupB = ev.players;
        } else if (ev.type === "half_start") {
            halfStarted[ev.half] = true;
            currentHalf = ev.half;
        } else if (ev.type === "half_end") {
            halfEnded[ev.half] = true;
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
    };
}

module.exports = {
    EVENT_TYPES,
    isValidEvent,
    summarizeEvents,
};
