import { pb } from './pocketbase';

export interface OpenLibraryResult {
  id: string;
  title: string;
  author: string;
  year: number | null;
  coverUrl: string;
}

export const openLibraryService = {
  search: async (query: string): Promise<OpenLibraryResult[]> => {
    const q = query.trim();
    if (!q) return [];
    const res = await pb.send<{ items: OpenLibraryResult[] }>(`/api/books/search?q=${encodeURIComponent(q)}`, {
      method: 'GET',
    });
    return res.items || [];
  },
};
