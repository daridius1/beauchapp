import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { getFileUrl } from '../services/pocketbase';
import { getAllianceFrame } from '../constants/alliances';

interface AvatarProps {
  user: {
    id?: string;
    collectionId?: string;
    avatar?: string;
    name?: string;
    username?: string;
    alliance?: string;
  } | null | undefined;
  size: number;
  fontSize?: number;
  imageUri?: string | null;
}

export const Avatar: React.FC<AvatarProps> = ({ user, size, fontSize, imageUri }) => {
  const finalFontSize = fontSize || Math.round(size * 0.45);
  const letter = user?.name ? user.name.charAt(0).toUpperCase() : (user?.username ? user.username.charAt(0).toUpperCase() : 'U');
  const frameSize = Math.round(size * 1.22);
  const frameOffset = (size - frameSize) / 2;
  const allianceFrame = getAllianceFrame(user?.alliance);
  const photoSize = allianceFrame ? Math.round(size * 0.82) : size;
  const photoOffset = (size - photoSize) / 2;

  // Si el tamaño del avatar es <= 60 (vistas pequeñas como publicaciones, barra lateral, comentarios),
  // solicitamos la miniatura '100x100' mediante PocketBase proxy.
  // Si es más grande (ej: vistas de perfil o ajustes), usamos la foto original recortada y optimizada.
  const thumbSize = size <= 60 ? '100x100' : undefined;
  const hasAvatar = !!imageUri || !!user?.avatar;

  return (
    <View style={[styles.frameContainer, { width: size, height: size }]}>
      <View style={[
        styles.avatarContainer,
        {
          height: photoSize,
          width: photoSize,
          borderRadius: photoSize / 2,
          top: photoOffset,
          left: photoOffset,
          borderWidth: allianceFrame ? 0 : 1.5,
          // Usamos fondo oscuro si tiene avatar para evitar el sangrado blanco de subpíxeles
          backgroundColor: hasAvatar ? '#111111' : '#ffffff',
        }
      ]}>
        {hasAvatar ? (
          <Image
            source={{ uri: imageUri || getFileUrl(user, user!.avatar!, thumbSize) }}
            style={styles.avatarImage}
          />
        ) : (
          <Text style={[styles.avatarText, { fontSize: finalFontSize }]}>
            {letter}
          </Text>
        )}
      </View>
      {!!allianceFrame && (
        <Image
          source={allianceFrame}
          style={[
            styles.allianceFrame,
            {
              width: frameSize,
              height: frameSize,
              top: frameOffset,
              left: frameOffset,
            },
          ]}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  frameContainer: {
    position: 'relative',
    overflow: 'visible',
  },
  avatarContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderColor: 'rgba(255, 255, 255, 0.15)', // Borde definido y premium
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#000000',
    fontWeight: '800',
  },
  allianceFrame: {
    position: 'absolute',
    zIndex: 2,
  },
});
