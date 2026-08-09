import { pb } from './pocketbase';
import { BeaudleCourse } from '../screens/beaudle/courses';

export interface BeaudleGuessFeedback {
  code: string;
  department: 'correct' | 'wrong';
  semester: 'correct' | 'higher' | 'lower';
  credits: 'correct' | 'higher' | 'lower';
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
  revealedCourse: BeaudleCourse | null;
  stats: BeaudleStats;
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
