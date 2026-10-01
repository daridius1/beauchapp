export interface SoundCloudPreview {
  url: string;
  title: string;
}

const ALLOWED_HOSTS = new Set(['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com']);

export const normalizeSoundCloudUrl = (raw: string): string | null => {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (url.username || url.password || url.pathname === '/' || url.pathname.length > 350) return null;
    url.hash = '';
    return url.toString().slice(0, 500);
  } catch {
    return null;
  }
};

export const soundcloudService = {
  preview: async (rawUrl: string): Promise<SoundCloudPreview> => {
    const url = normalizeSoundCloudUrl(rawUrl);
    if (!url) throw new Error('Pega un enlace público válido de SoundCloud.');

    const params = new URLSearchParams({ format: 'json', url, maxheight: '81' });
    const response = await fetch(`https://soundcloud.com/oembed?${params.toString()}`);
    if (!response.ok) throw new Error('SoundCloud no permite insertar este enlace.');
    const body = await response.json();
    if (body?.provider_name !== 'SoundCloud' || body?.type !== 'rich') {
      throw new Error('SoundCloud no reconoció este enlace.');
    }
    return { url, title: String(body.title || 'Audio de SoundCloud').slice(0, 180) };
  },
};
