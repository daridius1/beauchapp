import React from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getFileUrl } from '../../services/pocketbase';
import { theme } from '../../theme/theme';

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
// escudo genérico gris (no una letra) — un placeholder de "todavía no subiste tu
// escudo", no una identidad visual con la inicial del equipo.
export const TeamCrest: React.FC<TeamCrestProps> = ({ team, size }) => {
  const photo = team?.matchPhoto || team?.avatar;
  const thumbSize = size <= 60 ? '100x100' : undefined;

  if (!photo) {
    return (
      <View style={[styles.fallback, { width: size, height: size }]}>
        <Feather name="shield" size={Math.round(size * 0.6)} color="#8a8a8a" />
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
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderStyle: 'dashed',
    borderRadius: theme.borderRadius.md,
  },
});
