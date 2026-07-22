const { DatabaseSync } = require('node:sqlite');
const path = require('path');

function cleanupProblemPosts() {
  const dbPath = path.join(__dirname, '../backend/pb_data/data.db');
  const db = new DatabaseSync(dbPath);

  console.log('--- Limpieza de Posts Vinculados a Problemas ---');

  // Buscar posts con entityType = 'problems' o entityType no nulo/vacío
  const problemPosts = db.prepare(`
    SELECT id, entityType, entityId, content FROM posts 
    WHERE entityType = 'problems' OR (entityType IS NOT NULL AND entityType != '')
  `).all();

  console.log(`Se encontraron ${problemPosts.length} posts vinculados a problemas:`);
  console.log(problemPosts);

  if (problemPosts.length > 0) {
    const result = db.prepare(`
      DELETE FROM posts 
      WHERE entityType = 'problems' OR (entityType IS NOT NULL AND entityType != '')
    `).run();

    console.log(`\nÉxito: Se eliminaron ${result.changes || problemPosts.length} registros de posts vinculados.`);
  } else {
    console.log('\nNo había posts vinculados que requirieran eliminación.');
  }
}

cleanupProblemPosts();
