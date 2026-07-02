export interface Match {
  id: string;
  contest: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  stage: string;
  date: string;
  homeScore?: number | null;
  awayScore?: number | null;
  played?: boolean;
  active?: boolean;
  tag?: string;
}

export interface Contest {
  id: string;
  name: string;
  description: string;
  admins?: string[];
  tag?: string;
}

export interface PredictionState {
  [matchId: string]: {
    id?: string;
    homeScore: string;
    awayScore: string;
  };
}

export interface EditingScoreState {
  [matchId: string]: {
    homeScore: string;
    awayScore: string;
    played: boolean;
    homeTeam: string;
    awayTeam: string;
    homeFlag: string;
    awayFlag: string;
    date: string;
    tag: string;
  };
}

export interface NewMatchForm {
  stage: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  date: string;
  tag: string;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  predictionsCount: number;
  totalPoints: number;
  exactCount: number;
  diffCount: number;
  trendCount: number;
}
