import React from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
// escudo genérico gris (no una letra) — un placeholder de "todavía no subiste tu
// escudo", no una identidad visual con la inicial del equipo.
//
// El escudo NUNCA dibuja borde, fondo ni padding, ni siquiera en el placeholder: un
// escudo es una forma con silueta propia y cualquier caja alrededor compite con ella.
// Quien use este componente tampoco debe envolverlo en un contenedor decorado — el
// marcador de partido tenía un wrapper con borde y padding que, sumado al borde punteado
// que traía el placeholder, dejaba dos márgenes solapados alrededor del escudo genérico.
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
  // Solo centra el ícono: sin borde, sin fondo y sin radio. El ícono de escudo ya es la
  // silueta que se ve, y ocupa la misma caja que ocuparía un escudo real, así que la
  // alineación con el resto de la fila no cambia entre tener escudo y no tenerlo.
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});
