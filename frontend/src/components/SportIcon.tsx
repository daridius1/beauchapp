import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  name?: string;
  slug?: string;
  size?: number;
  color?: string;
  style?: any;
}

/**
 * Ícono de Jugador de Taca Taca:
 * Silueta de muñeco erguido (cabeza, torso, pie de bloque) atravesado al medio por la barra horizontal del futbolín.
 */
export const TacaTacaIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = '#38bdf8' }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
      {/* Barra Horizontal / Palo del Taca Taca */}
      <View style={{ position: 'absolute', width: '100%', height: Math.max(2, size * 0.12), backgroundColor: color, borderRadius: 1 }} />
      {/* Cabeza redonda del jugador */}
      <View style={{ position: 'absolute', top: 0, width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18, backgroundColor: color }} />
      {/* Torso / Bloque del cuerpo que cruza la barra */}
      <View style={{ position: 'absolute', top: size * 0.32, width: size * 0.42, height: size * 0.4, backgroundColor: color, borderRadius: 1 }} />
      {/* Pie bloque tradicional de taca taca */}
      <View style={{ position: 'absolute', bottom: 0, width: size * 0.28, height: size * 0.28, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
};

export const SportIcon: React.FC<Props> = ({ name, slug, size = 13, color = '#38bdf8', style }) => {
  const str = (name || slug || '').toLowerCase().trim();

  if (str.includes('taca')) {
    return <TacaTacaIcon size={size} color={color} />;
  }

  if (str.includes('tenis') || str.includes('mesa') || str.includes('ping')) {
    // Paleta de Tenis de Mesa
    return <MaterialCommunityIcons name="table-tennis" size={size + 2} color={color} style={style} />;
  }

  if (str.includes('tiptap')) {
    // Círculo limpio para TipTap
    return <MaterialCommunityIcons name="circle-outline" size={size + 1} color={color} style={style} />;
  }

  if (str.includes('ajedrez') || str.includes('chess')) {
    return <MaterialCommunityIcons name="chess-king" size={size + 2} color={color} style={style} />;
  }

  if (str.includes('pádel') || str.includes('padel')) {
    return <MaterialCommunityIcons name="tennis-ball" size={size} color={color} style={style} />;
  }

  if (str.includes('clash') || str.includes('royale')) {
    return <MaterialCommunityIcons name="crown" size={size} color={color} style={style} />;
  }

  return <MaterialCommunityIcons name="trophy-outline" size={size} color={color} style={style} />;
};
