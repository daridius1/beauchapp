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

    // 1. Buscar usuario 'test' para verificarlo
    console.log('Buscando usuario "test@ing.uchile.cl"...');
    const usersList = await request(`/api/collections/users/records?filter=email="test@ing.uchile.cl"`, { headers: authHeader });
    let testUser = null;
    
    if (usersList.items && usersList.items.length > 0) {
      testUser = usersList.items[0];
      console.log('Usuario "test" encontrado. Asignando verificado...');
      testUser = await request(`/api/collections/users/records/${testUser.id}`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ verified: true })
      });
      console.log('Usuario "test" verificado.');
    } else {
      console.log('Usuario "test@ing.uchile.cl" no existe en la base de datos.');
    }

    // 2. Sembrar usuarios de prueba
    console.log('Sembrando usuarios de prueba...');
    const testUsersToSeed = [
      { email: 'juan.perez@ing.uchile.cl', name: 'Juan Pérez' },
      { email: 'sofia.gomez@ing.uchile.cl', name: 'Sofía Gómez' },
      { email: 'diego.soto@ing.uchile.cl', name: 'Diego Soto' },
      { email: 'camila.silva@ing.uchile.cl', name: 'Camila Silva' }
    ];

    const seededUsers = [];
    if (testUser) seededUsers.push(testUser);

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
              verified: true,
              type: 'student'
            })
          });
          console.log(`Usuario de prueba ${u.name} creado.`);
        }
        seededUsers.push(userRecord);
      } catch (err) {
        console.error(`Error al sembrar usuario ${u.email}:`, err);
      }
    }

    if (seededUsers.length === 0) {
      throw new Error("No hay usuarios disponibles para asignar como autores de problemas/posts.");
    }

    // Helper para obtener un autor aleatorio
    const getRandomUser = () => seededUsers[Math.floor(Math.random() * seededUsers.length)];

    // 3. Sembrar problemas
    console.log('Sembrando problemas de prueba...');
    const mockProblems = [
      {
        title: 'Criterio de la Integral para Series',
        content: 'Demuestre que la serie $\\sum_{n=1}^{\\infty} \\frac{1}{n^p}$ converge si $p > 1$ y diverge si $p \\le 1$ utilizando el criterio de la integral. \n\nRecuerde verificar las hipótesis de continuidad, decrecimiento y positividad de la función asociada.',
        tags: ['cálculo', 'series', 'integral'],
        ramo: 'MA1002',
        semestre: '2024-1',
        instancia: 'C2'
      },
      {
        title: 'Teorema de la Divergencia de Gauss',
        content: 'Calcule el flujo del campo vectorial $\\vec{F}(x,y,z) = (x^3, y^3, z^3)$ a través de la esfera unitaria $x^2 + y^2 + z^2 = 1$ orientada hacia afuera. \n\n$$\\iint_{S} \\vec{F} \\cdot d\\vec{S}$$',
        tags: ['cálculo', 'vectorial', 'gauss'],
        ramo: 'MA2007',
        semestre: '2024-2',
        instancia: 'C3'
      },
      {
        title: 'Diagonalización de Matrices Simétricas',
        content: 'Dada la matriz simétrica:\n\n$$A = \\begin{pmatrix} 2 & -1 \\\\ -1 & 2 \\end{pmatrix}$$\n\nEncuentre una matriz ortogonal $P$ tal que $P^T A P$ sea diagonal. Grafique la forma cuadrática asociada.',
        tags: ['algebra', 'matrices', 'diagonalizacion'],
        ramo: 'MA1001',
        semestre: '2023-2',
        instancia: 'EX'
      },
      {
        title: 'Introducción a la Programación en Python',
        content: 'Escriba una función recursiva `es_palindromo(s)` que reciba un string `s` y retorne `True` si es un palíndromo y `False` en caso contrario. No utilice tajos de lista (`s[::-1]`).',
        tags: ['computación', 'recursión', 'python'],
        ramo: 'CC1002',
        semestre: '2024-1',
        instancia: 'C1'
      },
      {
        title: 'Leyes de Newton en el Plano Inclinado',
        content: 'Un bloque de masa $m = 5\\text{ kg}$ se desliza por un plano inclinado con ángulo $\\theta = 30^\\circ$ respecto a la horizontal. Si el coeficiente de roce dinámico es $\\mu_k = 0.1$, determine la aceleración del bloque.',
        tags: ['física', 'mecánica', 'newton'],
        ramo: 'FI1001',
        semestre: '2024-2',
        instancia: 'C2'
      }
    ];

    const seededProblems = [];
    for (const prob of mockProblems) {
      // Evitar duplicados por título
      const existing = await request(`/api/collections/problems/records?filter=title="${encodeURIComponent(prob.title)}"`, { headers: authHeader });
      let record;
      if (existing.items && existing.items.length > 0) {
        record = existing.items[0];
        console.log(`Problema "${prob.title}" ya existe. Actualizando campos académicos...`);
        record = await request(`/api/collections/problems/records/${record.id}`, {
          method: 'PATCH',
          headers: authHeader,
          body: JSON.stringify({
            ramo: prob.ramo,
            semestre: prob.semestre,
            instancia: prob.instancia
          })
        });
      } else {
        const author = getRandomUser();
        record = await request('/api/collections/problems/records', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            title: prob.title,
            content: prob.content,
            tags: prob.tags,
            ramo: prob.ramo,
            semestre: prob.semestre,
            instancia: prob.instancia,
            author: author.id,
            parent: ''
          })
        });
        console.log(`Problema "${prob.title}" creado.`);
      }
      seededProblems.push(record);
    }

    // 4. Sembrar soluciones (pautas) para los problemas
    console.log('Sembrando soluciones (pautas)...');
    for (const prob of seededProblems) {
      // Buscar si ya tiene pautas
      const existing = await request(`/api/collections/problems/records?filter=parent="${prob.id}"`, { headers: authHeader });
      if (existing.items && existing.items.length > 0) {
        console.log(`El problema "${prob.title}" ya tiene pautas sembradas.`);
      } else {
        const author = getRandomUser();
        
        // Pauta 1
        await request('/api/collections/problems/records', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            title: 'Resolución analítica oficial',
            content: `Aquí está la resolución completa para **${prob.title}**.\n\nDefinimos la función $f(x)$ asociada al término general de la serie. Evaluamos la integral impropia:\n\n$$\\int_{1}^{\\infty} f(x) dx$$\n\nComo la integral converge para $p > 1$, la serie también lo hace.`,
            author: author.id,
            parent: prob.id
          })
        });

        // Pauta 2
        await request('/api/collections/problems/records', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            title: 'Método alternativo con límites',
            content: `Se puede resolver alternativamente analizando el comportamiento asintótico cuando $x \\to \\infty$. Es directo aplicando la definición de límites de sumas parciales.`,
            author: getRandomUser().id,
            parent: prob.id
          })
        });
        
        console.log(`Pautas creadas para el problema "${prob.title}".`);
      }
    }

    // 5. Sembrar calificaciones ficticias
    console.log('Sembrando calificaciones para los problemas...');
    const allProbsAndSols = await request(`/api/collections/problems/records?perPage=100`, { headers: authHeader });
    for (const item of allProbsAndSols.items || []) {
      const existing = await request(`/api/collections/problem_ratings/records?filter=problem="${item.id}"`, { headers: authHeader });
      if (existing.items && existing.items.length > 0) {
        console.log(`El elemento "${item.title}" ya cuenta con calificaciones.`);
      } else {
        // Añadir 2 calificaciones por usuarios distintos
        const usersToRate = seededUsers.slice(0, 2);
        for (const u of usersToRate) {
          await request('/api/collections/problem_ratings/records', {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({
              problem: item.id,
              user: u.id,
              rating: Math.floor(Math.random() * 2) + 4, // Notas 4 o 5
              difficulty: item.parent ? 1 : Math.floor(Math.random() * 3) + 3 // Dificultad 3 a 5 solo para problemas (1 para pautas ya que no se muestra)
            })
          });
        }
        console.log(`Calificaciones sembradas para "${item.title}".`);
      }
    }

    // 6. Sembrar publicaciones (posts)
    console.log('Sembrando publicaciones en el foro...');
    const mockPosts = [
      { content: '¿Alguien sabe cuándo es el primer control de Cálculo Multivariable?', tags: ['calculo', 'controles'] },
      { content: 'Recomiendo mucho el libro de Álgebra Lineal de Hoffman para repasar diagonalización, está muy completo.', tags: ['algebra', 'libros'] },
      { content: '¿Qué tal el nuevo casino del edificio de alumnos? ¿Lo han probado?', tags: ['comunidad', 'casino'] }
    ];

    const seededPosts = [];
    for (const p of mockPosts) {
      const existing = await request(`/api/collections/posts/records?filter=content="${encodeURIComponent(p.content)}"`, { headers: authHeader });
      let postRec;
      if (existing.items && existing.items.length > 0) {
        postRec = existing.items[0];
        console.log(`Post con contenido "${p.content.substring(0, 30)}..." ya existe.`);
      } else {
        postRec = await request('/api/collections/posts/records', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            content: p.content,
            tags: p.tags,
            author: getRandomUser().id,
            replyTo: '',
            root: ''
          })
        });
        console.log(`Post de foro creado.`);
      }
      seededPosts.push(postRec);
    }

    // 7. Sembrar respuestas a los posts
    console.log('Sembrando comentarios en los posts...');
    for (const post of seededPosts) {
      const existing = await request(`/api/collections/posts/records?filter=replyTo="${post.id}"`, { headers: authHeader });
      if (existing.items && existing.items.length > 0) {
        console.log(`El post "${post.content.substring(0, 20)}..." ya tiene comentarios.`);
      } else {
        const commenter = getRandomUser();
        // Crear comentario
        await request('/api/collections/posts/records', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            content: 'Buena pregunta, me sumo a la duda.',
            tags: [],
            author: commenter.id,
            replyTo: post.id,
            root: post.id
          })
        });
        console.log(`Comentario sembrado en post.`);
      }
    }

    console.log('Semilla completada exitosamente con problemas y foro.');
  } catch (err) {
    console.error('Error durante la ejecución de la semilla:', err);
    process.exit(1);
  }
}

main();
