// Tipos de las colecciones de ligas, horarios y arbitraje.
//
// Existen para frenar el goteo de `any` en el código más nuevo: las pantallas de liga
// se escribieron manejando los registros de PocketBase como `any`, que es lo que hace
// que `tsc` pase en verde sin que los tipos aporten nada. Ver auditoria-2026-08-19.md §4.8.
//
// Convención heredada de types/ladder.ts: los campos que PocketBase siempre devuelve
// (id, created, updated) son obligatorios; `expand` es opcional y refleja exactamente
// lo que pide cada consulta.

import { MatchEvent } from '../utils/matchEvents';

/** Cuenta de organización que actúa como equipo o como liga. No hay colección aparte:
 *  la cuenta de usuario ES la liga/el equipo (ver la cabecera de league.pb.js). */
export interface OrgAccountRef {
  id: string;
  name?: string;
  username?: string;
  avatar?: string;
  type?: 'student' | 'organization';
  subtype?: 'center' | 'team' | 'community' | 'band' | 'organization' | 'league';
  verified?: boolean;
}

export type LeagueStageType = 'groups' | 'knockout';

export interface LeagueStage {
  id: string;
  league: string;
  name: string;
  type: LeagueStageType;
  order: number;
  deleted?: boolean;
  created: string;
  updated: string;
}

export interface LeagueTeam {
  id: string;
  league: string;
  team: string;
  deleted?: boolean;
  created: string;
  updated: string;
  expand?: {
    team?: OrgAccountRef;
    league?: OrgAccountRef;
  };
}

export type LeagueMatchStatus = 'confirmed' | 'played' | 'suspended' | 'cancelled';

export interface LeagueMatch {
  id: string;
  league: string;
  stage: string;
  teamA: string;
  teamB: string;
  /** Bloque horario "YYYY-MM-DD-HH". El orden lexicográfico es el cronológico. */
  blockCode: string;
  status: LeagueMatchStatus;
  scoreA?: number;
  scoreB?: number;
  /** Código de arbitraje de 6 caracteres. Solo sirve mientras el partido está
   *  'confirmed'; una vez 'played' únicamente la liga dueña puede corregir el informe. */
  code?: string;
  happinessA?: number;
  happinessB?: number;
  gap?: number;
  /** Instante en que se cierran las apuestas de la Beaupolla para este partido:
   *  10 minutos antes del bloque agendado, o el momento en que el partido arranca
   *  en la vista de arbitraje — lo que ocurra primero. Ver lib/polla.js. */
  bettingClosesAt?: string;
  deleted?: boolean;
  created: string;
  updated: string;
  expand?: {
    teamA?: OrgAccountRef;
    teamB?: OrgAccountRef;
    stage?: LeagueStage;
    league?: OrgAccountRef;
  };
}

export type MatchReportStatus = 'in_progress' | 'submitted' | 'approved' | 'rejected';

export interface MatchReport {
  id: string;
  match: string;
  /** Quien ABRIÓ la sesión de arbitraje (primer push). No cambia después. */
  referee: string;
  /** Bitácora completa: marcador, tarjetas y convocatoria se derivan de acá, nunca
   *  se guardan sueltos. El servidor la fusiona, no la sobrescribe. */
  events: MatchEvent[];
  status: MatchReportStatus;
  notes?: string;
  /** Última corrección hecha sobre un informe ya oficial, y por quién. */
  amendedBy?: string;
  amendedAt?: string;
  deleted?: boolean;
  created: string;
  updated: string;
  expand?: {
    referee?: OrgAccountRef;
    amendedBy?: OrgAccountRef;
    match?: LeagueMatch;
  };
}

/** Escala 1-5 por bloque horario. Un equipo que nunca respondió cuenta como "Regular"
 *  (2) en todos los bloques — no existe "disponibilidad no enviada". */
export type HappinessMap = Record<string, number>;

export interface HorarioAvailability {
  id: string;
  /** Quién envía: equipo o jugador individual (el nombre del campo es heredado). */
  team: string;
  happiness: HappinessMap;
  created: string;
  updated: string;
}

export interface HorarioBlockedSlot {
  id: string;
  blockCode: string;
  created: string;
  updated: string;
}

export interface HorarioMatch {
  id: string;
  blockCode: string;
  status: string;
  created: string;
  updated: string;
}
