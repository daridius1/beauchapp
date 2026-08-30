import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SongProfileCard } from '../components/SongProfileCard';

type Props = NativeStackScreenProps<RootStackParamList, 'SongDetail'>;

// Ruta directa a una canción (deep link, citas desde el feed). El uso normal desde
// Explorar no pasa por acá: se navega entre canciones dentro de MusicaScreen.
export const SongDetailScreen: React.FC<Props> = ({ route }) => {
  const { songId } = route.params;
  return <SongProfileCard songId={songId} />;
};
