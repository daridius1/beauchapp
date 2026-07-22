const { DatabaseSync } = require('node:sqlite');
const path = require('path');

function fixRanksAndMatches() {
  const dbPath = path.join(__dirname, '../backend/pb_data/data.db');
  const db = new DatabaseSync(dbPath);

  console.log('Reparando permisos, ranks y asignación de partidos en sqlite...');

  // 1. Actualizar updateRule en la colección ladder_ranks
  db.prepare(`UPDATE _collections SET updateRule = ? WHERE name = 'ladder_ranks'`).run("@request.auth.id != ''");
  console.log('Permisos de updateRule en ladder_ranks actualizados a @request.auth.id != "".');

  // 2. Reasignar partido 2v2 de tenis de mesa (ko12ot88jv3go2u) a tenisdemesa2v2
  const match = db.prepare(`SELECT id, ladder, mode FROM ladder_matches WHERE id = 'ko12ot88jv3go2u'`).get();
  if (match) {
    db.prepare(`UPDATE ladder_matches SET ladder = 'tenisdemesa2v2' WHERE id = 'ko12ot88jv3go2u'`).run();
    console.log('Partido ko12ot88jv3go2u reasignado a tenisdemesa2v2 con éxito.');
  }

  // 3. Normalizar ordinal_rating en ladder_ranks a escala ELO 1200+
  const ranks = db.prepare(`SELECT id, wins, losses, ordinal_rating FROM ladder_ranks`).all();
  for (const r of ranks) {
    if (r.ordinal_rating < 100) {
      const newElo = Math.max(1000, 1200 + (r.wins || 0) * 16 - (r.losses || 0) * 10);
      db.prepare(`UPDATE ladder_ranks SET ordinal_rating = ? WHERE id = ?`).run(newElo, r.id);
      console.log(`Rank ${r.id} corregido de ${r.ordinal_rating} a ELO ${newElo}`);
    }
  }

  // 4. Asegurar registros en tenisdemesa2v2 para los participantes del partido 2v2
  const match2v2 = db.prepare(`SELECT team_red, team_blue FROM ladder_matches WHERE id = 'ko12ot88jv3go2u'`).get();
  if (match2v2) {
    let red = [];
    let blue = [];
    try { red = JSON.parse(match2v2.team_red); } catch (e) {}
    try { blue = JSON.parse(match2v2.team_blue); } catch (e) {}

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z';
    const allPlayers = [...red, ...blue];
    
    for (const pid of allPlayers) {
      const existing = db.prepare(`SELECT id FROM ladder_ranks WHERE ladder = 'tenisdemesa2v2' AND user = ?`).get(pid);
      const isRed = red.includes(pid);
      // Red score 7, Blue score 11 -> Blue won
      const isWinner = !isRed;
      const elo = 1200 + (isWinner ? 16 : -10);

      if (existing) {
        db.prepare(`UPDATE ladder_ranks SET matches_played = 1, wins = ?, losses = ?, ordinal_rating = ? WHERE id = ?`)
          .run(isWinner ? 1 : 0, isWinner ? 0 : 1, elo, existing.id);
      } else {
        const newId = Math.random().toString(36).substring(2, 17);
        db.prepare(`
          INSERT INTO ladder_ranks (id, ladder, user, matches_played, wins, losses, ordinal_rating, created, updated)
          VALUES (?, 'tenisdemesa2v2', ?, 1, ?, ?, ?, ?, ?)
        `).run(newId, pid, isWinner ? 1 : 0, isWinner ? 0 : 1, elo, now, now);
      }
    }
    console.log('Ranks para tenisdemesa2v2 sembrados y actualizados.');
  }

  console.log('Proceso completado.');
}

fixRanksAndMatches();
