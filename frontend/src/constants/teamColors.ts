// Paleta de color de equipo para el álbum de figuritas (LeagueAlbumScreen.tsx) y para
// el selector en EditTeamScreen.tsx. Los 18 valores tienen que ser IDÉNTICOS, carácter
// por carácter, a los `values` del campo `teamColor` en backend/pb_migrations/
// 1790700000_add_team_color_to_users.js + 1791100000_add_white_gray_to_team_colors.js
// — no hay forma de compartir un único archivo entre el runtime de los hooks (Goja) y
// la app (mismo motivo que matchEvents.ts/.js), así que se mantienen dos copias hermanas.
// `textOn` está precalculado a mano (no en runtime) para que cada lámina/encabezado
// sepa de una si el texto encima va blanco o negro, sin tener que calcular luminancia.
export interface TeamColorOption {
  value: string;
  textOn: '#ffffff' | '#000000';
}

export const TEAM_COLORS: TeamColorOption[] = [
  { value: '#DC2626', textOn: '#ffffff' },
  { value: '#EA580C', textOn: '#ffffff' },
  { value: '#D97706', textOn: '#000000' },
  { value: '#CA8A04', textOn: '#000000' },
  { value: '#65A30D', textOn: '#ffffff' },
  { value: '#16A34A', textOn: '#ffffff' },
  { value: '#059669', textOn: '#ffffff' },
  { value: '#0D9488', textOn: '#ffffff' },
  { value: '#0891B2', textOn: '#ffffff' },
  { value: '#2563EB', textOn: '#ffffff' },
  { value: '#4F46E5', textOn: '#ffffff' },
  { value: '#7C3AED', textOn: '#ffffff' },
  { value: '#9333EA', textOn: '#ffffff' },
  { value: '#C026D3', textOn: '#ffffff' },
  { value: '#DB2777', textOn: '#ffffff' },
  { value: '#57534E', textOn: '#ffffff' },
  { value: '#F5F5F4', textOn: '#000000' },
  { value: '#44403C', textOn: '#ffffff' },
];

// Color de respaldo para un equipo que todavía no eligió el suyo — mismo gris que el
// resto de la UI usa para bordes/superficies apagadas.
export const FALLBACK_TEAM_COLOR: TeamColorOption = { value: '#334155', textOn: '#ffffff' };

export function getTeamColor(hex: string | undefined | null): TeamColorOption {
  const found = TEAM_COLORS.find((c) => c.value === hex);
  return found || FALLBACK_TEAM_COLOR;
}

// Mezcla `hex` hacia negro (amount > 0) o hacia blanco (amount < 0), |amount| en
// [0, 1]. Un solo color de equipo alcanza para armar varios tonos de la misma paleta
// (fondo de página, ver buildTeamWaveTones en LeagueAlbumScreen.tsx) sin necesitar un
// segundo color guardado en ningún lado.
export function shadeHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  const target = amount >= 0 ? 0 : 255;
  const t = Math.min(1, Math.abs(amount));
  const mix = (c: number) => Math.max(0, Math.min(255, Math.round(c + (target - c) * t)));
  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

// Posición del jugador — colores fijos por posición (no dependen del equipo), para que
// el chip de cada lámina se identifique de un vistazo sin depender del color de la
// camiseta. Reflejan el orden en el que se agrupan los jugadores dentro de la página
// de un equipo (arqueros primero, delanteros al final).
export type PlayerPosition = 'POR' | 'DEF' | 'MED' | 'DEL';

export const POSITION_ORDER: PlayerPosition[] = ['POR', 'DEF', 'MED', 'DEL'];

export const POSITION_LABELS: Record<PlayerPosition, string> = {
  POR: 'Arqueros',
  DEF: 'Defensas',
  MED: 'Mediocampistas',
  DEL: 'Delanteros',
};

export const POSITION_COLORS: Record<PlayerPosition, string> = {
  POR: '#CA8A04',
  DEF: '#2563EB',
  MED: '#059669',
  DEL: '#DC2626',
};

// Paleta de 3 colores por ÁLBUM (no por equipo) — la elige el superusuario desde
// /admin/album (admin_album.pb.js: paletteColor1/2/3, misma lista de valores más
// negro/blanco). Pinta la textura de fondo y el marco del "libro" del álbum
// (LeagueAlbumScreen.tsx); el color de CADA equipo (TEAM_COLORS arriba) sigue
// mandando en su propia página y sus láminas — esto es solo la ambientación del
// álbum en general, para álbumes que todavía no configuraron nada.
export interface AlbumPalette {
  base: string;
  secondary: string;
  accent: string;
}

const DEFAULT_ALBUM_PALETTE: AlbumPalette = { base: '#141414', secondary: '#1e1e1e', accent: '#3a3a3a' };

export function getAlbumPalette(palette: (string | null | undefined)[] | undefined): AlbumPalette {
  const [c1, c2, c3] = palette || [];
  return {
    base: c1 || DEFAULT_ALBUM_PALETTE.base,
    secondary: c2 || DEFAULT_ALBUM_PALETTE.secondary,
    accent: c3 || DEFAULT_ALBUM_PALETTE.accent,
  };
}
