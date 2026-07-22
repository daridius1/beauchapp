const { DatabaseSync } = require('node:sqlite');
const path = require('path');

function seedSubLadders() {
  const dbPath = path.join(__dirname, '../backend/pb_data/data.db');
  const db = new DatabaseSync(dbPath);

  console.log('Actualizando y sembrando sub-ladders en la base de datos sqlite...');

  // Actualizar slugs existentes
  db.prepare(`UPDATE ladders SET slug = 'tenis-de-mesa-1v1', name = 'Tenis de Mesa 1v1', allowed_modes = '["1v1"]' WHERE slug = 'tenis-de-mesa'`).run();
  db.prepare(`UPDATE ladders SET slug = 'taca-taca-2v2', name = 'Taca Taca 2v2', allowed_modes = '["2v2"]' WHERE slug = 'taca-taca'`).run();

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z';

  const requiredLadders = [
    {
      id: 'tenisdemesa1v1',
      name: 'Tenis de Mesa 1v1',
      slug: 'tenis-de-mesa-1v1',
      allowed_modes: '["1v1"]',
      description: 'Ranking oficial de Tenis de Mesa (Ping Pong) FCFM en modalidad Individuales (1v1).',
      max_score: 11,
      icon: 'activity',
      is_active: 1,
    },
    {
      id: 'tenisdemesa2v2',
      name: 'Tenis de Mesa 2v2',
      slug: 'tenis-de-mesa-2v2',
      allowed_modes: '["2v2"]',
      description: 'Ranking oficial de Tenis de Mesa (Ping Pong) FCFM en modalidad Dobles (2v2).',
      max_score: 11,
      icon: 'activity',
      is_active: 1,
    },
    {
      id: 'tacatacaladd1v1',
      name: 'Taca Taca 1v1',
      slug: 'taca-taca-1v1',
      allowed_modes: '["1v1"]',
      description: 'Ranking oficial de Taca Taca FCFM en modalidad Individuales (1v1).',
      max_score: 5,
      icon: 'activity',
      is_active: 1,
    },
    {
      id: 'tacatacaladd2v2',
      name: 'Taca Taca 2v2',
      slug: 'taca-taca-2v2',
      allowed_modes: '["2v2"]',
      description: 'Ranking oficial de Taca Taca FCFM en modalidad Duplas (2v2).',
      max_score: 5,
      icon: 'activity',
      is_active: 1,
    },
  ];

  for (const item of requiredLadders) {
    const existing = db.prepare(`SELECT id FROM ladders WHERE slug = ?`).get(item.slug);
    if (existing) {
      console.log(`Ladder ya existe en DB: ${item.slug}`);
    } else {
      db.prepare(`
        INSERT INTO ladders (id, name, slug, allowed_modes, description, max_score, icon, is_active, created, updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(item.id, item.name, item.slug, item.allowed_modes, item.description, item.max_score, item.icon, item.is_active, now, now);
      console.log(`Ladder insertado con éxito: ${item.slug} (${item.id})`);
    }
  }

  const all = db.prepare(`SELECT id, name, slug, allowed_modes FROM ladders`).all();
  console.log('Ladders resultantes:', all);
}

seedSubLadders();
