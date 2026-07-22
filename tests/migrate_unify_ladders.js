const { DatabaseSync } = require('node:sqlite');
const path = require('path');

function migrateUnifyLadders() {
  const dbPath = path.join(__dirname, '../backend/pb_data/data.db');
  const db = new DatabaseSync(dbPath);

  console.log('Iniciando migración de unificación de deportes y columna mode...');

  // 1. Agregar columna 'mode' a ladder_ranks si no existe
  try {
    db.prepare(`ALTER TABLE ladder_ranks ADD COLUMN mode TEXT`).run();
    console.log('Columna mode agregada con éxito a ladder_ranks.');
  } catch (err) {
    if (err.message.includes('duplicate column name')) {
      console.log('Columna mode ya existía en ladder_ranks.');
    } else {
      console.error('Error agregando columna mode:', err.message);
    }
  }

  // 2. Asignar mode por defecto en ladder_ranks donde sea null
  db.prepare(`UPDATE ladder_ranks SET mode = '1v1' WHERE mode IS NULL OR mode = ''`).run();

  // 3. Reasignar partidos y ranks de tenisdemesa2v2 -> tenisdemesalad1 (con mode = '2v2')
  db.prepare(`UPDATE ladder_matches SET ladder = 'tenisdemesalad1' WHERE ladder = 'tenisdemesa2v2'`).run();
  db.prepare(`UPDATE ladder_ranks SET ladder = 'tenisdemesalad1', mode = '2v2' WHERE ladder = 'tenisdemesa2v2'`).run();

  // 4. Reasignar partidos y ranks de tacatacaladd1v1 -> tacatacaladder1 (con mode = '1v1')
  db.prepare(`UPDATE ladder_matches SET ladder = 'tacatacaladder1' WHERE ladder = 'tacatacaladd1v1'`).run();
  db.prepare(`UPDATE ladder_ranks SET ladder = 'tacatacaladder1', mode = '1v1' WHERE ladder = 'tacatacaladd1v1'`).run();

  // 5. Eliminar sub-ladders redundantes
  db.prepare(`DELETE FROM ladders WHERE id IN ('tenisdemesa2v2', 'tacatacaladd1v1')`).run();

  // 6. Actualizar información de los 3 deportes principales
  db.prepare(`
    UPDATE ladders SET name = 'Tenis de Mesa', slug = 'tenis-de-mesa', allowed_modes = '["1v1", "2v2"]' WHERE id = 'tenisdemesalad1'
  `).run();
  db.prepare(`
    UPDATE ladders SET name = 'Taca Taca', slug = 'taca-taca', allowed_modes = '["1v1", "2v2"]' WHERE id = 'tacatacaladder1'
  `).run();
  db.prepare(`
    UPDATE ladders SET name = 'TipTap', slug = 'tiptap', allowed_modes = '["1v1"]' WHERE id = 'tiptapladder101'
  `).run();

  console.log('\n--- Estado final de Ladders ---');
  const ladders = db.prepare(`SELECT id, name, slug, allowed_modes FROM ladders`).all();
  console.log(ladders);

  console.log('\n--- Estado final de Ladder Ranks ---');
  const ranks = db.prepare(`SELECT id, ladder, user, mode, ordinal_rating FROM ladder_ranks`).all();
  console.log(ranks);

  console.log('\nMigración completada con éxito.');
}

migrateUnifyLadders();
