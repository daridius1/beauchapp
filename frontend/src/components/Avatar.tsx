import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { getFileUrl } from '../services/pocketbase';

interface AvatarProps {
  user: {
    id: string;
    collectionId: string;
    avatar?: string;
    name?: string;
    username?: string;
  } | null | undefined;
  size: number;
  fontSize?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ user, size, fontSize }) => {
  const finalFontSize = fontSize || Math.round(size * 0.45);
  const letter = user?.name ? user.name.charAt(0).toUpperCase() : (user?.username ? user.username.charAt(0).toUpperCase() : 'U');

  // Si el tamaño del avatar es <= 60 (vistas pequeñas como publicaciones, barra lateral, comentarios),
  // solicitamos la miniatura '100x100' mediante PocketBase proxy.
  // Si es más grande (ej: vistas de perfil o ajustes), usamos la foto original recortada y optimizada.
  const thumbSize = size <= 60 ? '100x100' : undefined;
  const hasAvatar = !!user?.avatar;

  return (
    <View style={[
      styles.avatarContainer, 
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        // Usamos fondo oscuro si tiene avatar para evitar el sangrado blanco de subpíxeles
        backgroundColor: hasAvatar ? '#111111' : '#ffffff',
      }
    ]}>
      {hasAvatar ? (
        <Image
          source={{ uri: getFileUrl(user, user.avatar!, thumbSize) }}
          style={styles.avatarImage}
        />
      ) : (
        <Text style={[styles.avatarText, { fontSize: finalFontSize }]}>
          {letter}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  avatarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
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
});
