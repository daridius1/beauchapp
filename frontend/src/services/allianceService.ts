import { AllianceId } from '../constants/alliances';
import { NikitaReplayEvent } from '../utils/nikitaJump';
import { pb } from './pocketbase';

export interface AllianceScoreRow {
  alliance: AllianceId;
  points: number;
  players: number;
}

export interface NikitaJumpState {
  myAlliance: AllianceId | null;
  myHighScore: number;
  beautokens: number;
  ownedSkins: string[];
  selectedSkin: string;
  skinPrice: number;
  scoreboard: AllianceScoreRow[];
}

export interface NikitaRunToken {
  runId: string;
  seed: number;
  startedAt: number;
  signature: string;
  tickRate: number;
  maxTicks: number;
}

export interface NikitaRunResult {
  highScore: number;
  improved: boolean;
  verifiedScore: number;
  reward: number;
  beautokens: number;
  alreadyRewarded: boolean;
}

export type ProfessorClaimFilter = 'available' | 'claimed' | 'all';

export interface ProfessorClaim {
  id: string;
  alliance: AllianceId;
  photo: string;
  created: string;
}

export interface AllianceProfessor {
  id: string;
  name: string;
  departments: string[];
  claim: ProfessorClaim | null;
}

export interface ProfessorScoreRow {
  alliance: AllianceId;
  professors: number;
}

export interface ProfessorGalleryItem {
  professorId: string;
  name: string;
  claim: ProfessorClaim;
}

export interface ProfessorGameState {
  semester: string;
  myAlliance: AllianceId | null;
  scoreboard: ProfessorScoreRow[];
  claimCollectionId: string;
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  gallery: ProfessorGalleryItem[];
  items: AllianceProfessor[];
}

export interface AlliancePlacement {
  alliance: AllianceId;
  place: number;
}

export interface AllianceDiscipline {
  id: string;
  name: string;
  placements: AlliancePlacement[];
}

export interface AlliancesHomeState {
  disciplines: AllianceDiscipline[];
  myAlliance: AllianceId | null;
  canChooseAlliance: boolean;
}

export const allianceService = {
  getDisciplines: async (): Promise<AlliancesHomeState> => (
    pb.send<AlliancesHomeState>('/api/alliances/disciplines', { method: 'GET' })
  ),

  getNikitaJump: async (): Promise<NikitaJumpState> => (
    pb.send<NikitaJumpState>('/api/alliances/nikita', { method: 'GET' })
  ),

  chooseAlliance: async (alliance: AllianceId): Promise<{ alliance: AllianceId; highScore: number }> => (
    pb.send<{ alliance: AllianceId; highScore: number }>('/api/alliances/alliance', { method: 'POST', body: { alliance } })
  ),

  startNikitaRun: async (): Promise<NikitaRunToken> => (
    pb.send<NikitaRunToken>('/api/alliances/nikita/start', { method: 'POST' })
  ),

  submitNikitaRun: async (
    token: NikitaRunToken,
    ticks: number,
    replay: NikitaReplayEvent[],
    claimedScore: number,
  ): Promise<NikitaRunResult> => (
    pb.send<NikitaRunResult>('/api/alliances/nikita/score', {
      method: 'POST',
      body: { ...token, ticks, replay, claimedScore },
    })
  ),

  purchaseNikitaSkin: async (skinId: string): Promise<{
    skin: string;
    selectedSkin: string;
    beautokens: number;
    alreadyOwned: boolean;
  }> => (
    pb.send(`/api/alliances/nikita/skins/${encodeURIComponent(skinId)}/purchase`, { method: 'POST' })
  ),

  equipNikitaSkin: async (skin: string): Promise<{ selectedSkin: string }> => (
    pb.send('/api/alliances/nikita/skins/equip', { method: 'POST', body: { skin } })
  ),

  getProfessorGame: async (
    page = 1,
    q = '',
    status: ProfessorClaimFilter = 'available',
  ): Promise<ProfessorGameState> => {
    const params = new URLSearchParams({ page: String(page), perPage: '30', status });
    if (q.trim()) params.set('q', q.trim());
    return pb.send<ProfessorGameState>(`/api/alliances/professors?${params.toString()}`, { method: 'GET' });
  },

  claimProfessor: async (professorId: string, formData: FormData): Promise<ProfessorClaim> => (
    pb.send<ProfessorClaim>(`/api/alliances/professors/${professorId}/claim`, {
      method: 'POST',
      body: formData,
    })
  ),
};
