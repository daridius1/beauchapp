import { pb } from './pocketbase';
import { Ladder, LadderRank, LadderMatch } from '../types/ladder';

export const ladderService = {
  // Obtener todos los ladders activos
  getLadders: async (): Promise<Ladder[]> => {
    const records = await pb.collection('ladders').getFullList<Ladder>({
      filter: 'is_active = true',
      sort: '-created',
    });
    return records.map((r: Ladder) => ({
      ...r,
      allowed_modes: typeof r.allowed_modes === 'string' ? JSON.parse(r.allowed_modes) : (r.allowed_modes || ['2v2']),
    }));
  },

  // Obtener un ladder específico por slug
  getLadderBySlug: async (slug: string): Promise<Ladder> => {
    const record = await pb.collection('ladders').getFirstListItem<Ladder>(`slug = "${slug}"`);
    return {
      ...record,
      allowed_modes: typeof record.allowed_modes === 'string' ? JSON.parse(record.allowed_modes) : (record.allowed_modes || ['2v2']),
    };
  },

  // Obtener un partido por su ID con relaciones expandidas
  getMatchById: async (matchId: string): Promise<LadderMatch> => {
    const record = await pb.collection('ladder_matches').getOne<LadderMatch>(matchId, {
      expand: 'arbiter,team_red,team_blue,ladder',
    });
    return {
      ...record,
      goal_history: typeof record.goal_history === 'string' ? JSON.parse(record.goal_history as any) : (record.goal_history || []),
      confirmations: typeof record.confirmations === 'string' ? JSON.parse(record.confirmations as any) : (record.confirmations || {}),
      openskill_changes: typeof record.openskill_changes === 'string' ? JSON.parse(record.openskill_changes as any) : record.openskill_changes,
    };
  },

  // Obtener la tabla de posiciones (Leaderboard) de un ladder por modo
  getLadderLeaderboard: async (ladderId: string, mode?: string): Promise<LadderRank[]> => {
    const filterStr = mode ? `ladder = "${ladderId}" && mode = "${mode}"` : `ladder = "${ladderId}"`;
    const records = await pb.collection('ladder_ranks').getFullList<LadderRank>({
      filter: filterStr,
      sort: '-ordinal_rating,-matches_played',
      expand: 'user',
    });
    return records;
  },

  // Obtener historial de partidos de un ladder por modo
  getLadderMatches: async (ladderId: string, mode?: string): Promise<LadderMatch[]> => {
    const filterStr = mode ? `ladder = "${ladderId}" && mode = "${mode}"` : `ladder = "${ladderId}"`;
    const records = await pb.collection('ladder_matches').getList<LadderMatch>(1, 50, {
      filter: filterStr,
      sort: '-created',
      expand: 'arbiter,team_red,team_blue',
    });
    return records.items.map((m: LadderMatch) => ({
      ...m,
      goal_history: typeof m.goal_history === 'string' ? JSON.parse(m.goal_history as any) : (m.goal_history || []),
      confirmations: typeof m.confirmations === 'string' ? JSON.parse(m.confirmations as any) : (m.confirmations || {}),
      openskill_changes: typeof m.openskill_changes === 'string' ? JSON.parse(m.openskill_changes as any) : m.openskill_changes,
    }));
  },

  // Obtener usuario por ID
  getUserById: async (userId: string) => {
    return await pb.collection('users').getOne(userId);
  },

  // Obtener historial de partidos de un jugador específico en un ladder
  getPlayerMatchesInLadder: async (ladderId: string, userId: string, mode?: string): Promise<LadderMatch[]> => {
    const filterStr = mode
      ? `ladder = "${ladderId}" && mode = "${mode}" && (team_red ~ "${userId}" || team_blue ~ "${userId}") && status = "confirmed"`
      : `ladder = "${ladderId}" && (team_red ~ "${userId}" || team_blue ~ "${userId}") && status = "confirmed"`;
    const records = await pb.collection('ladder_matches').getFullList<LadderMatch>({
      filter: filterStr,
      sort: '-created',
      expand: 'arbiter,team_red,team_blue',
    });
    return records.map((m: LadderMatch) => ({
      ...m,
      goal_history: typeof m.goal_history === 'string' ? JSON.parse(m.goal_history as any) : (m.goal_history || []),
      confirmations: typeof m.confirmations === 'string' ? JSON.parse(m.confirmations as any) : (m.confirmations || {}),
      openskill_changes: typeof m.openskill_changes === 'string' ? JSON.parse(m.openskill_changes as any) : m.openskill_changes,
    }));
  },

  // Crear un partido arbitrado en vivo
  submitArbitratedMatch: async (data: {
    ladderId: string;
    mode: '1v1' | '2v2';
    teamRed: string[];
    teamBlue: string[];
    scoreRed: number;
    scoreBlue: number;
    goalHistory: ('red' | 'blue')[];
  }): Promise<LadderMatch> => {
    const user = pb.authStore.model;
    if (!user) throw new Error('Debes estar autenticado para registrar un partido.');

    // Inicializar confirmación automática del árbitro si está en uno de los equipos
    const confirmations: Record<string, string> = {};
    if (data.teamRed.includes(user.id) || data.teamBlue.includes(user.id)) {
      confirmations[user.id] = 'accepted';
    }

    const payload = {
      ladder: data.ladderId,
      arbiter: user.id,
      mode: data.mode,
      team_red: data.teamRed,
      team_blue: data.teamBlue,
      score_red: data.scoreRed,
      score_blue: data.scoreBlue,
      goal_history: JSON.stringify(data.goalHistory),
      status: 'pending_confirmation',
      confirmations: JSON.stringify(confirmations),
    };

    const record = await pb.collection('ladder_matches').create<LadderMatch>(payload);

    // Notificar a todos los jugadores involucrados (excepto al árbitro que lo creó)
    const allPlayers = [...new Set([...data.teamRed, ...data.teamBlue])].filter((id) => id !== user.id);
    for (const recipientId of allPlayers) {
      try {
        await pb.collection('notifications').create({
          user: recipientId,
          sender: user.id,
          type: 'ladder_match',
          title: 'Resultado de partido propuesto',
          body: `Se propuso un resultado (${data.scoreRed} - ${data.scoreBlue}). Toca para revisar y responder.`,
          relatedId: record.id,
        });
      } catch (err) {
        console.error('Error creating match notification:', err);
      }
    }

    return record;
  },

  // Responder a la confirmación de un partido (Aceptar / Rechazar)
  respondToMatchConfirmation: async (matchId: string, decision: 'accepted' | 'rejected'): Promise<LadderMatch> => {
    const user = pb.authStore.model;
    if (!user) throw new Error('Debes estar autenticado para responder.');

    const match = await pb.collection('ladder_matches').getOne<LadderMatch>(matchId);
    let currentConfirmations: Record<string, string> = {};
    try {
      currentConfirmations = typeof match.confirmations === 'string' ? JSON.parse(match.confirmations as any) : (match.confirmations || {});
    } catch (e) {}

    currentConfirmations[user.id] = decision;

    if (decision === 'rejected') {
      const updated = await pb.collection('ladder_matches').update<LadderMatch>(matchId, {
        status: 'rejected',
        confirmations: JSON.stringify(currentConfirmations),
      });
      return updated;
    }

    // Verificar si todos los integrantes requeridos han aceptado
    const allParticipants = [...new Set([...match.team_red, ...match.team_blue])];
    const allAccepted = allParticipants.every((pid) => currentConfirmations[pid] === 'accepted');

    const updatePayload: any = {
      confirmations: JSON.stringify(currentConfirmations),
    };

    if (allAccepted) {
      updatePayload.status = 'confirmed';
    }

    const updatedMatch = await pb.collection('ladder_matches').update<LadderMatch>(matchId, updatePayload);

    // Si el partido se confirmó totalmente, actualizar rankings ELO
    if (allAccepted) {
      await updateRanksForMatch(updatedMatch);
    }

    return updatedMatch;
  },
};

async function updateRanksForMatch(match: LadderMatch) {
  const ladderId = match.ladder;
  const matchMode = match.mode || '1v1';
  const redWon = match.score_red > match.score_blue;
  const blueWon = match.score_blue > match.score_red;

  const redPlayers = match.team_red || [];
  const bluePlayers = match.team_blue || [];

  const updatePlayerRank = async (userId: string, isWinner: boolean) => {
    try {
      const records = await pb.collection('ladder_ranks').getList(1, 1, {
        filter: `ladder = "${ladderId}" && user = "${userId}" && mode = "${matchMode}"`,
      });

      let rankRecord = records.items[0];
      const deltaElo = isWinner ? 16 : -10;

      if (rankRecord) {
        const rawElo = rankRecord.ordinal_rating;
        const currentElo = typeof rawElo === 'number' && rawElo > 100 ? rawElo : 1200;
        await pb.collection('ladder_ranks').update(rankRecord.id, {
          matches_played: (rankRecord.matches_played || 0) + 1,
          wins: (rankRecord.wins || 0) + (isWinner ? 1 : 0),
          losses: (rankRecord.losses || 0) + (isWinner ? 0 : 1),
          ordinal_rating: Math.max(100, currentElo + deltaElo),
        });
      } else {
        await pb.collection('ladder_ranks').create({
          ladder: ladderId,
          user: userId,
          mode: matchMode,
          matches_played: 1,
          wins: isWinner ? 1 : 0,
          losses: isWinner ? 0 : 1,
          ordinal_rating: Math.max(100, 1200 + deltaElo),
        });
      }
    } catch (err) {
      console.error('Error updating player rank for match:', userId, err);
    }
  };

  for (const pid of redPlayers) {
    await updatePlayerRank(pid, redWon);
  }

  for (const pid of bluePlayers) {
    await updatePlayerRank(pid, blueWon);
  }
}
