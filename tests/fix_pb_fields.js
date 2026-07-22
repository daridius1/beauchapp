const { DatabaseSync } = require('node:sqlite');
const path = require('path');

function checkAndFixPbFields() {
  const dbPath = path.join(__dirname, '../backend/pb_data/data.db');
  const db = new DatabaseSync(dbPath);

  const row = db.prepare(`SELECT id, name, fields FROM _collections WHERE name = 'ladder_ranks'`).get();
  if (!row) {
    console.error('No se encontró la colección ladder_ranks');
    return;
  }

  console.log('Colección ladder_ranks encontrada:');
  const fields = JSON.parse(row.fields);
  console.log('Campos actuales:', fields.map(f => f.name));

  const hasMode = fields.some(f => f.name === 'mode');
  if (!hasMode) {
    console.log('Agregando campo "mode" a fields de _collections...');
    fields.push({
      id: 'lrk_mode_01',
      name: 'mode',
      type: 'text',
      required: false,
      presentable: false,
      system: false
    });

    db.prepare(`UPDATE _collections SET fields = ? WHERE id = ?`).run(JSON.stringify(fields), row.id);
    console.log('Campo "mode" guardado con éxito en _collections.');
  } else {
    console.log('El campo "mode" ya está registrado en _collections.');
  }
}

checkAndFixPbFields();
