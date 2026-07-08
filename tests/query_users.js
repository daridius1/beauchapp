const PocketBase = require('pocketbase/cjs');

async function test() {
  const pb = new PocketBase('http://127.0.0.1:8090');
  try {
    const records = await pb.collection('users').getFullList({
      sort: '-created',
    });
    console.log('Total users:', records.length);
    records.forEach(r => {
      console.log(`User: ${r.name || r.username} | Type: ${r.type} | Subtype: ${r.subtype}`);
    });
  } catch (err) {
    console.error('Error querying:', err);
  }
}

test();
