const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '../backend/pb_data/data.db');
const db = new sqlite3.Database(dbPath);

// Generate a random ID (15 chars)
function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 15; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Get a few users to be members
db.all('SELECT id FROM _pb_users_auth_ LIMIT 5', [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  
  const members = rows.map(r => r.id);
  const membersJson = JSON.stringify(members);

  const communities = [
    { name: 'Deportes FCFM', desc: 'Todo sobre deportes en Beauchef' },
    { name: 'Programación', desc: 'Para los amantes del código' },
    { name: 'Música', desc: 'Bandas y tocatas' }
  ];

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z';

  communities.forEach(c => {
    const id = generateId();
    db.run(
      `INSERT INTO communities (id, created, updated, name, description, members) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, now, now, c.name, c.desc, membersJson],
      function(err) {
        if (err) console.error(err);
        else console.log('Added community:', c.name);
      }
    );
  });

  setTimeout(() => db.close(), 1000);
});
