import type { ImageSourcePropType } from 'react-native';

export type AllianceId = 'urbana' | 'pop' | 'gotico' | 'hiphop' | 'punk' | 'rock';

export interface AllianceOption {
  id: AllianceId;
  label: string;
  frame: ImageSourcePropType;
}

// Recursos locales del bundle: Metro les asigna un hash y el navegador/PWA los
// conserva en caché. Mostrar un marco nunca agrega una petición a PocketBase ni a R2.
export const ALLIANCES: AllianceOption[] = [
  { id: 'urbana', label: 'Urbana', frame: require('../../assets/alliances/urbana.png') },
  { id: 'pop', label: 'Pop', frame: require('../../assets/alliances/pop.png') },
  { id: 'gotico', label: 'Gótico', frame: require('../../assets/alliances/gotico.png') },
  { id: 'hiphop', label: 'Hip-Hop', frame: require('../../assets/alliances/hiphop.png') },
  { id: 'punk', label: 'Punk', frame: require('../../assets/alliances/punk.png') },
  { id: 'rock', label: 'Rock', frame: require('../../assets/alliances/rock.png') },
];

const ALLIANCE_FRAMES = Object.fromEntries(
  ALLIANCES.map(({ id, frame }) => [id, frame]),
) as Record<AllianceId, ImageSourcePropType>;

export const getAllianceFrame = (alliance?: string): ImageSourcePropType | null => {
  if (!alliance || !(alliance in ALLIANCE_FRAMES)) return null;
  return ALLIANCE_FRAMES[alliance as AllianceId];
};
