export interface Ladder {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  max_score?: number;
  allowed_modes?: ('1v1' | '2v2')[];
  is_active?: boolean;
  created: string;
  updated: string;
}

export interface LadderRank {
  id: string;
  ladder: string;
  user: string;
  mu: number;
  sigma: number;
  ordinal_rating: number;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  created: string;
  updated: string;
  expand?: {
    user?: {
      id: string;
      name: string;
      username?: string;
      avatar?: string;
    };
    ladder?: Ladder;
  };
}

export interface LadderMatch {
  id: string;
  ladder: string;
  arbiter: string;
  mode: '1v1' | '2v2';
  team_red: string[];
  team_blue: string[];
  score_red: number;
  score_blue: number;
  goal_history?: ('red' | 'blue' | string)[];
  status: 'pending_confirmation' | 'confirmed' | 'disputed';
  confirmations?: Record<string, 'accepted' | 'rejected'>;
  openskill_changes?: {
    red: { userId: string; mu: number; sigma: number; ordinal_rating: number; delta: number }[];
    blue: { userId: string; mu: number; sigma: number; ordinal_rating: number; delta: number }[];
  };
  created: string;
  updated: string;
  expand?: {
    arbiter?: {
      id: string;
      name: string;
      username?: string;
    };
    team_red?: {
      id: string;
      name: string;
      username?: string;
      avatar?: string;
    }[];
    team_blue?: {
      id: string;
      name: string;
      username?: string;
      avatar?: string;
    }[];
    ladder?: Ladder;
  };
}
