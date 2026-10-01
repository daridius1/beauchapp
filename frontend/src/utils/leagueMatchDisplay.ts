import { LeagueMatch } from '../types/league';

export type LeagueMatchDisplayStatus =
  | 'live'
  | 'awaiting_result'
  | 'scheduled'
  | 'played'
  | 'suspended'
  | 'cancelled';

// Los bloques de la agenda duran una hora. Recién al terminar el bloque se puede
// afirmar que el partido ya debió jugarse; durante esa hora todavía figura por jugar
// salvo que exista una bitácora en vivo.
export const MATCH_BLOCK_DURATION_MS = 60 * 60 * 1000;

export function blockCodeTimestamp(code: string): number {
  if (!/^\d{4}-\d{2}-\d{2}-\d{2}$/.test(code)) return NaN;
  const hour = Number(code.slice(-2));
  const [year, month, day] = code.slice(0, -3).split('-').map(Number);
  const timestamp = new Date(year, month - 1, day, hour).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

interface DisplayStatusOptions {
  isLive?: boolean;
  hasReport?: boolean;
  nowMs?: number;
}

export function leagueMatchDisplayStatus(
  match: Pick<LeagueMatch, 'status' | 'blockCode'>,
  { isLive = false, hasReport = false, nowMs = Date.now() }: DisplayStatusOptions = {}
): LeagueMatchDisplayStatus {
  if (isLive) return 'live';
  if (match.status === 'played') return 'played';
  if (match.status === 'suspended') return 'suspended';
  if (match.status === 'cancelled') return 'cancelled';

  const startMs = blockCodeTimestamp(match.blockCode);
  if (
    match.status === 'confirmed' &&
    !hasReport &&
    Number.isFinite(startMs) &&
    nowMs >= startMs + MATCH_BLOCK_DURATION_MS
  ) {
    return 'awaiting_result';
  }

  return 'scheduled';
}

const STATUS_PRIORITY: Record<LeagueMatchDisplayStatus, number> = {
  live: 0,
  awaiting_result: 1,
  scheduled: 2,
  played: 3,
  suspended: 4,
  cancelled: 5,
};

interface SortMatchesOptions {
  liveMatchIds?: ReadonlySet<string>;
  reportMatchIds?: ReadonlySet<string>;
  nowMs?: number;
}

/** Ordena primero por el estado que ve la persona y luego por fecha. Los partidos
 *  futuros van del próximo al más lejano; los estados pasados, del más reciente al
 *  más antiguo. */
export function sortLeagueMatchesForDisplay<T extends Pick<LeagueMatch, 'id' | 'status' | 'blockCode'>>(
  matches: T[],
  { liveMatchIds = new Set(), reportMatchIds = new Set(), nowMs = Date.now() }: SortMatchesOptions = {}
): T[] {
  const displayStatus = (match: T) => leagueMatchDisplayStatus(match, {
    isLive: liveMatchIds.has(match.id),
    hasReport: reportMatchIds.has(match.id),
    nowMs,
  });

  return [...matches].sort((a, b) => {
    const statusA = displayStatus(a);
    const statusB = displayStatus(b);
    const priorityDiff = STATUS_PRIORITY[statusA] - STATUS_PRIORITY[statusB];
    if (priorityDiff !== 0) return priorityDiff;

    const timeA = blockCodeTimestamp(a.blockCode);
    const timeB = blockCodeTimestamp(b.blockCode);
    if (!Number.isFinite(timeA)) return Number.isFinite(timeB) ? 1 : a.id.localeCompare(b.id);
    if (!Number.isFinite(timeB)) return -1;

    const chronological = timeA - timeB;
    if (chronological !== 0) {
      return statusA === 'scheduled' || statusA === 'live' ? chronological : -chronological;
    }
    return a.id.localeCompare(b.id);
  });
}

export function isAwaitingLeagueMatchResult(
  match: Pick<LeagueMatch, 'status' | 'blockCode'>,
  options?: DisplayStatusOptions
): boolean {
  return leagueMatchDisplayStatus(match, options) === 'awaiting_result';
}
