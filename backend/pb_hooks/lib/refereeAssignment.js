// Lógica pura de asignación automática de árbitros: entre los candidatos posibles
// (equipos de la etapa que no son ninguno de los dos que juegan), elige los que MENOS
// partidos han arbitrado hasta ahora — el objetivo es repartir la carga, no premiar a
// nadie. `countByTeam` ya viene calculado por el caller (con $app, contando
// league_matches con status != 'cancelled' — ver league.pb.js) porque este módulo no
// toca la base. Sin $app — testeado en __tests__/refereeAssignment.test.js.
function pickLeastBusyReferees(candidateTeamIds, countByTeam, excludeTeamIds) {
    const excluded = new Set((excludeTeamIds || []).map(String));
    const counts = countByTeam || {};
    const pool = (candidateTeamIds || []).map(String).filter((id) => !excluded.has(id));
    return [...pool].sort((a, b) => (counts[a] || 0) - (counts[b] || 0)).slice(0, 2);
}

module.exports = { pickLeastBusyReferees };
