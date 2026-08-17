import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { getFileUrl } from '../../services/pocketbase';

export interface CrestData {
  id?: string;
  collectionId?: string;
  matchPhoto?: string;
  avatar?: string;
  matchAlias?: string;
  name?: string;
  username?: string;
}

// Nombre para mostrar en contextos de partido: el alias de equipo/jugador (matchAlias)
// tiene prioridad sobre el nombre social genérico — es el que el equipo eligió
// específicamente para verse en tablas y partidos.
export function matchDisplayName(entity: CrestData | null | undefined, fallback: string): string {
  return entity?.matchAlias || entity?.name || entity?.username || fallback;
}

interface TeamCrestProps {
  team: CrestData | null | undefined;
  size: number;
}

// A diferencia de <Avatar>, no recorta a círculo ni pinta un fondo opaco detrás de la
// foto: matchPhoto está pensado para poder tener fondo transparente (un escudo real),
// así que se muestra tal cual con resizeMode="contain" sobre fondo transparente. Si no
// hay matchPhoto, cae al avatar genérico de la cuenta y, si tampoco hay avatar, a un
// círculo con la inicial (igual que <Avatar>).
export const TeamCrest: React.FC<TeamCrestProps> = ({ team, size }) => {
  const photo = team?.matchPhoto || team?.avatar;
  const thumbSize = size <= 60 ? '100x100' : undefined;

  if (!photo) {
    const letter = matchDisplayName(team, 'E').charAt(0).toUpperCase();
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={{ fontSize: Math.round(size * 0.45), fontWeight: '800', color: '#000000' }}>{letter}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: getFileUrl(team, photo, thumbSize) }}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
};

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
});
