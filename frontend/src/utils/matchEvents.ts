// Réplica en TypeScript de backend/pb_hooks/lib/matchEvents.js — mismo motivo que el
// resto de lógica duplicada entre el servidor (goja) y el cliente en este proyecto:
// son runtimes distintos. El marcador/tarjetas/convocatoria/reloj NUNCA se guardan
// sueltos, siempre se derivan de `events` — así eliminar cualquier evento puntual es
// trivial (sacarlo del arreglo) y el arbitraje es resiliente por construcción.

export type Team = 'A' | 'B';

// Un elemento de `lineup.players` es o bien un string suelto (partidos de antes de
// que existiera el roster de equipo) o un objeto apuntando a un team_players
// (partidos nuevos) — ambas formas conviven en `MatchEvent`, nunca se migran los
// eventos ya guardados. `LineupEntry` es la forma NORMALIZADA que devuelve
// `summarizeEvents` — todo consumidor trabaja siempre con esta, nunca con las dos
// formas crudas por separado.
export interface LineupPlayer {
  playerId?: string;
  name: string;
  photo?: string;
}
export interface LineupEntry {
  playerId: string | null;
  name: string;
  photo: string | null;
}

export type MatchEvent =
  | { type: 'lineup'; team: Team; players: (string | LineupPlayer)[]; at: string }
  | { type: 'half_start'; half: 1 | 2; at: string }
  | { type: 'half_end'; half: 1 | 2; at: string }
  | { type: 'pause'; at: string }
  | { type: 'resume'; at: string }
  | { type: 'goal'; team: Team; player?: string; playerId?: string; ownGoal: boolean; at: string; minute?: number; half?: 1 | 2 }
  | { type: 'yellow_card'; team: Team; player?: string; playerId?: string; at: string; minute?: number; half?: 1 | 2 }
  | { type: 'red_card'; team: Team; player?: string; playerId?: string; at: string; minute?: number; half?: 1 | 2 }
  | { type: 'penalty'; team: Team; player?: string; playerId?: string; scored: boolean; at: string; minute?: number; half?: 1 | 2 };

export const CLOCK_GATED_TYPES: MatchEvent['type'][] = ['goal', 'yellow_card', 'red_card', 'penalty'];

// Réplica de matchEvents.js — normaliza un elemento de lineup.players a la forma
// uniforme LineupEntry, sin importar el formato en que haya quedado guardado.
export function normalizeLineupEntry(p: string | LineupPlayer): LineupEntry {
  if (typeof p === 'string') return { playerId: null, name: p, photo: null };
  return { playerId: p.playerId || null, name: p.name, photo: p.photo || null };
}

export interface MatchSummary {
  scoreA: number;
  scoreB: number;
  cardsA: { yellow: number; red: number };
  cardsB: { yellow: number; red: number };
  lineupA: LineupEntry[];
  lineupB: LineupEntry[];
  goals: Array<MatchEvent & { type: 'goal'; scoringTeam: Team }>;
  cards: Array<MatchEvent & { type: 'yellow_card' | 'red_card' }>;
  penalties: Array<MatchEvent & { type: 'penalty' }>;
  currentHalf: number;
  halfStarted: { 1: boolean; 2: boolean };
  halfEnded: { 1: boolean; 2: boolean };
  clockRunning: boolean;
}

export function summarizeEvents(events: MatchEvent[] | undefined | null): MatchSummary {
  const list = Array.isArray(events) ? events : [];

  let scoreA = 0;
  let scoreB = 0;
  const cardsA = { yellow: 0, red: 0 };
  const cardsB = { yellow: 0, red: 0 };
  let lineupA: LineupEntry[] = [];
  let lineupB: LineupEntry[] = [];
  const goals: MatchSummary['goals'] = [];
  const cards: MatchSummary['cards'] = [];
  const penalties: MatchSummary['penalties'] = [];
  let currentHalf = 0;
  const halfStarted = { 1: false, 2: false };
  const halfEnded = { 1: false, 2: false };
  let clockRunning = false;

  for (const ev of list) {
    if (ev.type === 'lineup') {
      const normalized = ev.players.map(normalizeLineupEntry);
      if (ev.team === 'A') lineupA = normalized;
      else lineupB = normalized;
    } else if (ev.type === 'half_start') {
      halfStarted[ev.half] = true;
      currentHalf = ev.half;
      clockRunning = true;
    } else if (ev.type === 'half_end') {
      halfEnded[ev.half] = true;
      clockRunning = false;
    } else if (ev.type === 'pause') {
      clockRunning = false;
    } else if (ev.type === 'resume') {
      clockRunning = true;
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

  return {
    scoreA,
    scoreB,
    cardsA,
    cardsB,
    lineupA,
    lineupB,
    goals,
    cards,
    penalties,
    currentHalf,
    halfStarted,
    halfEnded,
    clockRunning,
  };
}

// ¿Todo evento de jugada real (gol/tarjeta/penal) ocurre mientras el reloj estaba
// efectivamente corriendo? Réplica exacta del chequeo que hace el servidor — se corre
// también acá para dar feedback instantáneo antes de intentar guardar (p. ej. al
// eliminar un evento con la X, si el resultado quedaría en un estado inválido se
// avisa sin necesidad de un viaje al servidor).
export function isClockGatedSequenceValid(events: MatchEvent[]): boolean {
  let running = false;
  for (const ev of events) {
    if (ev.type === 'half_start' || ev.type === 'resume') {
      running = true;
    } else if (ev.type === 'half_end' || ev.type === 'pause') {
      running = false;
    } else if (CLOCK_GATED_TYPES.includes(ev.type)) {
      if (!running) return false;
    }
  }
  return true;
}

// Milisegundos de juego efectivo transcurridos en el tiempo ACTUAL (cada tiempo tiene
// su propio cronómetro, arranca de 0 en cada half_start), restando cualquier pausa —
// a diferencia de un simple "ahora - inicio del tiempo", esto no cuenta el rato en
// pausa/entretiempo como minutos jugados. `now` se pasa aparte (no Date.now() interno)
// para que el componente que llama controle el refresco.
export function computeLiveElapsedMs(events: MatchEvent[], now: number): { elapsedMs: number; running: boolean; half: number } {
  let elapsedMs = 0;
  let segmentStart: number | null = null;
  let half = 0;

  for (const ev of events) {
    if (ev.type === 'half_start') {
      half = ev.half;
      elapsedMs = 0; // cada tiempo es su propio cronómetro, no uno continuo
      segmentStart = new Date(ev.at).getTime();
    } else if (ev.type === 'half_end') {
      if (segmentStart !== null) elapsedMs += new Date(ev.at).getTime() - segmentStart;
      segmentStart = null;
    } else if (ev.type === 'pause') {
      if (segmentStart !== null) elapsedMs += new Date(ev.at).getTime() - segmentStart;
      segmentStart = null;
    } else if (ev.type === 'resume') {
      segmentStart = new Date(ev.at).getTime();
    }
  }

  const running = segmentStart !== null;
  const liveElapsedMs = running ? elapsedMs + Math.max(0, now - (segmentStart as number)) : elapsedMs;
  return { elapsedMs: liveElapsedMs, running, half };
}

// Duración reglamentaria de cada tiempo, en minutos — pasado esto se muestra como
// tiempo agregado (ej. "20+4'") en vez de seguir contando de corrido (ej. "24'"), igual
// que el fútbol real. Puramente de presentación, no afecta el cronómetro real (que sigue
// corriendo sin tope en `computeLiveElapsedMs`).
const REGULATION_MINUTES = 20;

function formatLiveMinute(elapsedMs: number): string {
  const minute = Math.floor(elapsedMs / 60000);
  if (minute > REGULATION_MINUTES) return `${REGULATION_MINUTES}+${minute - REGULATION_MINUTES}'`;
  return `${minute}'`;
}

export interface LiveStatus {
  // Lectura de minuto+tiempo ("35' · 1T") — solo tiene sentido cuando el reloj no está
  // en entretiempo, así que queda vacía en ese caso (el estado "Entretiempo" se muestra
  // aparte, arriba, no mezclado en esta misma línea).
  minuteLabel: string;
  running: boolean;
  isHalftime: boolean;
}

// Estado en vivo mostrado en las tarjetas/marcador — separado en piezas (no un solo
// string armado) para que quien lo consuma decida DÓNDE mostrar cada cosa: el estado
// (pausado/entretiempo) va arriba junto al resto de badges de estado (FINALIZADO,
// CANCELADO, etc.), el minuto+tiempo va abajo junto al marcador, nunca mezclados en la
// misma línea. Centralizado acá porque LeagueDetailScreen (lista) y
// LeagueMatchDetailScreen (partido individual) necesitan exactamente el mismo cálculo.
export function computeLiveStatus(summary: MatchSummary, elapsedMs: number, running: boolean): LiveStatus {
  const isHalftime = summary.halfEnded[1] && !summary.halfStarted[2];
  if (isHalftime) return { minuteLabel: '', running, isHalftime: true };
  return { minuteLabel: `${formatLiveMinute(elapsedMs)} · ${summary.currentHalf}T`, running, isHalftime: false };
}

export interface AnnotatedEvent {
  event: MatchEvent;
  index: number;
  half: number;
  relativeMs: number | null; // tiempo transcurrido en EL CRONÓMETRO DE ESE TIEMPO al momento del evento
}

// Recorre toda la bitácora y le calcula a cada evento cuánto había corrido el
// cronómetro de su propio tiempo en ese instante — se deriva siempre de `events`
// (nunca de un campo `minute` guardado suelto), así una vez arreglado un bug de
// cálculo el historial completo se corrige solo, sin tener que migrar datos viejos.
export function annotateEventsWithHalfTime(events: MatchEvent[]): AnnotatedEvent[] {
  const result: AnnotatedEvent[] = [];
  let elapsedMs = 0;
  let segmentStart: number | null = null;
  let half = 0;

  events.forEach((ev, index) => {
    const t = new Date(ev.at).getTime();

    if (ev.type === 'half_start') {
      half = ev.half;
      elapsedMs = 0;
      segmentStart = t;
      result.push({ event: ev, index, half, relativeMs: 0 });
      return;
    }

    let relativeMs: number | null = segmentStart !== null ? elapsedMs + Math.max(0, t - segmentStart) : half > 0 ? elapsedMs : null;

    if (ev.type === 'half_end' || ev.type === 'pause') {
      if (segmentStart !== null) elapsedMs += Math.max(0, t - segmentStart);
      segmentStart = null;
      relativeMs = elapsedMs;
    } else if (ev.type === 'resume') {
      segmentStart = t;
    }

    result.push({ event: ev, index, half, relativeMs });
  });

  return result;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// "14:32" — la hora normal en la que se registró el evento, para mostrarla sutil junto
// al minuto relativo del tiempo (que es lo que realmente importa en la cancha).
export function formatClockTime(at: string): string {
  const d = new Date(at);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
