import { pb } from './pocketbase';
import { PollaPick } from '../utils/polla';
import { LeagueMatch, OrgAccountRef } from '../types/league';

// Acceso a las apuestas de la Beaupolla.
//
// El SECRETO no se implementa acá: lo impone la regla de `polla_bets` (solo deja leer
// apuestas ajenas de partidos ya cerrados, ver la migración 1787400100). Este servicio
// simplemente pide lo que corresponda — si pide de más, el servidor devuelve de menos,
// que es exactamente la propiedad que se quiere.

export interface PollaBet {
  id: string;
  league: string;
  match: string;
  user: string;
  pick: PollaPick;
  created: string;
  updated: string;
  expand?: {
    user?: OrgAccountRef;
    match?: LeagueMatch;
  };
}

export const pollaService = {
  /** Todas las apuestas de la liga que este usuario tiene permitido ver. */
  async listVisibleBets(leagueId: string): Promise<PollaBet[]> {
    try {
      return await pb.collection('polla_bets').getFullList<PollaBet>({
        filter: `league = "${leagueId}"`,
        expand: 'user',
        batch: 500,
      });
    } catch (err) {
      console.error('Error cargando las apuestas de la polla:', err);
      return [];
    }
  },

  /** Las apuestas de un partido. Si todavía no cerró, el servidor solo devuelve la
   *  propia — el vacío es la respuesta correcta, no un error. */
  async listMatchBets(matchId: string): Promise<PollaBet[]> {
    try {
      return await pb.collection('polla_bets').getFullList<PollaBet>({
        filter: `match = "${matchId}"`,
        expand: 'user',
        batch: 500,
      });
    } catch (err) {
      console.error('Error cargando las apuestas del partido:', err);
      return [];
    }
  },

  /** Las apuestas de una persona en esta liga. El servidor recorta las secretas. */
  async listUserBets(leagueId: string, userId: string): Promise<PollaBet[]> {
    try {
      return await pb.collection('polla_bets').getFullList<PollaBet>({
        filter: `league = "${leagueId}" && user = "${userId}"`,
        batch: 500,
      });
    } catch (err) {
      console.error('Error cargando las apuestas de esa persona:', err);
      return [];
    }
  },

  /**
   * Guarda la apuesta de un partido. Crea o actualiza según ya exista.
   * `league` lo recalcula el hook a partir del partido, así que lo que se mande acá
   * es solo para que la regla de creación pueda validarlo.
   */
  async savePick(leagueId: string, matchId: string, userId: string, pick: PollaPick): Promise<PollaBet> {
    let existing: PollaBet | null = null;
    try {
      existing = await pb
        .collection('polla_bets')
        .getFirstListItem<PollaBet>(`match = "${matchId}" && user = "${userId}"`);
    } catch (err) {
      existing = null;
    }

    if (existing) {
      return await pb.collection('polla_bets').update<PollaBet>(existing.id, { pick });
    }
    return await pb.collection('polla_bets').create<PollaBet>({
      league: leagueId,
      match: matchId,
      user: userId,
      pick,
    });
  },
};
