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
    const userId = authData.record.id;
    console.log('Authenticated. User ID:', userId);

    console.log('Fetching problems...');
    const problems = await request('/api/collections/problems/records?limit=1', {
      headers: { 'Authorization': token }
    });

    if (problems.items.length === 0) {
      console.log('No problems found.');
      return;
    }

    const problemId = problems.items[0].id;
    console.log('Using problem ID:', problemId);

    console.log('Attempting to create rating with rating=4, difficulty=0...');
    try {
      const res = await request('/api/collections/problem_ratings/records', {
        method: 'POST',
        headers: { 'Authorization': token },
        body: JSON.stringify({
          problem: problemId,
          user: userId,
          rating: 4,
          difficulty: 0
        })
      });
      console.log('Success!', res);
    } catch (e) {
      console.error('Failed to create:', e.message);
    }

    console.log('Attempting to create rating with rating=0, difficulty=3...');
    try {
      const res = await request('/api/collections/problem_ratings/records', {
        method: 'POST',
        headers: { 'Authorization': token },
        body: JSON.stringify({
          problem: problemId,
          user: userId,
          rating: 0,
          difficulty: 3
        })
      });
      console.log('Success!', res);
    } catch (e) {
      console.error('Failed to create:', e.message);
    }
  } catch (err) {
    console.error('Main error:', err);
  }
}

main();
