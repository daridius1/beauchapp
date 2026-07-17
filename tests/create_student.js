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
    console.log('Autenticando como administrador...');
    const authData = await request('/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({
        identity: 'admin@daridius.cl',
        password: 'password123',
      }),
    });
    
    const token = authData.token;
    console.log('Autenticación exitosa.');
    
    const authHeader = { 'Authorization': token };

    const email = 'estudiante@ing.uchile.cl';
    console.log(`Verificando si el usuario ${email} ya existe...`);
    const usersList = await request(`/api/collections/users/records?filter=email="${email}"`, { headers: authHeader });
    
    if (usersList.items && usersList.items.length > 0) {
      const user = usersList.items[0];
      console.log(`El usuario ${email} ya existe. Asegurando que esté verificado...`);
      await request(`/api/collections/users/records/${user.id}`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ verified: true })
      });
      console.log('Usuario verificado exitosamente.');
    } else {
      console.log(`Creando nuevo usuario ${email}...`);
      await request('/api/collections/users/records', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          username: 'estudiante',
          email: email,
          emailVisibility: true,
          password: 'password123',
          passwordConfirm: 'password123',
          name: 'Estudiante Genérico',
          verified: true,
          type: 'student'
        })
      });
      console.log('Usuario de estudiante creado exitosamente.');
    }
  } catch (err) {
    console.error('Error al crear el estudiante:', err);
  }
}

main();
