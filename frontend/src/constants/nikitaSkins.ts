import { ImageSourcePropType } from 'react-native';

export type NikitaSkinCategory = 'Base' | 'Grupos organizados' | 'Especialidades';

export interface NikitaSkin {
  id: string;
  name: string;
  category: NikitaSkinCategory;
  source: ImageSourcePropType;
}

export const NIKITA_SKIN_PRICE = 50;
export const NIKITA_REWARD_MIN_SCORE = 283;

export const NIKITA_VANILLA_SKIN: NikitaSkin = {
  id: '',
  name: 'Nikita',
  category: 'Base',
  source: require('../../assets/nikita-skins/vanilla.webp'),
};

export const NIKITA_SKINS: NikitaSkin[] = [
  { id: 'gcine-gris', name: 'GCINE gris', category: 'Grupos organizados', source: require('../../assets/nikita-skins/gcine-gris.webp') },
  { id: 'patin', name: 'Nikita patín', category: 'Grupos organizados', source: require('../../assets/nikita-skins/patin.webp') },
  { id: 'palestina', name: 'Palestina', category: 'Grupos organizados', source: require('../../assets/nikita-skins/palestina.webp') },
  { id: 'gcine', name: 'GCINE', category: 'Grupos organizados', source: require('../../assets/nikita-skins/gcine.webp') },
  { id: 'gmi', name: 'GMI', category: 'Grupos organizados', source: require('../../assets/nikita-skins/gmi.webp') },
  { id: 'bombachaya', name: 'Bombachaya', category: 'Grupos organizados', source: require('../../assets/nikita-skins/bombachaya.webp') },
  { id: 'michis', name: 'Michis', category: 'Grupos organizados', source: require('../../assets/nikita-skins/michis.webp') },
  { id: 'pymes', name: 'Pymes FCFM', category: 'Grupos organizados', source: require('../../assets/nikita-skins/pymes.webp') },
  { id: 'hiphop', name: 'Hip Hop Beauchef', category: 'Grupos organizados', source: require('../../assets/nikita-skins/hiphop.webp') },
  { id: 'computacion', name: 'Computación', category: 'Especialidades', source: require('../../assets/nikita-skins/computacion.webp') },
  { id: 'quimica', name: 'Química', category: 'Especialidades', source: require('../../assets/nikita-skins/quimica.webp') },
  { id: 'minas', name: 'Minas', category: 'Especialidades', source: require('../../assets/nikita-skins/minas.webp') },
  { id: 'geologia', name: 'Geología', category: 'Especialidades', source: require('../../assets/nikita-skins/geologia.webp') },
  { id: 'biotecnologia', name: 'Biotecnología', category: 'Especialidades', source: require('../../assets/nikita-skins/biotecnologia.webp') },
  { id: 'mecanica', name: 'Mecánica', category: 'Especialidades', source: require('../../assets/nikita-skins/mecanica.webp') },
  { id: 'civil', name: 'Ingeniería Civil', category: 'Especialidades', source: require('../../assets/nikita-skins/civil.webp') },
  { id: 'matematica', name: 'Matemática', category: 'Especialidades', source: require('../../assets/nikita-skins/matematica.webp') },
  { id: 'industrial', name: 'Industrial', category: 'Especialidades', source: require('../../assets/nikita-skins/industrial.webp') },
  { id: 'geofisica', name: 'Geofísica', category: 'Especialidades', source: require('../../assets/nikita-skins/geofisica.webp') },
  { id: 'astronomia', name: 'Astronomía', category: 'Especialidades', source: require('../../assets/nikita-skins/astronomia.webp') },
  { id: 'fisica', name: 'Física', category: 'Especialidades', source: require('../../assets/nikita-skins/fisica.webp') },
  { id: 'electrica', name: 'Eléctrica', category: 'Especialidades', source: require('../../assets/nikita-skins/electrica.webp') },
];

export const nikitaSkinById = (id: string | null | undefined): NikitaSkin | null => (
  NIKITA_SKINS.find((skin) => skin.id === id) || null
);
