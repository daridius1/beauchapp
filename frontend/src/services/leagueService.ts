import { pb } from './pocketbase';
import { publicLeagueService } from './publicLeagueService';
import { MatchEvent, MatchSummary, eventKey } from '../utils/matchEvents';
import { LeagueMatch, LeagueStage, LeagueTeam, MatchReport } from '../types/league';

// Capa de acceso a las rutas y colecciones de ligas y arbitraje.
//
// Existía como llamadas sueltas a `pb.send`/`pb.collection` repartidas por las
// pantallas, mientras features contemporáneos (teamPlayersService, beaumarketService)
// sí tenían servicio propio. Ver auditoria-2026-08-19.md §5.3.
//
// Todos los endpoints de arbitraje comparten la misma forma: { matchId, code, ... }.
// El `code` es la autorización mientras el partido está en juego; una vez finalizado
// el servidor solo acepta a la cuenta de la liga dueña (auditoria §4.4).

export interface EventsPushResult {
  success: boolean;
  summary: MatchSummary;
  /** Bitácora YA fusionada con lo que hayan subido otros árbitros en paralelo.
   *  Adoptarla es lo que mantiene alineados al cliente y al servidor. */
  events?: MatchEvent[];
}

export const leagueService = {
  // ----- Arbitraje -----

  /** Verifica el código de un partido sin escribir nada. */
  async joinMatch(matchId: string, code: string): Promise<void> {
    await pb.send('/api/league-matches/join', { method: 'POST', body: { matchId, code } });
  },

  /**
   * Sube la bitácora local. `baseKeys` son las claves del último estado del servidor
   * que este cliente vio: sin ellas el servidor no puede distinguir un evento borrado
   * a propósito de uno que este cliente todavía no conocía, y degrada a unión pura.
   */
  async pushEvents(
    matchId: string,
    code: string,
    events: MatchEvent[],
    baseKeys: string[]
  ): Promise<EventsPushResult> {
    return await pb.send('/api/league-matches/events', {
      method: 'POST',
      body: { matchId, code, events, baseKeys },
    });
  },

  async saveNotes(matchId: string, code: string, notes: string): Promise<void> {
    await pb.send('/api/league-matches/notes', { method: 'POST', body: { matchId, code, notes } });
  },

  /** Cierra el partido y hace oficial el marcador. Solo durante el partido en vivo. */
  async submitMatch(matchId: string, code: string): Promise<{ scoreA: number; scoreB: number }> {
    return await pb.send('/api/league-matches/submit', { method: 'POST', body: { matchId, code } });
  },

  /** Claves de una bitácora, en el formato que espera `pushEvents`. */
  baseKeysOf(events: MatchEvent[]): string[] {
    return events.map(eventKey);
  },

  // ----- Lectura -----

  // Sin sesión se lee por el endpoint público: arbitrar no exige cuenta (la
  // autorización es el código del partido), pero las colecciones siguen cerradas.
  async getMatch(matchId: string, expand?: string): Promise<LeagueMatch> {
    if (!pb.authStore.isValid) {
      return (await publicLeagueService.getMatch(matchId)).match;
    }
    return await pb.collection('league_matches').getOne<LeagueMatch>(matchId, expand ? { expand } : undefined);
  },

  async getReport(reportId: string): Promise<MatchReport> {
    return await pb.collection('match_reports').getOne<MatchReport>(reportId);
  },

  /** Planteles de ambos equipos de un partido, funcione o no la sesión. */
  async getMatchRosters(matchId: string): Promise<{ rosterA: any[]; rosterB: any[] } | null> {
    if (pb.authStore.isValid) return null;
    const data = await publicLeagueService.getMatch(matchId);
    return { rosterA: data.rosterA || [], rosterB: data.rosterB || [] };
  },

  /** Informe vigente de un partido, o null si todavía nadie lo arbitró. */
  async findReportForMatch(matchId: string): Promise<MatchReport | null> {
    try {
      if (!pb.authStore.isValid) {
        return ((await publicLeagueService.getMatch(matchId)).report as any) || null;
      }
      return await pb
        .collection('match_reports')
        .getFirstListItem<MatchReport>(`match = "${matchId}" && deleted = false`);
    } catch (err) {
      return null;
    }
  },

  async listStages(leagueId: string): Promise<LeagueStage[]> {
    return await pb.collection('league_stages').getFullList<LeagueStage>({
      filter: `league = "${leagueId}" && deleted = false`,
      sort: 'order,created',
    });
  },

  async listLeagueTeams(leagueId: string): Promise<LeagueTeam[]> {
    return await pb.collection('league_teams').getFullList<LeagueTeam>({
      filter: `league = "${leagueId}" && deleted = false`,
      expand: 'team',
    });
  },

  async listStageMatches(stageId: string): Promise<LeagueMatch[]> {
    return await pb.collection('league_matches').getFullList<LeagueMatch>({
      filter: `stage = "${stageId}" && deleted = false`,
      expand: 'teamA,teamB',
      sort: 'blockCode',
    });
  },
};
