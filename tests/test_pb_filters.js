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
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request to ${path} failed with status ${response.status}: ${text}`);
  }
  return response.json();
}

async function testFilter(token, filter) {
  const headers = { 'Authorization': token };
  const url = `/api/collections/problems/records?filter=${encodeURIComponent(filter)}`;
  const data = await request(url, { headers });
  console.log(`Filter: [${filter}] returned ${data.items?.length || 0} items.`);
  if (data.items) {
    data.items.forEach(item => {
      console.log(`  - ID: ${item.id}, Title: "${item.title}", Parent: "${item.parent}"`);
    });
  }
}

async function main() {
  try {
    console.log(`Authenticating as ${TEST_USER_EMAIL}...`);
    const authData = await request('/api/collections/users/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({
        identity: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
      })
    });
    
    const token = authData.token;
    console.log('Authentication successful. Testing parent filters...');
    await testFilter(token, 'parent = ""');
    await testFilter(token, 'parent = null');
    await testFilter(token, 'parent != ""');
  } catch (err) {
    console.error(err);
  }
}

main();
