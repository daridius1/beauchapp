import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { PetProfileCard } from '../components/PetProfileCard';

type Props = NativeStackScreenProps<RootStackParamList, 'PetDetail'>;

// Ruta directa a una mascota (deep link, citas desde el feed). El uso normal desde
// Explorar no pasa por acá: se navega entre mascotas dentro de MascotasScreen.
export const PetDetailScreen: React.FC<Props> = ({ route }) => {
  const { petId } = route.params;
  return <PetProfileCard petId={petId} />;
};
