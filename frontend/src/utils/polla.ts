// Réplica en TypeScript de backend/pb_hooks/lib/polla.js, donde vive la versión
// testeada. Mismo motivo que utils/matchEvents.ts: son runtimes distintos.
//
// El puntaje no se guarda en ningún lado — se deriva de los marcadores y las apuestas
// que la vista ya tiene cargados (PRINCIPLES.md §1).

export type PollaPick = 'home' | 'draw' | 'away';

export const PICKS: PollaPick[] = ['home', 'draw', 'away'];

// Acertar el empate vale el doble: es el resultado más difícil de predecir.
export const POINTS_WINNER = 1;
export const POINTS_DRAW = 2;

export const CLOSE_MINUTES_BEFORE = 10;

export const PICK_LABELS: Record<PollaPick, string> = {
  home: 'Local',
  draw: 'Empate',
  away: 'Visita',
};

export function isValidPick(pick: unknown): pick is PollaPick {
  return PICKS.includes(pick as PollaPick);
}

export function outcomeOf(scoreA?: number | null, scoreB?: number | null): PollaPick {
  const a = Number(scoreA) || 0;
  const b = Number(scoreB) || 0;
  if (a > b) return 'home';
  if (b > a) return 'away';
  return 'draw';
}

export function pickPoints(pick: unknown, scoreA?: number | null, scoreB?: number | null): number {
  if (!isValidPick(pick)) return 0;
  const outcome = outcomeOf(scoreA, scoreB);
  if (pick !== outcome) return 0;
  return outcome === 'draw' ? POINTS_DRAW : POINTS_WINNER;
}

// Un partido sin fecha de cierre se trata como CERRADO: es el lado seguro — ni se
// apuesta ni se muestran apuestas ajenas por un dato faltante.
export function isBettingClosed(bettingClosesAt?: string | null, nowMs?: number): boolean {
  if (!bettingClosesAt) return true;
  const closes = new Date(bettingClosesAt).getTime();
  if (isNaN(closes)) return true;
  return (nowMs === undefined ? Date.now() : nowMs) >= closes;
}

export interface PollaLeaderboardRow {
  userId: string;
  name: string;
  username: string;
  avatar: string | null;
  points: number;
  hits: number;
  bets: number;
  resolved: number;
}

interface ScoredMatch {
  id: string;
  status: string;
  scoreA?: number | null;
  scoreB?: number | null;
}

interface SimpleBet {
  user: string;
  match: string;
  pick: string;
}

export function computePollaLeaderboard(
  matches: ScoredMatch[] | null | undefined,
  bets: SimpleBet[] | null | undefined,
  usersById?: Record<string, { name?: string; username?: string; avatar?: string | null }>
): PollaLeaderboardRow[] {
  const matchById: Record<string, ScoredMatch> = {};
  (Array.isArray(matches) ? matches : []).forEach((m) => {
    if (m && m.id) matchById[m.id] = m;
  });

  const byUser: Record<string, PollaLeaderboardRow> = {};
  (Array.isArray(bets) ? bets : []).forEach((bet) => {
    if (!bet || !bet.user) return;
    if (!byUser[bet.user]) {
      const info = (usersById && usersById[bet.user]) || {};
      byUser[bet.user] = {
        userId: bet.user,
        name: info.name || info.username || '',
        username: info.username || '',
        avatar: info.avatar || null,
        points: 0,
        hits: 0,
        bets: 0,
        resolved: 0,
      };
    }
    const row = byUser[bet.user];
    row.bets += 1;

    const match = matchById[bet.match];
    if (!match || match.status !== 'played') return;

    row.resolved += 1;
    const points = pickPoints(bet.pick, match.scoreA, match.scoreB);
    if (points > 0) {
      row.points += points;
      row.hits += 1;
    }
  });

  return Object.values(byUser).sort(
    (a, b) =>
      b.points - a.points ||
      b.hits - a.hits ||
      String(a.name || a.username).localeCompare(String(b.name || b.username))
  );
}

// Réplica de pickVisual/cardOutcome de backend/pb_hooks/lib/polla.js, donde está la
// versión testeada con los seis casos. Es una máquina de estados de presentación: cada
// caso tiene que quedar distinguible SOLO con color, sin agregar texto ni elementos.
export type PickVisual = 'neutral' | 'mine' | 'hit' | 'miss' | 'result' | 'dim';

export function pickVisual(
  pick: PollaPick,
  myPick: PollaPick | undefined,
  result: PollaPick | null,
  closed: boolean
): PickVisual {
  const isMine = !!myPick && pick === myPick;
  const isResult = !!result && pick === result;

  if (!result) {
    if (isMine) return 'mine';
    return closed ? 'dim' : 'neutral';
  }

  if (isMine && isResult) return 'hit';
  if (isMine) return 'miss';
  if (isResult) return 'result';
  return 'dim';
}

export type CardOutcome = 'none' | 'hit' | 'miss';

export function cardOutcome(myPick: PollaPick | undefined, result: PollaPick | null): CardOutcome {
  if (!result || !myPick) return 'none';
  return myPick === result ? 'hit' : 'miss';
}
