import { pb } from './pocketbase';

export interface SpotifyTrackResult {
  id: string;
  name: string;
  artist: string;
  year: number | null;
  imageUrl: string;
}

export const spotifyService = {
  search: async (query: string): Promise<SpotifyTrackResult[]> => {
    const q = query.trim();
    if (!q) return [];
    const res = await pb.send<{ items: SpotifyTrackResult[] }>(
      `/api/spotify/search?q=${encodeURIComponent(q)}`,
      { method: 'GET' }
    );
    return res.items || [];
  },
};
