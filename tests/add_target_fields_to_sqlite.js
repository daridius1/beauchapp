const { DatabaseSync } = require('node:sqlite');
const path = require('path');

function addTargetFieldsToSqlite() {
  const dbPath = path.join(__dirname, '../backend/pb_data/data.db');
  const db = new DatabaseSync(dbPath);

  // 1. Agregar columnas en la tabla física 'posts' si no existen
  const columns = db.prepare(`PRAGMA table_info(posts)`).all().map(c => c.name);
  
  if (!columns.includes('actionType')) {
    db.prepare(`ALTER TABLE posts ADD COLUMN actionType TEXT`).run();
    console.log('Columna actionType agregada a posts');
  }

  if (!columns.includes('targetType')) {
    db.prepare(`ALTER TABLE posts ADD COLUMN targetType TEXT`).run();
    console.log('Columna targetType agregada a posts');
  }

  if (!columns.includes('targetId')) {
    db.prepare(`ALTER TABLE posts ADD COLUMN targetId TEXT`).run();
    console.log('Columna targetId agregada a posts');
  }

  if (!columns.includes('targetMeta')) {
    db.prepare(`ALTER TABLE posts ADD COLUMN targetMeta JSON`).run();
    console.log('Columna targetMeta agregada a posts');
  }

  // 2. Registrar campos en _collections para la colección 'posts'
  const row = db.prepare(`SELECT id, name, fields FROM _collections WHERE name = 'posts'`).get();
  if (row) {
    const fields = JSON.parse(row.fields);
    let updated = false;

    const newFields = [
      { id: 'pst_acttype_01', name: 'actionType', type: 'text', required: false },
      { id: 'pst_trgtype_01', name: 'targetType', type: 'text', required: false },
      { id: 'pst_trgid_01', name: 'targetId', type: 'text', required: false },
      { id: 'pst_trgmeta_01', name: 'targetMeta', type: 'json', required: false },
    ];

    for (const nf of newFields) {
      if (!fields.some(f => f.name === nf.name)) {
        fields.push(nf);
        updated = true;
      }
    }

    if (updated) {
      db.prepare(`UPDATE _collections SET fields = ? WHERE id = ?`).run(JSON.stringify(fields), row.id);
      console.log('Campos polimórficos registrados en _collections para posts');
    }
  }
}

addTargetFieldsToSqlite();
