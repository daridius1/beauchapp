import { pb } from './pocketbase';
import { BeaudlePlace } from '../screens/beaudle/places';

type MatchState = 'correct' | 'partial' | 'wrong';

export interface BeaudleGuessFeedback {
  code: string;
  ubicacion: 'correct' | 'wrong';
  edificio: MatchState;
  piso: MatchState;
  tipo: MatchState;
  tie: boolean;
  solved: boolean;
  guessedAt: string;
}

export interface BeaudleStats {
  day: string;
  variant: string;
  playersCount: number;
  solvedCount: number;
  guessDistribution: Record<string, number>;
}

export interface BeaudleGameState {
  day: string;
  variant: string;
  // "Beaudle #N" — null si ese día todavía no tiene ninguna partida jugada (nunca se
  // crea la fila de stats hasta el primer intento de alguien).
  dayNumber: number | null;
  isToday: boolean;
  maxGuesses: number;
  status: 'in_progress' | 'won' | 'lost';
  guesses: BeaudleGuessFeedback[];
  guessesRemaining: number;
  revealedPlace: BeaudlePlace | null;
  stats: BeaudleStats;
  // ID de beaudle_daily_stats (compartido por todos los jugadores del día/variante) — es
  // el "targetId" del hilo de comentarios/citas de ese día, nunca el ID privado de la
  // partida de cada usuario.
  statsId: string | null;
  solvedAtGuess: number | null;
}

export interface BeaudleDaySummary {
  day: string;
  dayNumber: number | null;
  playersCount: number;
  solvedCount: number;
  myStatus: 'not_played' | 'in_progress' | 'won' | 'lost';
  myGuessCount: number;
}

export interface BeaudleDaysResponse {
  days: BeaudleDaySummary[];
  maxGuesses: number;
  myStreak: number;
  myBestStreak: number;
}

export const beaudleService = {
  getToday: async (variant: string = 'classic'): Promise<BeaudleGameState> => {
    return pb.send<BeaudleGameState>(`/api/beaudle/today?variant=${variant}`, { method: 'GET' });
  },

  // Mismo endpoint que getToday, pero pidiendo explícitamente un día — para ver/jugar un
  // día pasado (desde la lista de días o al tocar "Ver Beaudle" en una cita/comentario).
  getDay: async (day: string, variant: string = 'classic'): Promise<BeaudleGameState> => {
    return pb.send<BeaudleGameState>(`/api/beaudle/today?variant=${variant}&day=${day}`, { method: 'GET' });
  },

  getDays: async (variant: string = 'classic', page: number = 1, perPage: number = 30): Promise<BeaudleDaysResponse> => {
    return pb.send<BeaudleDaysResponse>(`/api/beaudle/days?variant=${variant}&page=${page}&perPage=${perPage}`, { method: 'GET' });
  },

  submitGuess: async (code: string, variant: string = 'classic', day?: string): Promise<BeaudleGameState> => {
    return pb.send<BeaudleGameState>('/api/beaudle/guess', {
      method: 'POST',
      body: day ? { code, variant, day } : { code, variant },
    });
  },
};
