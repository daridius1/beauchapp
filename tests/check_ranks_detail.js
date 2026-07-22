const { DatabaseSync } = require('node:sqlite');
const path = require('path');

function checkRanksDetail() {
  const dbPath = path.join(__dirname, '../backend/pb_data/data.db');
  const db = new DatabaseSync(dbPath);

  console.log('--- Ladder Ranks ---');
  const ranks = db.prepare(`
    SELECT lr.id, lr.ladder, lr.mode, lr.ordinal_rating, u.name 
    FROM ladder_ranks lr
    LEFT JOIN users u ON lr.user = u.id
  `).all();
  console.log(ranks);

  console.log('\n--- Ladder Matches ---');
  const matches = db.prepare(`
    SELECT lm.id, lm.ladder, lm.mode, lm.status, lm.score_red, lm.score_blue, lm.created
    FROM ladder_matches lm
    ORDER BY lm.created DESC
  `).all();
  console.log(matches);
}

checkRanksDetail();
