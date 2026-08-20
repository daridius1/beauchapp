// Lógica pura de la Beaupolla: puntaje de una apuesta, momento de cierre y tabla de
// posiciones. Sin `$app` — testeado en __tests__/polla.test.js.
//
// La apuesta es una sola cosa: quién gana. `home` = local (equipo A), `away` = visita
// (equipo B), `draw` = empate.

const PICKS = ["home", "draw", "away"];

// Acertar el empate vale el doble que acertar un ganador: es el resultado más difícil
// de predecir y el que menos gente marca, así que arriesgarlo tiene premio.
const POINTS_WINNER = 1;
const POINTS_DRAW = 2;

// Minutos antes de la hora agendada en que se cierran las apuestas de un partido.
const CLOSE_MINUTES_BEFORE = 10;

function isValidPick(pick) {
    return PICKS.includes(pick);
}

// El resultado real de un partido, en el mismo vocabulario que la apuesta.
function outcomeOf(scoreA, scoreB) {
    const a = Number(scoreA) || 0;
    const b = Number(scoreB) || 0;
    if (a > b) return "home";
    if (b > a) return "away";
    return "draw";
}

// Puntos que da UNA apuesta contra un resultado ya oficial.
function pickPoints(pick, scoreA, scoreB) {
    if (!isValidPick(pick)) return 0;
    const outcome = outcomeOf(scoreA, scoreB);
    if (pick !== outcome) return 0;
    return outcome === "draw" ? POINTS_DRAW : POINTS_WINNER;
}

// Instante de cierre por horario: la hora del bloque menos CLOSE_MINUTES_BEFORE.
// `blockCode` es "YYYY-MM-DD-HH" (ver lib/teamSchedule.js). Devuelve un ISO, o null si
// el código no tiene forma válida — un partido sin bloque legible nunca cierra por
// horario, solo puede cerrarlo el arranque real en la vista de arbitraje.
function bettingCloseTimeFromBlock(blockCode) {
    const code = String(blockCode || "");
    if (code.length < 13) return null;
    const hour = Number(code.slice(-2));
    const parts = code.slice(0, -3).split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n)) || !Number.isFinite(hour)) {
        return null;
    }
    const start = new Date(parts[0], parts[1] - 1, parts[2], hour, 0, 0, 0);
    if (isNaN(start.getTime())) return null;
    return new Date(start.getTime() - CLOSE_MINUTES_BEFORE * 60 * 1000).toISOString();
}

// ¿Ya se cerraron las apuestas de este partido? Un partido sin fecha de cierre se trata
// como CERRADO: es el lado seguro — ante la duda no se aceptan apuestas nuevas ni se
// filtra lo que ya apostó el resto, en vez de dejar una ventana abierta por un dato
// faltante.
function isBettingClosed(bettingClosesAt, nowMs) {
    if (!bettingClosesAt) return true;
    const closes = new Date(bettingClosesAt).getTime();
    if (isNaN(closes)) return true;
    return (nowMs === undefined ? Date.now() : nowMs) >= closes;
}

// Tabla de posiciones de la polla.
//
// `matches`: [{ id, status, scoreA, scoreB }] — solo los 'played' puntúan; un partido
// en curso todavía puede cambiar de resultado.
// `bets`: [{ user, match, pick }]
// `usersById` (opcional): datos para mostrar, se copian tal cual a cada fila.
//
// Devuelve una fila por persona que haya apostado al menos una vez, ordenada por
// puntos, luego por aciertos, luego alfabéticamente para que el orden sea estable
// entre recargas y no dependa del orden en que vinieron las filas.
function computePollaLeaderboard(matches, bets, usersById) {
    const matchById = {};
    (Array.isArray(matches) ? matches : []).forEach((m) => {
        if (m && m.id) matchById[m.id] = m;
    });

    const byUser = {};
    (Array.isArray(bets) ? bets : []).forEach((bet) => {
        if (!bet || !bet.user) return;
        if (!byUser[bet.user]) {
            const info = (usersById && usersById[bet.user]) || {};
            byUser[bet.user] = {
                userId: bet.user,
                name: info.name || info.username || "",
                username: info.username || "",
                avatar: info.avatar || null,
                points: 0,
                hits: 0,
                bets: 0,
                resolved: 0,
            };
        }
        const row = byUser[bet.user];
        row.bets += 1;

        const match = matchById[bet.match];
        if (!match || match.status !== "played") return;

        row.resolved += 1;
        const points = pickPoints(bet.pick, match.scoreA, match.scoreB);
        if (points > 0) {
            row.points += points;
            row.hits += 1;
        }
    });

    return Object.keys(byUser)
        .map((k) => byUser[k])
        .sort((a, b) =>
            (b.points - a.points) ||
            (b.hits - a.hits) ||
            String(a.name || a.username).localeCompare(String(b.name || b.username))
        );
}


// ---------------------------------------------------------------------------------
// Estado visual de cada botón de una tarjeta de partido.
//
// Es lógica de presentación, pero vive acá —y no solo en el .ts del frontend— porque es
// una máquina de estados con seis casos que tienen que quedar DISTINGUIBLES entre sí
// solo con color. El caso que motivó esto: "aposté y fallé" y "no aposté" se veían
// idénticos, así que no había forma de saber si uno había jugado ese partido.
//
// Los seis casos, y qué los separa:
//
//   partido abierto o cerrado sin resultado
//     'mine'    → es mi apuesta (borde blanco). Todavía secreta para el resto.
//     'neutral' → no es mi apuesta, el partido sigue abierto.
//     'dim'     → no es mi apuesta y ya cerró: apagado, no hay nada que decidir.
//
//   partido ya jugado
//     'hit'     → mi apuesta Y el resultado: VERDE LLENO. Acerté.
//     'miss'    → mi apuesta pero NO el resultado: ROJO. Fallé.
//     'result'  → el resultado, que yo no aposté: verde SOLO borde, más tenue.
//     'dim'     → ni mi apuesta ni el resultado.
//
// La diferencia entre "fallé" y "no aposté" es que en el primero hay un botón ROJO;
// entre "acerté" y "no aposté", que el verde es lleno en vez de solo borde.
function pickVisual(pick, myPick, result, closed) {
    const isMine = !!myPick && pick === myPick;
    const isResult = !!result && pick === result;

    // Sin resultado todavía: solo importa si es mi apuesta.
    if (!result) {
        if (isMine) return "mine";
        return closed ? "dim" : "neutral";
    }

    if (isMine && isResult) return "hit";
    if (isMine) return "miss";
    if (isResult) return "result";
    return "dim";
}

// Cómo se pinta el BORDE de la tarjeta completa, que refuerza lo mismo de un vistazo
// sin tener que leer los tres botones.
function cardOutcome(myPick, result) {
    if (!result) return "none";
    if (!myPick) return "none";
    return pickVisual(myPick, myPick, result, true) === "hit" ? "hit" : "miss";
}

module.exports = {
    PICKS,
    POINTS_WINNER,
    POINTS_DRAW,
    CLOSE_MINUTES_BEFORE,
    isValidPick,
    outcomeOf,
    pickPoints,
    bettingCloseTimeFromBlock,
    isBettingClosed,
    computePollaLeaderboard,
    pickVisual,
    cardOutcome,
};
