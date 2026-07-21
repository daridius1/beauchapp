const BACKEND_URL = 'http://127.0.0.1:8090';

async function request(path, options = {}) {
  const url = `${BACKEND_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request to ${path} failed with status ${response.status}: ${text}`);
  }
  
  if (response.status === 204) {
    return null;
  }
  
  return response.json();
}

async function main() {
  try {
    console.log('--- TEST INTEGRACIÓN LADDERS & OPENSKILL ---');
    
    // Autenticar superusuario para inspección
    const adminAuth = await request('/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({
        identity: 'betty@beauchapp.cl',
        password: 'password123',
      }),
    }).catch(async () => {
      return await request('/api/collections/_superusers/auth-with-password', {
        method: 'POST',
        body: JSON.stringify({
          identity: 'admin@beauchapp.cl',
          password: 'password123',
        }),
      });
    });

    const adminToken = adminAuth.token;

    // 1. Obtener el ladder de Taca Taca
    const ladders = await request('/api/collections/ladders/records?filter=slug="taca-taca"', {
      headers: { 'Authorization': adminToken }
    });
    if (ladders.items.length === 0) {
      throw new Error('No se encontró el ladder taca-taca');
    }
    const ladder = ladders.items[0];
    console.log('Ladder encontrado:', ladder.name, '(ID:', ladder.id, ')');

    // 2. Obtener 4 usuarios estudiantes para 2v2
    const usersRes = await request('/api/collections/users/records?filter=type!="organization"&perPage=4', {
      headers: { 'Authorization': adminToken }
    });
    if (usersRes.items.length < 4) {
      throw new Error(`Se necesitan al menos 4 usuarios estudiantes en la base de datos (encontrados: ${usersRes.items.length}).`);
    }
    const players = usersRes.items;
    const teamRed = [players[0].id, players[1].id];
    const teamBlue = [players[2].id, players[3].id];
    const arbiterId = players[0].id;

    console.log('\nJugadores asignados:');
    console.log(' - Equipo Rojo:', players[0].name, '&', players[1].name);
    console.log(' - Equipo Azul:', players[2].name, '&', players[3].name);

    // 3. Crear un partido 2v2 arbitrado (Rojo 5 - 3 Azul)
    console.log('\nRegistrando partido 2v2 (Rojo 5 - 3 Azul)...');
    const confirmations = { [players[0].id]: 'accepted' };
    const matchRes = await request('/api/collections/ladder_matches/records', {
      method: 'POST',
      headers: { 'Authorization': adminToken },
      body: JSON.stringify({
        ladder: ladder.id,
        arbiter: arbiterId,
        mode: '2v2',
        team_red: teamRed,
        team_blue: teamBlue,
        score_red: 5,
        score_blue: 3,
        goal_history: JSON.stringify(['red', 'blue', 'red', 'red', 'blue', 'red', 'blue', 'red']),
        status: 'pending_confirmation',
        confirmations: JSON.stringify(confirmations),
      }),
    });
    console.log('Partido registrado con éxito. ID:', matchRes.id, '| Estado inicial:', matchRes.status);

    // 4. Confirmar el partido simulando la respuesta de todos los jugadores
    console.log('\nConfirmando resultado por parte de todos los jugadores...');
    const fullConfirmations = {
      [players[0].id]: 'accepted',
      [players[1].id]: 'accepted',
      [players[2].id]: 'accepted',
      [players[3].id]: 'accepted',
    };

    const updateRes = await request(`/api/collections/ladder_matches/records/${matchRes.id}`, {
      method: 'PATCH',
      headers: { 'Authorization': adminToken },
      body: JSON.stringify({
        confirmations: JSON.stringify(fullConfirmations),
      }),
    });

    console.log('Partido actualizado. Nuevo Estado:', updateRes.status);

    // 5. Verificar posiciones y ratings OpenSkill en ladder_ranks
    console.log('\n--- TABLA DE POSICIONES ACTUALIZADA (OPENSKILL) ---');
    const ranksRes = await request(`/api/collections/ladder_ranks/records?filter=ladder="${ladder.id}"&sort=-ordinal_rating&expand=user`, {
      headers: { 'Authorization': adminToken }
    });
    
    ranksRes.items.forEach((rank, idx) => {
      const uName = rank.expand?.user?.name || rank.user;
      console.log(`${idx + 1}º. ${uName} | Rating ELO: ${Math.round(rank.ordinal_rating)} (mu: ${rank.mu.toFixed(2)}, sigma: ${rank.sigma.toFixed(2)}) | PJ: ${rank.matches_played} (V: ${rank.wins}, D: ${rank.losses})`);
    });

    console.log('\n¡TEST DE LADDERS & OPENSKILL FINALIZADO CON ÉXITO!');
  } catch (err) {
    console.error('Error en el test:', err.message || err);
  }
}

main();
