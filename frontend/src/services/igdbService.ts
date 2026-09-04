import { pb } from './pocketbase';

export interface IgdbResult {
  id: string;
  name: string;
  year: number | null;
  coverUrl: string;
}

export const igdbService = {
  search: async (query: string): Promise<IgdbResult[]> => {
    const q = query.trim();
    if (!q) return [];
    const res = await pb.send<{ items: IgdbResult[] }>(`/api/igdb/search?q=${encodeURIComponent(q)}`, {
      method: 'GET',
    });
    return res.items || [];
  },
};
