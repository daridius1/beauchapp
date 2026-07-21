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

  // Obtener la tabla de posiciones (Leaderboard) de un ladder
  getLadderLeaderboard: async (ladderId: string): Promise<LadderRank[]> => {
    const records = await pb.collection('ladder_ranks').getFullList<LadderRank>({
      filter: `ladder = "${ladderId}"`,
      sort: '-ordinal_rating,-matches_played',
      expand: 'user',
    });
    return records;
  },

  // Obtener historial de partidos de un ladder
  getLadderMatches: async (ladderId: string): Promise<LadderMatch[]> => {
    const records = await pb.collection('ladder_matches').getList<LadderMatch>(1, 50, {
      filter: `ladder = "${ladderId}"`,
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

    const updated = await pb.collection('ladder_matches').update<LadderMatch>(matchId, {
      confirmations: JSON.stringify(currentConfirmations),
    });

    return updated;
  },
};
