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

// `id` es la identidad estable de un evento dentro de la bitácora. Se genera acá al
// crearlo y el servidor la usa para fusionar bitácoras de árbitros concurrentes sin
// que se pisen (ver mergeEvents en backend/pb_hooks/lib/matchEvents.js). Es opcional
// porque los eventos guardados antes de este cambio no lo tienen: para esos, tanto el
// cliente como el servidor derivan la clave del contenido con eventKey().
interface EventBase {
  id?: string;
  at: string;
  /** Soft delete: un evento eliminado se marca, nunca se saca de la bitácora.
   *  Todo lo derivado lo ignora. Ver isDeletedEvent en el lib del backend. */
  deleted?: boolean;
}

export type MatchEvent =
  | (EventBase & { type: 'lineup'; team: Team; players: (string | LineupPlayer)[] })
  | (EventBase & { type: 'half_start'; half: 1 | 2 })
  | (EventBase & { type: 'half_end'; half: 1 | 2 })
  | (EventBase & { type: 'pause' })
  | (EventBase & { type: 'resume' })
  | (EventBase & { type: 'goal'; team: Team; player?: string; playerId?: string; ownGoal: boolean; minute?: number; half?: 1 | 2 })
  | (EventBase & { type: 'yellow_card'; team: Team; player?: string; playerId?: string; minute?: number; half?: 1 | 2 })
  | (EventBase & { type: 'red_card'; team: Team; player?: string; playerId?: string; minute?: number; half?: 1 | 2 })
  | (EventBase & { type: 'penalty'; team: Team; player?: string; playerId?: string; scored: boolean; minute?: number; half?: 1 | 2 });

// Réplica exacta de eventKey() en backend/pb_hooks/lib/matchEvents.js — las dos
// implementaciones tienen que coincidir carácter por carácter o la fusión duplicaría
// los eventos legados en vez de reconocerlos.
export function eventKey(ev: MatchEvent): string {
  if (ev && typeof ev.id === 'string' && ev.id) return ev.id;
  return 'legacy:' + String((ev && ev.type) || '') + '@' + String((ev && ev.at) || '');
}

// Identificador único de evento. `crypto.randomUUID` no existe en todos los runtimes
// donde corre esta app (Safari viejo, algunos entornos nativos), así que hay respaldo.
export function newEventId(): string {
  const g: any = globalThis as any;
  if (g.crypto && typeof g.crypto.randomUUID === 'function') return g.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const CLOCK_GATED_TYPES: MatchEvent['type'][] = ['goal', 'yellow_card', 'red_card', 'penalty'];

// Réplica de isDeletedEvent() del backend. Un evento borrado se marca en vez de
// sacarse del arreglo, así que TODA función que derive algo de la bitácora tiene que
// saltearlo — si una se olvida, un gol eliminado sigue contando en su vista.
export function isDeletedEvent(ev: MatchEvent | null | undefined): boolean {
  return Boolean(ev && ev.deleted);
}

// La bitácora sin los eventos marcados como borrados, para las vistas que la listan.
export function visibleEvents(events: MatchEvent[] | null | undefined): MatchEvent[] {
  return (Array.isArray(events) ? events : []).filter((ev) => !isDeletedEvent(ev));
}

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
    if (isDeletedEvent(ev)) continue;
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
    if (isDeletedEvent(ev)) continue;
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
    // `index` sigue siendo el de la bitácora COMPLETA — es el que usa la vista de
    // arbitraje para marcar un evento como borrado, así que no puede ser el de una
    // lista ya filtrada.
    if (isDeletedEvent(ev)) return;
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

// Réplica de computeTopScorers() de backend/pb_hooks/lib/matchEvents.js, donde vive la
// versión testeada. Se calcula en el cliente sobre datos que la vista de liga ya tiene
// cargados: no hay ningún contador de goles guardado por jugador ni endpoint nuevo
// (PRINCIPLES.md §1).
export interface TopScorer {
  key: string;
  name: string;
  playerId: string | null;
  teamId: string | null;
  photo: string | null;
  goals: number;
}

export interface ScorerMatchEntry {
  events: MatchEvent[] | null | undefined;
  teamAId?: string | null;
  teamBId?: string | null;
}

export function computeTopScorers(matchEntries: ScorerMatchEntry[] | null | undefined): TopScorer[] {
  const entries = Array.isArray(matchEntries) ? matchEntries : [];
  const byKey: Record<string, TopScorer> = {};

  const scorerKey = (playerId: string | undefined, teamId: string | null | undefined, name: string) =>
    playerId ? `p:${playerId}` : `n:${teamId || ''}:${name}`;

  entries.forEach((entry) => {
    const events = Array.isArray(entry?.events) ? entry.events : [];
    const teamIdFor = (side: Team) => (side === 'A' ? entry.teamAId : entry.teamBId);

    // Las fotos vienen de los eventos de convocatoria, no de los de gol.
    const photoByPlayerId: Record<string, string> = {};
    const photoByName: Record<string, string> = {};
    events.forEach((ev) => {
      if (ev.type !== 'lineup' || isDeletedEvent(ev)) return;
      ev.players.forEach((raw) => {
        const p = normalizeLineupEntry(raw);
        if (p.playerId && p.photo) photoByPlayerId[p.playerId] = p.photo;
        if (p.name && p.photo) photoByName[p.name] = p.photo;
      });
    });

    events.forEach((ev) => {
      if (isDeletedEvent(ev)) return;
      const isGoal = ev.type === 'goal' && !ev.ownGoal;
      const isScoredPenalty = ev.type === 'penalty' && ev.scored;
      if (!isGoal && !isScoredPenalty) return;

      // Un gol sin jugador asignado es válido, pero no se le acredita a nadie.
      const named = ev as Extract<MatchEvent, { type: 'goal' | 'penalty' }>;
      const name = named.player;
      if (!name) return;

      const teamId = teamIdFor(named.team) || null;
      const key = scorerKey(named.playerId, teamId, name);
      if (!byKey[key]) {
        byKey[key] = {
          key,
          name,
          playerId: named.playerId || null,
          teamId,
          photo: (named.playerId && photoByPlayerId[named.playerId]) || photoByName[name] || null,
          goals: 0,
        };
      }
      byKey[key].goals += 1;
    });
  });

  return Object.values(byKey).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
}
