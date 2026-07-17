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
  return response.json();
}

async function main() {
  try {
    console.log('Authenticating...');
    const authData = await request('/api/collections/users/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({
        identity: 'juan.perez@ing.uchile.cl',
        password: 'password123'
      })
    });
    const token = authData.token;

    console.log('Fetching problem_ratings collection metadata...');
    // We can get collection info from PocketBase schema or api
    // Let's try to query /api/collections/problem_ratings
    const colInfo = await request('/api/collections', {
      headers: { 'Authorization': token }
    });
    const ratingCol = colInfo.items.find(c => c.name === 'problem_ratings');
    console.log(JSON.stringify(ratingCol, null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
