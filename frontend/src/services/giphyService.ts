import { storage } from '../utils/storage';

export interface GiphySelection {
  id: string;
  title: string;
  mp4Url: string;
  webpUrl: string;
  stillUrl: string;
  username: string;
  sourceUrl: string;
}

const CACHE_PREFIX = 'giphy_search_v1:';
const CACHE_TTL_MS = 60 * 60 * 1000;

const parseResult = (item: any): GiphySelection | null => {
  const fixed = item?.images?.fixed_width || item?.images?.fixed_width_small;
  const original = item?.images?.original;
  const mp4Url = fixed?.mp4 || original?.mp4 || '';
  const webpUrl = fixed?.webp || original?.webp || '';
  if (!item?.id || (!mp4Url && !webpUrl)) return null;

  return {
    id: String(item.id),
    title: String(item.title || 'GIF de GIPHY').slice(0, 160),
    mp4Url,
    webpUrl,
    stillUrl: fixed?.url || item?.images?.fixed_width_still?.url || '',
    username: String(item.user?.display_name || item.username || '').slice(0, 100),
    sourceUrl: String(item.url || '').slice(0, 500),
  };
};

export const giphyService = {
  isConfigured: Boolean(process.env.EXPO_PUBLIC_GIPHY_API_KEY),

  search: async (query: string): Promise<GiphySelection[]> => {
    const q = query.trim();
    if (q.length < 3) return [];

    const apiKey = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
    if (!apiKey) throw new Error('La búsqueda de GIPHY todavía no está configurada.');

    const cacheKey = `${CACHE_PREFIX}${q.toLocaleLowerCase('es-CL')}`;
    const cached = storage.getItem(cacheKey);
    if (cached) {
      try {
        const value = JSON.parse(cached);
        if (Date.now() - value.savedAt < CACHE_TTL_MS && Array.isArray(value.items)) {
          return value.items;
        }
      } catch {}
    }

    const params = new URLSearchParams({
      api_key: apiKey,
      q,
      limit: '20',
      rating: 'g',
      lang: 'es',
      bundle: 'low_bandwidth',
    });
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?${params.toString()}`);
    if (response.status === 429) {
      throw new Error('Se alcanzó el límite temporal de búsquedas de GIPHY. Intenta más tarde.');
    }
    if (!response.ok) throw new Error('No se pudo buscar en GIPHY.');

    const body = await response.json();
    const items = (Array.isArray(body?.data) ? body.data : [])
      .map(parseResult)
      .filter(Boolean) as GiphySelection[];
    storage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), items }));
    return items;
  },
};
