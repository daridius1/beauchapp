import React from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getFileUrl } from '../services/pocketbase';

interface PlayerAvatarProps {
  player: { id?: string; collectionId?: string; photo?: string } | null | undefined;
  size: number;
}

// Avatar de un jugador del roster (team_players.photo) — siempre circular, y con un
// placeholder de "cara gris" (no una letra con color, a diferencia de <Avatar>) cuando
// no tiene foto todavía, porque una foto de jugador es un caso puntual (cara recortada,
// fondo transparente) que no tiene un "nombre para sacarle la inicial" con el mismo
// sentido que una cuenta real.
export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ player, size }) => {
  const hasPhoto = !!player?.photo;
  const thumbSize = size <= 60 ? '100x100' : undefined;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        hasPhoto ? styles.containerWithPhoto : styles.containerPlaceholder,
      ]}
    >
      {hasPhoto ? (
        <Image
          source={{ uri: getFileUrl(player, player!.photo!, thumbSize) }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <Feather name="user" size={Math.round(size * 0.6)} color="#8a8a8a" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  // Fondo oscuro sólido detrás de una foto real — evita el sangrado blanco de
  // subpíxeles en los bordes (mismo motivo que <Avatar>).
  containerWithPhoto: {
    backgroundColor: '#1c1c1c',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  // Sin foto todavía: fondo transparente de verdad, no una caja sólida — el ícono de
  // "cara" queda flotando, mismo criterio que las fotos reales (que también pueden
  // tener fondo transparente).
  containerPlaceholder: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderStyle: 'dashed',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
