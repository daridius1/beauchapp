import { pb } from './pocketbase';
import { LeagueMatch, OrgAccountRef } from '../types/league';
import { MatchEvent } from '../utils/matchEvents';

// Lectura pública de ligas — lo que ve alguien sin cuenta.
//
// No usa las colecciones directamente: sus reglas siguen exigiendo sesión, y abrirlas
// habría expuesto todas las cuentas de estudiante para poder mostrar un nombre de
// equipo. El backend devuelve por estos endpoints solo la identidad visible de equipos
// y ligas (ver public_league.pb.js).

export interface PublicReport {
  id: string;
  match: string;
  status: string;
  events: MatchEvent[];
  notes?: string;
}

export interface PublicLeagueData {
  league: OrgAccountRef;
  bio?: string;
  stages: { id: string; name: string; type: 'groups' | 'knockout'; order: number; teams: string[] }[];
  teams: { id: string; team: string; expand?: { team?: OrgAccountRef } }[];
  matches: LeagueMatch[];
  reports: PublicReport[];
}

export interface PublicTeamData {
  team: OrgAccountRef;
  bio?: string;
  players: { id: string; collectionId: string; name: string; photo?: string }[];
  matches: LeagueMatch[];
}

export interface PublicPlayer {
  id: string;
  collectionId: string;
  name: string;
  photo?: string;
}

export interface PublicMatchData {
  match: LeagueMatch;
  league: OrgAccountRef | null;
  stageName: string;
  report: PublicReport | null;
  rosterA: PublicPlayer[];
  rosterB: PublicPlayer[];
}

// Solo la predicción de Beaumarket de un partido, sin sesión — ver
// GET /api/public/match-beaumarket. `hasMarket: false` cuando el partido no tiene
// ningún mercado enlazado (la liga no tiene la opción habilitada, o el partido es
// anterior a esta funcionalidad).
export type PublicMatchBeaumarket =
  | { hasMarket: false }
  | {
      hasMarket: true;
      outcomes: string[];
      prices: number[];
      status: 'open' | 'closed' | 'resolved' | 'cancelled';
      winningOutcomeIndex: number | null;
    };

export const publicLeagueService = {
  async listLeagues(): Promise<OrgAccountRef[]> {
    const res: any = await pb.send('/api/public/leagues', { method: 'GET' });
    return res.leagues || [];
  },

  async getLeague(leagueId: string): Promise<PublicLeagueData> {
    return await pb.send('/api/public/liga', { method: 'GET', query: { id: leagueId } });
  },

  async getMatch(matchId: string): Promise<PublicMatchData> {
    return await pb.send('/api/public/match', { method: 'GET', query: { id: matchId } });
  },

  async getMatchBeaumarket(matchId: string): Promise<PublicMatchBeaumarket> {
    return await pb.send('/api/public/match-beaumarket', { method: 'GET', query: { id: matchId } });
  },

  async getTeam(teamId: string): Promise<PublicTeamData> {
    return await pb.send('/api/public/team', { method: 'GET', query: { id: teamId } });
  },
};
