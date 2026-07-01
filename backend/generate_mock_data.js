const BACKEND_URL = 'https://beauchap.daridius.cl';
const ADMIN_EMAIL = 'admin@ug.uchile.cl';
const ADMIN_PASS = 'password123';

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
    throw new Error(`Request to ${path} failed: ${response.status} - ${text}`);
  }
  
  if (response.status === 204) return null;
  return response.json();
}

async function main() {
  try {
    console.log('Autenticando como superadmin...');
    const authData = await request('/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
    });
    const authHeader = { 'Authorization': authData.token };

    // Limpiar predicciones, partidos y pollas
    console.log('Limpiando base de datos...');
    const clearCollection = async (name) => {
      const res = await request(`/api/collections/${name}/records?perPage=500`, { headers: authHeader });
      for (const item of res.items) {
        await request(`/api/collections/${name}/records/${item.id}`, { method: 'DELETE', headers: authHeader });
      }
    };
    await clearCollection('predictions');
    await clearCollection('matches');
    await clearCollection('contests');
    
    // Eliminar usuarios excepto el superadmin (ug.uchile.cl no es un registro en 'users', es de system admins, 
    // pero veamos si hay en 'users' que no queremos borrar. Borraremos todos los 'users' normales).
    const usersRes = await request('/api/collections/users/records?perPage=500', { headers: authHeader });
    for (const u of usersRes.items) {
      await request(`/api/collections/users/records/${u.id}`, { method: 'DELETE', headers: authHeader });
    }

    console.log('Creando 10 usuarios genéricos...');
    const createdUsers = [];
    for (let i = 1; i <= 10; i++) {
      const userBody = {
        username: `usuario${i}`,
        email: `usuario${i}@test.com`,
        emailVisibility: true,
        password: 'password123',
        passwordConfirm: 'password123',
        name: i === 1 ? 'Admin Polla' : `Jugador ${i}`
      };
      const u = await request('/api/collections/users/records', { method: 'POST', headers: authHeader, body: JSON.stringify(userBody) });
      createdUsers.push(u);
    }

    const adminPolla = createdUsers[0];

    console.log('Creando polla...');
    const polla = await request('/api/collections/contests/records', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ name: 'Polla Mundialera', type: 'polla', active: true, admin: adminPolla.id })
    });

    console.log('Creando 4 partidos (2 jugados, 2 futuros)...');
    const now = new Date();
    
    const futureDate1 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 dias
    const futureDate2 = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000); // 8 dias
    
    const pastDate1 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // -2 dias
    const pastDate2 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // -1 dias

    const matchesData = [
      { homeTeam: 'Brasil', awayTeam: 'Argentina', homeFlag: '🇧🇷', awayFlag: '🇦🇷', date: pastDate1.toISOString(), played: true, active: true, stage: 'Octavos de Final', contest: polla.id, homeScore: 2, awayScore: 1 },
      { homeTeam: 'Chile', awayTeam: 'Perú', homeFlag: '🇨🇱', awayFlag: '🇵🇪', date: pastDate2.toISOString(), played: true, active: true, stage: 'Octavos de Final', contest: polla.id, homeScore: 3, awayScore: 0 },
      { homeTeam: 'Francia', awayTeam: 'Inglaterra', homeFlag: '🇫🇷', awayFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', date: futureDate1.toISOString(), played: false, active: true, stage: 'Octavos de Final', contest: polla.id },
      { homeTeam: 'Alemania', awayTeam: 'España', homeFlag: '🇩🇪', awayFlag: '🇪🇸', date: futureDate2.toISOString(), played: false, active: true, stage: 'Octavos de Final', contest: polla.id },
    ];

    const createdMatches = [];
    for (const m of matchesData) {
      const match = await request('/api/collections/matches/records', { method: 'POST', headers: authHeader, body: JSON.stringify(m) });
      createdMatches.push(match);
    }

    console.log('Añadiendo predicciones para 2 usuarios...');
    // Usuario 2 y Usuario 3 (indices 1 y 2 en el array)
    for (let uIdx = 1; uIdx <= 2; uIdx++) {
      const user = createdUsers[uIdx];
      for (const m of createdMatches) {
        // Predicciones aleatorias
        const hScore = Math.floor(Math.random() * 4);
        const aScore = Math.floor(Math.random() * 4);
        await request('/api/collections/predictions/records', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            user: user.id,
            match: m.id,
            homeScore: hScore,
            awayScore: aScore
          })
        });
      }
    }

    console.log('¡Base de datos inicializada exitosamente en el homeserver!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
