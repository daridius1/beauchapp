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
  maxGuesses: number;
  status: 'in_progress' | 'won' | 'lost';
  guesses: BeaudleGuessFeedback[];
  guessesRemaining: number;
  revealedPlace: BeaudlePlace | null;
  stats: BeaudleStats;
  // ID de beaudle_daily_stats (compartido por todos los jugadores del día/variante) — es
  // el "targetId" del hilo de comentarios/citas de hoy, nunca el ID privado de la partida
  // de cada usuario.
  statsId: string | null;
  solvedAtGuess: number | null;
}

export const beaudleService = {
  getToday: async (variant: string = 'classic'): Promise<BeaudleGameState> => {
    return pb.send<BeaudleGameState>(`/api/beaudle/today?variant=${variant}`, { method: 'GET' });
  },

  submitGuess: async (code: string, variant: string = 'classic'): Promise<BeaudleGameState> => {
    return pb.send<BeaudleGameState>('/api/beaudle/guess', {
      method: 'POST',
      body: { code, variant },
    });
  },
};
