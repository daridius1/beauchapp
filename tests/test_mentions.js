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

    // 1. Obtener la lista de usuarios
    console.log('Obteniendo usuarios...');
    const usersRes = await request('/api/collections/users/records?limit=5', { headers: authHeader });
    const users = usersRes.items;
    if (users.length < 2) {
      console.log('No hay suficientes usuarios en la base de datos para probar.');
      return;
    }

    const userA = users[0];
    const userB = users[1];
    console.log(`Usuario A (Autor): ${userA.username} (${userA.id})`);
    console.log(`Usuario B (Mencionado): ${userB.username} (${userB.id})`);

    // 2. Crear una publicación de User A mencionando a User B
    const content = `Hola @${userB.username}, ¿cómo estás? probando menciones en Beauchapp!`;
    console.log(`Creando post con contenido: "${content}"...`);
    const postRes = await request('/api/collections/posts/records', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        author: userA.id,
        content: content,
        tags: [],
        commentCount: 0
      }),
    });
    console.log(`Post creado con ID: ${postRes.id}`);

    // Esperar un momento para que se ejecute el hook
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Consultar las notificaciones del usuario B
    console.log(`Buscando notificaciones para el usuario B (${userB.id})...`);
    const notificationsRes = await request(`/api/collections/notifications/records?filter=user="${userB.id}"&expand=sender`, {
      headers: authHeader,
    });

    console.log('Notificaciones encontradas:', notificationsRes.items.length);
    notificationsRes.items.forEach(notif => {
      console.log(`- Tipo: ${notif.type} | Título: ${notif.title} | Cuerpo: ${notif.body} | Related ID: ${notif.relatedId}`);
    });

    // 4. Limpiar el post creado y la notificación si fue creada
    console.log('Limpiando datos de prueba...');
    await request(`/api/collections/posts/records/${postRes.id}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    console.log('Post de prueba eliminado.');

    for (const notif of notificationsRes.items) {
      if (notif.relatedId === postRes.id) {
        await request(`/api/collections/notifications/records/${notif.id}`, {
          method: 'DELETE',
          headers: authHeader,
        });
        console.log(`Notificación de prueba ${notif.id} eliminada.`);
      }
    }

  } catch (err) {
    console.error('Error durante la prueba:', err);
  }
}

main();
