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

function schemasAreEqual(colA, colB) {
  // Comparar reglas de acceso
  if (colA.listRule !== colB.listRule || 
      colA.viewRule !== colB.viewRule || 
      colA.createRule !== colB.createRule || 
      colA.updateRule !== colB.updateRule || 
      colA.deleteRule !== colB.deleteRule) {
    return false;
  }
  
  // Comparar campos del esquema
  for (const fieldB of colB.schema) {
    const fieldA = colA.schema.find(f => f.name === fieldB.name);
    if (!fieldA) return false;
    if (fieldA.type !== fieldB.type) return false;
    if (fieldA.required !== fieldB.required) return false;
  }
  
  return true;
}

async function main() {
  try {
    console.log('Autenticando como administrador (vía REST API)...');
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new Error('Debes proveer ADMIN_EMAIL y ADMIN_PASSWORD como variables de entorno.');
    }
    const authData = await request('/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({
        identity: adminEmail,
        password: adminPassword,
      }),
    });
    
    const token = authData.token;
    console.log('Autenticación exitosa.');
    
    const authHeader = { 'Authorization': token };

    // Obtener colecciones existentes
    console.log('Obteniendo colecciones actuales...');
    let collectionsRes = await request('/api/collections?perPage=100', { headers: authHeader });
    let existingCollections = collectionsRes.items || [];

    // Colecciones ya existen gracias a las migraciones.
    // Solo necesitamos buscar sus IDs para usarlas.
    const usersCol = existingCollections.find(c => c.name === 'users');
    const usersId = usersCol ? usersCol.id : 'users';

    const contestsCol = existingCollections.find(c => c.name === 'contests');
    const contestsId = contestsCol ? contestsCol.id : 'contests';

    const matchesCol = existingCollections.find(c => c.name === 'matches');
    const matchesId = matchesCol ? matchesCol.id : 'matches';

    // 4. Buscar usuario 'test' para hacerlo Superadmin y Admin del concurso
    console.log('Buscando usuario "test@ing.uchile.cl"...');
    const usersList = await request(`/api/collections/users/records?filter=email="test@ing.uchile.cl"`, { headers: authHeader });
    let testUser = null;
    
    if (usersList.items && usersList.items.length > 0) {
      testUser = usersList.items[0];
      console.log('Usuario "test" encontrado. Asignando rol de admin...');
      testUser = await request(`/api/collections/users/records/${testUser.id}`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ verified: true })
      });
      console.log('Usuario "test" verificado.');
    } else {
      console.log('Usuario "test@ing.uchile.cl" no existe en la base de datos.');
    }

    // 5. Obtener/Crear el concurso "Polla Mundialera"
    console.log('Buscando concurso "Polla Mundialera"...');
    const contestsList = await request(`/api/collections/contests/records?filter=name="Polla Mundialera"`, { headers: authHeader });
    let contest;
    
    const initialContestData = {
      name: 'Polla Mundialera',
      type: 'polla',
      description: 'Predice los marcadores del Mundial y compite con tus compañeros de Beauchef.',
      active: true,
      admins: testUser ? [testUser.id] : []
    };

    if (contestsList.items && contestsList.items.length > 0) {
      contest = contestsList.items[0];
      console.log('El concurso "Polla Mundialera" ya existe. Actualizando administradores...');
      const currentAdmins = contest.admins || [];
      if (testUser && !currentAdmins.includes(testUser.id)) {
        currentAdmins.push(testUser.id);
      }
      contest = await request(`/api/collections/contests/records/${contest.id}`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ admins: currentAdmins })
      });
      console.log('Administradores del concurso actualizados.');
    } else {
      contest = await request('/api/collections/contests/records', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify(initialContestData)
      });
      console.log('Concurso "Polla Mundialera" creado con ID:', contest.id);
    }

    // 6. Sembrar partidos (algunos pasados, algunos futuros)
    console.log('Sembrando partidos para la Polla Mundialera...');
    const matchesToSeed = [
      { homeTeam: 'Países Bajos', homeFlag: '🇳🇱', awayTeam: 'Estados Unidos', awayFlag: '🇺🇸', stage: 'Octavos de Final', date: '2026-06-25T16:00:00Z', played: true, homeScore: 3, awayScore: 1 },
      { homeTeam: 'Argentina', homeFlag: '🇦🇷', awayTeam: 'Australia', awayFlag: '🇦🇺', stage: 'Octavos de Final', date: '2026-06-25T20:00:00Z', played: true, homeScore: 2, awayScore: 1 },
      { homeTeam: 'Francia', homeFlag: '🇫🇷', awayTeam: 'Polonia', awayFlag: '🇵🇱', stage: 'Octavos de Final', date: '2026-06-26T16:00:00Z', played: true, homeScore: 3, awayScore: 1 },
      { homeTeam: 'Inglaterra', homeFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', awayTeam: 'Senegal', awayFlag: '🇸🇳', stage: 'Octavos de Final', date: '2026-11-21T20:00:00Z', played: false, homeScore: null, awayScore: null },
      { homeTeam: 'Japón', homeFlag: '🇯🇵', awayTeam: 'Croacia', awayFlag: '🇭🇷', stage: 'Octavos de Final', date: '2026-11-22T16:00:00Z', played: false, homeScore: null, awayScore: null },
      { homeTeam: 'Brasil', homeFlag: '🇧🇷', awayTeam: 'Corea del Sur', awayFlag: '🇰🇷', stage: 'Octavos de Final', date: '2026-11-22T20:00:00Z', played: false, homeScore: null, awayScore: null },
      { homeTeam: 'Marruecos', homeFlag: '🇲🇦', awayTeam: 'España', awayFlag: '🇪🇸', stage: 'Octavos de Final', date: '2026-11-23T16:00:00Z', played: false, homeScore: null, awayScore: null },
      { homeTeam: 'Portugal', homeFlag: '🇵🇹', awayTeam: 'Suiza', awayFlag: '🇨🇭', stage: 'Octavos de Final', date: '2026-11-23T20:00:00Z', played: false, homeScore: null, awayScore: null }
    ];

    const seededMatches = [];
    for (const m of matchesToSeed) {
      const matchFilter = `contest="${contest.id}" && homeTeam="${m.homeTeam}" && awayTeam="${m.awayTeam}"`;
      const matchesList = await request(`/api/collections/matches/records?filter=${encodeURIComponent(matchFilter)}`, { headers: authHeader });
      
      let matchRecord;
      if (matchesList.items && matchesList.items.length > 0) {
        matchRecord = matchesList.items[0];
        // Ensure active is set to true for existing seeded matches
        await request(`/api/collections/matches/records/${matchRecord.id}`, {
          method: 'PATCH',
          headers: authHeader,
          body: JSON.stringify({ active: true })
        });
        console.log(`El partido ${m.homeTeam} vs ${m.awayTeam} ya existe. Actualizado active=true.`);
      } else {
        matchRecord = await request('/api/collections/matches/records', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            contest: contest.id,
            homeTeam: m.homeTeam,
            homeFlag: m.homeFlag,
            awayTeam: m.awayTeam,
            awayFlag: m.awayFlag,
            stage: m.stage,
            date: m.date,
            active: true,
            played: m.played,
            homeScore: m.homeScore,
            awayScore: m.awayScore
          })
        });
        console.log(`Partido ${m.homeTeam} vs ${m.awayTeam} creado.`);
      }
      seededMatches.push(matchRecord);
    }

    // 7. Sembrar 6 usuarios genéricos de prueba si no existen
    console.log('Sembrando 6 usuarios de prueba...');
    const testUsersToSeed = [
      { email: 'juan.perez@ing.uchile.cl', name: 'Juan Pérez' },
      { email: 'sofia.gomez@ing.uchile.cl', name: 'Sofía Gómez' },
      { email: 'diego.soto@ing.uchile.cl', name: 'Diego Soto' },
      { email: 'camila.silva@ing.uchile.cl', name: 'Camila Silva' },
      { email: 'lucas.munoz@ing.uchile.cl', name: 'Lucas Muñoz' },
      { email: 'valentina.rojas@ing.uchile.cl', name: 'Valentina Rojas' }
    ];

    const seededUsers = [];
    for (const u of testUsersToSeed) {
      let userRecord;
      try {
        const res = await request(`/api/collections/users/records?filter=email="${u.email}"`, { headers: authHeader });
        if (res.items && res.items.length > 0) {
          userRecord = res.items[0];
          console.log(`Usuario de prueba ${u.email} ya existe.`);
        } else {
          const username = u.email.split('@')[0] + Math.floor(Math.random() * 100);
          userRecord = await request('/api/collections/users/records', {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({
              username: username,
              email: u.email,
              emailVisibility: false,
              password: 'password123',
              passwordConfirm: 'password123',
              name: u.name,
              verified: true // By-pass email verification for tests
            })
          });
          console.log(`Usuario de prueba ${u.name} creado.`);
        }
        seededUsers.push(userRecord);
      } catch (err) {
        console.error(`Error al sembrar usuario ${u.email}:`, err);
      }
    }

    // 8. Sembrar predicciones aleatorias para estos 6 usuarios
    console.log('Sembrando predicciones aleatorias para usuarios de prueba...');
    for (const u of seededUsers) {
      for (const m of seededMatches) {
        const predFilter = `user="${u.id}" && match="${m.id}"`;
        const predList = await request(`/api/collections/predictions/records?filter=${encodeURIComponent(predFilter)}`, { headers: authHeader });
        
        if (predList.items && predList.items.length > 0) {
          console.log(`Predicción de ${u.name} para partido ${m.homeTeam} vs ${m.awayTeam} ya existe.`);
        } else {
          const homeScore = Math.floor(Math.random() * 4); // 0 a 3 goles
          const awayScore = Math.floor(Math.random() * 4);
          
          await request('/api/collections/predictions/records', {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({
              user: u.id,
              match: m.id,
              homeScore,
              awayScore,
              points: 0 // Valor inicial
            })
          });
          console.log(`Predicción creada para ${u.name} (${homeScore}-${awayScore}) en ${m.homeTeam} vs ${m.awayTeam}.`);
        }
      }
    }

    console.log('Semilla completada exitosamente.');
  } catch (err) {
    console.error('Error durante la ejecución de la semilla:', err);
    process.exit(1);
  }
}

main();
