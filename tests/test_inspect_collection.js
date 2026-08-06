const BACKEND_URL = process.env.PB_BACKEND_URL || 'http://127.0.0.1:8090';
const TEST_USER_EMAIL = process.env.PB_TEST_USER_EMAIL || 'test.user@example.test';
const TEST_USER_PASSWORD = process.env.PB_TEST_USER_PASSWORD || 'changeme-local-only';

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
        identity: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
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
