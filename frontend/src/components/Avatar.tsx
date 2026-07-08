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

  const thumbSize = size <= 50 ? '100x100' : '500x500';

  return (
    <View style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2 }]}>
      {user?.avatar ? (
        <Image
          source={{ uri: getFileUrl(user, user.avatar, thumbSize) }}
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
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
