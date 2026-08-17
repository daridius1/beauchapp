// Réplica en TypeScript de backend/pb_hooks/lib/matchEvents.js — mismo motivo que el
// resto de lógica duplicada entre el servidor (goja) y el cliente en este proyecto:
// son runtimes distintos. El marcador/tarjetas/convocatoria NUNCA se guardan sueltos,
// siempre se derivan de `events` — así "deshacer" es solo sacar el último elemento.

export type Team = 'A' | 'B';

export type MatchEvent =
  | { type: 'lineup'; team: Team; players: string[]; at: string }
  | { type: 'half_start'; half: 1 | 2; at: string }
  | { type: 'half_end'; half: 1 | 2; at: string }
  | { type: 'goal'; team: Team; player: string; ownGoal: boolean; at: string; minute?: number; half?: 1 | 2 }
  | { type: 'yellow_card'; team: Team; player: string; at: string; minute?: number; half?: 1 | 2 }
  | { type: 'red_card'; team: Team; player: string; at: string; minute?: number; half?: 1 | 2 }
  | { type: 'penalty'; team: Team; player: string; scored: boolean; at: string; minute?: number; half?: 1 | 2 };

export interface MatchSummary {
  scoreA: number;
  scoreB: number;
  cardsA: { yellow: number; red: number };
  cardsB: { yellow: number; red: number };
  lineupA: string[];
  lineupB: string[];
  goals: Array<MatchEvent & { type: 'goal'; scoringTeam: Team }>;
  cards: Array<MatchEvent & { type: 'yellow_card' | 'red_card' }>;
  penalties: Array<MatchEvent & { type: 'penalty' }>;
  currentHalf: number;
  halfStarted: { 1: boolean; 2: boolean };
  halfEnded: { 1: boolean; 2: boolean };
}

export function summarizeEvents(events: MatchEvent[] | undefined | null): MatchSummary {
  const list = Array.isArray(events) ? events : [];

  let scoreA = 0;
  let scoreB = 0;
  const cardsA = { yellow: 0, red: 0 };
  const cardsB = { yellow: 0, red: 0 };
  let lineupA: string[] = [];
  let lineupB: string[] = [];
  const goals: MatchSummary['goals'] = [];
  const cards: MatchSummary['cards'] = [];
  const penalties: MatchSummary['penalties'] = [];
  let currentHalf = 0;
  const halfStarted = { 1: false, 2: false };
  const halfEnded = { 1: false, 2: false };

  for (const ev of list) {
    if (ev.type === 'lineup') {
      if (ev.team === 'A') lineupA = ev.players;
      else lineupB = ev.players;
    } else if (ev.type === 'half_start') {
      halfStarted[ev.half] = true;
      currentHalf = ev.half;
    } else if (ev.type === 'half_end') {
      halfEnded[ev.half] = true;
    } else if (ev.type === 'goal') {
      const scoringTeam: Team = ev.ownGoal ? (ev.team === 'A' ? 'B' : 'A') : ev.team;
      if (scoringTeam === 'A') scoreA++;
      else scoreB++;
      goals.push({ ...ev, scoringTeam });
    } else if (ev.type === 'yellow_card') {
      (ev.team === 'A' ? cardsA : cardsB).yellow++;
      cards.push(ev);
    } else if (ev.type === 'red_card') {
      (ev.team === 'A' ? cardsA : cardsB).red++;
      cards.push(ev);
    } else if (ev.type === 'penalty') {
      if (ev.scored) {
        if (ev.team === 'A') scoreA++;
        else scoreB++;
      }
      penalties.push(ev);
    }
  }

  return { scoreA, scoreB, cardsA, cardsB, lineupA, lineupB, goals, cards, penalties, currentHalf, halfStarted, halfEnded };
}
