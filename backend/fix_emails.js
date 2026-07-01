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
  
  if (!response.ok) return null;
  if (response.status === 204) return null;
  return response.json();
}

async function main() {
  try {
    const authData = await request('/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
    });
    const authHeader = { 'Authorization': authData.token };

    const usersRes = await request('/api/collections/users/records?perPage=500', { headers: authHeader });
    for (const u of usersRes.items) {
      if (u.email.endsWith('@test.com')) {
        const newEmail = u.email.replace('@test.com', '@ug.uchile.cl');
        console.log(`Updating ${u.email} to ${newEmail}`);
        await request(`/api/collections/users/records/${u.id}`, {
          method: 'PATCH',
          headers: authHeader,
          body: JSON.stringify({ email: newEmail })
        });
      }
    }
    console.log('Correos actualizados exitosamente!');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
