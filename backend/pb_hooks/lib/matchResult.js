// Lógica pura del link de un solo uso para registrar el resultado de un partido DESPUÉS
// de jugado — reemplaza al arbitraje en vivo (match_arbitration.pb.js, que queda
// archivado sin cambios) como forma normal de cerrar un partido. La liga genera el link
// y se lo manda al árbitro; el árbitro lo abre sin sesión, carga el resultado una vez, y
// el link queda muerto. Mismo patrón que registrationToken/tokenExpiresAt en `users`
// (ver auth.pb.js) — un token largo + una fecha de vencimiento en el propio partido, sin
// colección aparte.
//
// Sin $app — testeado en __tests__/matchResult.test.js. Ver la nota de cabecera de
// match_arbitration.pb.js: esta función vive acá porque PocketBase corre cada routerAdd
// en una VM aislada y una función del scope del módulo no cruza a los handlers.

// Nunca se tipea a mano (se copia/pega o se abre desde WhatsApp), así que no hace falta
// que sea corto ni fácil de transcribir como el código de 6 caracteres del arbitraje en
// vivo — más largo, mejor.
const TOKEN_LENGTH = 24;

// Generoso a propósito: entre que la liga manda el link y el árbitro se acuerda de
// completarlo puede pasar bastante más que unos días.
const TOKEN_TTL_DAYS = 30;

// { resultToken, resultTokenExpiresAt } son los campos del propio league_matches;
// `providedToken` es el que viene en la URL. Devuelve { ok, error } en vez de lanzar,
// mismo criterio que matchWriteDecision en lib/matchEvents.js.
function resultTokenDecision(match, providedToken) {
    const token = String((match && match.resultToken) || "");
    const provided = String(providedToken || "");

    if (!token || !provided) {
        return { ok: false, error: "Este enlace no existe o ya se usó." };
    }
    if (token !== provided) {
        return { ok: false, error: "Este enlace no existe o ya se usó." };
    }

    const expiresAtRaw = (match && match.resultTokenExpiresAt) || "";
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    if (!expiresAt || isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
        return { ok: false, error: "Este enlace venció. Pídele uno nuevo a la liga." };
    }

    return { ok: true, error: "" };
}

// Autorización del flujo IN-APP (POST /api/league-matches/team-result): a diferencia
// del link de un solo uso, acá no hay token — la propia sesión ya prueba quién es. Basta
// con que la cuenta autenticada esté entre los `refereeTeams` que la liga le asignó a
// ESTE partido (hasta 2, ver 1788000000_add_referee_teams_and_difficulty_to_league.js) y
// que el partido siga admitiendo un resultado. 'confirmed' es la primera y única
// carga; un 'played' necesita que la liga haya habilitado explícitamente UNA corrección
// compartida (refereeResultReopen). El handler repite esta decisión DENTRO de su
// transacción: así dos equipos árbitro no pueden gastar esa misma habilitación a la vez.
// `match` es un objeto plano, nunca un Record.
function teamRefereeDecision(match, teamId) {
    const refereeTeams = Array.isArray(match && match.refereeTeams) ? match.refereeTeams : [];
    if (!teamId || !refereeTeams.includes(teamId)) {
        return { ok: false, error: "Tu equipo no está asignado a arbitrar este partido." };
    }

    const status = (match && match.status) || "";
    if (status === "confirmed") return { ok: true, error: "" };
    if (status === "played" && match && match.refereeResultReopen === true) return { ok: true, error: "" };

    return { ok: false, error: "El resultado ya está bloqueado. Pídele a la liga que habilite una corrección." };
}

// Los JSONField opcionales de PocketBase parten como `null` (no como "[]"). Al
// agregar la primera entrada no basta con que JSON.parse no lance: JSON.parse("null")
// devuelve null de forma válida, pero no admite push(). Esta función deja el historial
// siempre como arreglo y conserva solo un valor previo que realmente lo sea.
function appendRefereeTeamLog(rawLog, teamId, at) {
    let log = [];
    try {
        const parsed = JSON.parse(rawLog || "[]");
        if (Array.isArray(parsed)) log = parsed;
    } catch (err) {
        log = [];
    }
    log.push({ team: teamId, at });
    return log;
}

module.exports = {
    TOKEN_LENGTH,
    TOKEN_TTL_DAYS,
    resultTokenDecision,
    teamRefereeDecision,
    appendRefereeTeamLog,
};
