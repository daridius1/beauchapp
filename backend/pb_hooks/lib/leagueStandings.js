// Puerto backend, puro y testeable, del mismo algoritmo de tabla de posiciones que ya
// usa frontend/src/components/leagues/LeagueStandingsTable.tsx (pj/pg/pe/pp/gf/gc/dif/
// pts, orden por pts, luego dif, luego gf). Se reescribe acá porque ese componente es
// TypeScript/React y esto necesita correr en el JSVM de PocketBase sin bundler — mismo
// motivo por el que lib/matchEvents.js ya es un port de utils/matchEvents.ts.
//
// Se usa desde news.pb.js (vía require dentro del handler) para darle a la IA la tabla
// de posiciones y la racha reciente de cada equipo al generar una noticia.

/**
 * @param {string[]} teamIds - equipos participantes de la etapa (de league_stages.teams).
 * @param {Array<{teamA, teamB, scoreA, scoreB, status}>} matches - partidos de esa etapa.
 * @returns {Array<{teamId, pj, pg, pe, pp, gf, gc, dif, pts, position}>} ordenado por pts desc, dif desc, gf desc.
 */
function computeStandings(teamIds, matches) {
    const map = {};
    (teamIds || []).forEach((id) => {
        map[id] = { teamId: id, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dif: 0, pts: 0 };
    });

    (matches || []).forEach((m) => {
        if (!m || m.status !== "played") return;
        const scoreA = m.scoreA || 0;
        const scoreB = m.scoreB || 0;
        const a = map[m.teamA];
        const b = map[m.teamB];
        if (a) {
            a.pj += 1;
            a.gf += scoreA;
            a.gc += scoreB;
            if (scoreA > scoreB) { a.pg += 1; a.pts += 3; }
            else if (scoreA === scoreB) { a.pe += 1; a.pts += 1; }
            else a.pp += 1;
        }
        if (b) {
            b.pj += 1;
            b.gf += scoreB;
            b.gc += scoreA;
            if (scoreB > scoreA) { b.pg += 1; b.pts += 3; }
            else if (scoreB === scoreA) { b.pe += 1; b.pts += 1; }
            else b.pp += 1;
        }
    });

    return Object.keys(map)
        .map((id) => {
            const row = map[id];
            row.dif = row.gf - row.gc;
            return row;
        })
        .sort((x, y) => (y.pts - x.pts) || (y.dif - x.dif) || (y.gf - x.gf))
        .map((row, idx) => Object.assign({}, row, { position: idx + 1 }));
}

/**
 * Resultado del último partido JUGADO de `teamId` estrictamente anterior a
 * `beforeBlockCode` (orden lexicográfico = cronológico, mismo criterio que el resto
 * del código de liga). null si es su debut o no hay partidos previos.
 *
 * @param {string} teamId
 * @param {Array<{teamA, teamB, scoreA, scoreB, status, blockCode}>} matches
 * @param {string} beforeBlockCode
 */
function previousResult(teamId, matches, beforeBlockCode) {
    const played = (matches || [])
        .filter((m) => m && m.status === "played" && m.blockCode < beforeBlockCode && (m.teamA === teamId || m.teamB === teamId))
        .sort((a, b) => (a.blockCode < b.blockCode ? 1 : a.blockCode > b.blockCode ? -1 : 0));

    const last = played[0];
    if (!last) return null;

    const isTeamA = last.teamA === teamId;
    const gf = (isTeamA ? last.scoreA : last.scoreB) || 0;
    const gc = (isTeamA ? last.scoreB : last.scoreA) || 0;
    const opponentId = isTeamA ? last.teamB : last.teamA;
    const result = gf > gc ? "win" : gf < gc ? "loss" : "draw";
    return { result, gf, gc, opponentId, blockCode: last.blockCode };
}

module.exports = { computeStandings, previousResult };
