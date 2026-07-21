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
    console.log('Autenticando como eduardor (dummy5.rojas@ing.uchile.cl)...');
    const authData = await request('/api/collections/users/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({
        identity: 'dummy5.rojas@ing.uchile.cl',
        password: 'password123',
      }),
    });
    
    const token = authData.token;
    const authorId = authData.record.id;
    console.log('Autenticación exitosa. Token obtenido.');
    
    console.log('Creando post con mención a @cataaaaar...');
    const postRes = await request('/api/collections/posts/records', {
      method: 'POST',
      headers: {
        'Authorization': token,
      },
      body: JSON.stringify({
        content: 'Prueba de mencion real de eduardor para @cataaaaar',
        author: authorId,
        tags: [],
      }),
    });
    
    console.log('Post creado con éxito. ID:', postRes.id);
  } catch (err) {
    console.error('Error en el test:', err.message || err);
  }
}

main();
