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
    const authData = await request('/api/admins/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({
        identity: 'admin@ug.uchile.cl',
        password: 'password123',
      }),
    });
    
    const token = authData.token;
    console.log('Autenticación exitosa.');
    
    const authHeader = { 'Authorization': token };

    // Obtener colecciones existentes
    console.log('Obteniendo colecciones actuales...');
    let collectionsRes = await request('/api/collections?perPage=100', { headers: authHeader });
    let existingCollections = collectionsRes.items || [];

    // 0. Agregar campo 'isSuperadmin' y actualizar reglas de lectura en la colección 'users'
    const usersCol = existingCollections.find(c => c.name === 'users');
    const usersId = usersCol ? usersCol.id : 'users';
    
    if (usersCol) {
      let changed = false;
      const hasSuperadminField = usersCol.schema.some(f => f.name === 'isSuperadmin');
      if (!hasSuperadminField) {
        console.log('Agregando campo "isSuperadmin" a la colección "users"...');
        usersCol.schema.push({
          name: 'isSuperadmin',
          type: 'bool',
          required: false,
          options: {}
        });
        changed = true;
      }
      
      if (usersCol.listRule !== '@request.auth.id != ""' || usersCol.viewRule !== '@request.auth.id != ""') {
        console.log('Actualizando reglas de acceso de la colección "users" para permitir lectura autenticada...');
        usersCol.listRule = '@request.auth.id != ""';
        usersCol.viewRule = '@request.auth.id != ""';
        changed = true;
      }
      
      if (changed) {
        await request(`/api/collections/${usersCol.id}`, {
          method: 'PATCH',
          headers: authHeader,
          body: JSON.stringify(usersCol)
        });
        console.log('Colección "users" actualizada.');
      }
    }

    // Helper para buscar o crear colección paso a paso
    async function upsertCollection(colData) {
      const existing = existingCollections.find(c => c.name === colData.name);
      if (existing) {
        // Si el esquema y reglas son iguales, saltar actualización para evitar errores de índices SQLite
        if (schemasAreEqual(existing, colData)) {
          console.log(`La colección "${colData.name}" ya está al día. Saltando actualización.`);
          return existing;
        }

        console.log(`La colección "${colData.name}" tiene cambios pendientes. Actualizando...`);
        const updatedCol = {
          ...existing,
          ...colData,
          schema: [
            ...existing.schema.filter(f => ['id', 'created', 'updated'].includes(f.name)),
            ...colData.schema
          ]
        };
        const uniqueSchema = [];
        const seen = new Set();
        for (const field of updatedCol.schema) {
          if (!seen.has(field.name)) {
            seen.add(field.name);
            uniqueSchema.push(field);
          }
        }
        updatedCol.schema = uniqueSchema;

        const res = await request(`/api/collections/${existing.id}`, {
          method: 'PATCH',
          headers: authHeader,
          body: JSON.stringify(updatedCol)
        });
        console.log(`Colección "${colData.name}" actualizada.`);
        return res;
      } else {
        console.log(`La colección "${colData.name}" no existe. Creando...`);
        const res = await request('/api/collections', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify(colData)
        });
        console.log(`Colección "${colData.name}" creada con ID: ${res.id}`);
        return res;
      }
    }

    // 1. Obtener o Crear colección 'contests' (con campo 'admins')
    const contestsCol = {
      name: 'contests',
      type: 'base',
      schema: [
        { name: 'name', type: 'text', required: true },
        { name: 'type', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'active', type: 'bool' },
        {
          name: 'admins',
          type: 'relation',
          required: false,
          options: {
            collectionId: usersId,
            cascadeDelete: false,
            maxSelect: null
          }
        }
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: null,
      updateRule: '@request.auth.id != "" && @request.auth.isSuperadmin = true',
      deleteRule: null,
    };
    const contestsCollection = await upsertCollection(contestsCol);
    const contestsId = contestsCollection.id;

    // Actualizar la lista de colecciones locales para obtener los últimos IDs
    collectionsRes = await request('/api/collections?perPage=100', { headers: authHeader });
    existingCollections = collectionsRes.items || [];

    // 2. Obtener o Crear colección 'matches' (con marcador real y played)
    const matchesCol = {
      name: 'matches',
      type: 'base',
      schema: [
        {
          name: 'contest',
          type: 'relation',
          required: true,
          options: {
            collectionId: contestsId,
            cascadeDelete: false,
            maxSelect: 1
          }
        },
        { name: 'homeTeam', type: 'text', required: true },
        { name: 'homeFlag', type: 'text', required: true },
        { name: 'awayTeam', type: 'text', required: true },
        { name: 'awayFlag', type: 'text', required: true },
        { name: 'stage', type: 'text', required: true },
        { name: 'date', type: 'date', required: true },
        { name: 'active', type: 'bool' },
        { name: 'homeScore', type: 'number', required: false, options: { min: 0 } },
        { name: 'awayScore', type: 'number', required: false, options: { min: 0 } },
        { name: 'played', type: 'bool', required: false }
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != "" && (@request.auth.isSuperadmin = true || @request.data.contest.admins.id ?= @request.auth.id)',
      updateRule: '@request.auth.id != "" && (@request.auth.isSuperadmin = true || contest.admins.id ?= @request.auth.id)',
      deleteRule: '@request.auth.id != "" && (@request.auth.isSuperadmin = true || contest.admins.id ?= @request.auth.id)',
    };
    const matchesCollection = await upsertCollection(matchesCol);
    const matchesId = matchesCollection.id;

    // 3. Obtener o Crear colección 'predictions' (con campo 'points')
    const predictionsCol = {
      name: 'predictions',
      type: 'base',
      schema: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          options: {
            collectionId: usersId,
            cascadeDelete: false,
            maxSelect: 1
          }
        },
        {
          name: 'match',
          type: 'relation',
          required: true,
          options: {
            collectionId: matchesId,
            cascadeDelete: false,
            maxSelect: 1
          }
        },
        {
          name: 'homeScore',
          type: 'number',
          required: false,
          options: { min: 0 }
        },
        {
          name: 'awayScore',
          type: 'number',
          required: false,
          options: { min: 0 }
        },
        {
          name: 'points',
          type: 'number',
          required: false,
          options: { min: 0 }
        }
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id = user.id',
      updateRule: '@request.auth.id = user.id',
      deleteRule: '@request.auth.id = user.id',
      indexes: [
        'CREATE UNIQUE INDEX idx_user_match ON predictions (user, match)'
      ]
    };
    await upsertCollection(predictionsCol);

    // 4. Buscar usuario 'test' para hacerlo Superadmin y Admin del concurso
    console.log('Buscando usuario "test@ug.uchile.cl"...');
    const usersList = await request(`/api/collections/users/records?filter=email="test@ug.uchile.cl"`, { headers: authHeader });
    let testUser = null;
    
    if (usersList.items && usersList.items.length > 0) {
      testUser = usersList.items[0];
      console.log('Usuario "test" encontrado. Asignando rol "isSuperadmin"...');
      testUser = await request(`/api/collections/users/records/${testUser.id}`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ isSuperadmin: true })
      });
      console.log('Usuario "test" es ahora Superadmin.');
    } else {
      console.log('Usuario "test@ug.uchile.cl" no existe en la base de datos.');
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

    // 6. Sembrar partidos
    console.log('Sembrando partidos para la Polla Mundialera...');
    const matchesToSeed = [
      { homeTeam: 'Países Bajos', homeFlag: '🇳🇱', awayTeam: 'Estados Unidos', awayFlag: '🇺🇸', stage: 'Octavos de Final', date: '2026-11-20T16:00:00Z' },
      { homeTeam: 'Argentina', homeFlag: '🇦🇷', awayTeam: 'Australia', awayFlag: '🇦🇺', stage: 'Octavos de Final', date: '2026-11-20T20:00:00Z' },
      { homeTeam: 'Francia', homeFlag: '🇫🇷', awayTeam: 'Polonia', awayFlag: '🇵🇱', stage: 'Octavos de Final', date: '2026-11-21T16:00:00Z' },
      { homeTeam: 'Inglaterra', homeFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', awayTeam: 'Senegal', awayFlag: '🇸🇳', stage: 'Octavos de Final', date: '2026-11-21T20:00:00Z' },
      { homeTeam: 'Japón', homeFlag: '🇯🇵', awayTeam: 'Croacia', awayFlag: '🇭🇷', stage: 'Octavos de Final', date: '2026-11-22T16:00:00Z' },
      { homeTeam: 'Brasil', homeFlag: '🇧🇷', awayTeam: 'Corea del Sur', awayFlag: '🇰🇷', stage: 'Octavos de Final', date: '2026-11-22T20:00:00Z' },
      { homeTeam: 'Marruecos', homeFlag: '🇲🇦', awayTeam: 'España', awayFlag: '🇪🇸', stage: 'Octavos de Final', date: '2026-11-23T16:00:00Z' },
      { homeTeam: 'Portugal', homeFlag: '🇵🇹', awayTeam: 'Suiza', awayFlag: '🇨🇭', stage: 'Octavos de Final', date: '2026-11-23T20:00:00Z' }
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
            played: false
          })
        });
        console.log(`Partido ${m.homeTeam} vs ${m.awayTeam} creado.`);
      }
      seededMatches.push(matchRecord);
    }

    // 7. Sembrar 6 usuarios genéricos de prueba si no existen
    console.log('Sembrando 6 usuarios de prueba...');
    const testUsersToSeed = [
      { email: 'juan.perez@ug.uchile.cl', name: 'Juan Pérez' },
      { email: 'sofia.gomez@ug.uchile.cl', name: 'Sofía Gómez' },
      { email: 'diego.soto@ug.uchile.cl', name: 'Diego Soto' },
      { email: 'camila.silva@ug.uchile.cl', name: 'Camila Silva' },
      { email: 'lucas.munoz@ug.uchile.cl', name: 'Lucas Muñoz' },
      { email: 'valentina.rojas@ug.uchile.cl', name: 'Valentina Rojas' }
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
              emailVisibility: true,
              password: 'password123',
              passwordConfirm: 'password123',
              name: u.name,
              isSuperadmin: false
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
