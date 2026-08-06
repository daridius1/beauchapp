import React from 'react';
import { Text, View } from 'react-native';
import { styles } from './TinderScreen.styles';

export const TinderExtraDetails = ({ profile }: { profile: any }) => {
  if (!profile) return null;
  const items = [
    profile.favorite_song ? { label: 'Canción favorita', val: profile.favorite_song } : null,
    profile.favorite_book ? { label: 'Libro favorito', val: profile.favorite_book } : null,
    profile.zodiac_sign ? { label: 'Signo zodiacal', val: profile.zodiac_sign } : null,
    profile.favorite_drink ? { label: 'Bebida favorita', val: profile.favorite_drink } : null,
    profile.favorite_food ? { label: 'Comida favorita', val: profile.favorite_food } : null,
    profile.favorite_subject ? { label: 'Ramo favorito', val: profile.favorite_subject } : null,
    profile.hobbies ? { label: 'Pasatiempos', val: profile.hobbies } : null,
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <View style={styles.extraDetailsList}>
      <Text style={styles.extraDetailsHeader}>Gustos Personales</Text>
      {items.map((it: any, idx: number) => (
        <View key={idx} style={styles.extraDetailRow}>
          <Text style={styles.extraDetailRowText}>
            <Text style={{ fontWeight: '700', color: '#e2e8f0' }}>{it.label}: </Text>
            <Text style={{ color: '#cbd5e1' }}>{it.val}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
};
