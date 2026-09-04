import { pb } from './pocketbase';

export interface TmdbResult {
  id: string;
  mediaType: 'movie' | 'tv';
  title: string;
  year: number | null;
  posterUrl: string;
}

export const tmdbService = {
  search: async (query: string): Promise<TmdbResult[]> => {
    const q = query.trim();
    if (!q) return [];
    const res = await pb.send<{ items: TmdbResult[] }>(`/api/tmdb/search?q=${encodeURIComponent(q)}`, {
      method: 'GET',
    });
    return res.items || [];
  },
};
