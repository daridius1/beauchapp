import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

export type EventBadgeType =
  | 'goal'
  | 'own_goal'
  | 'yellow_card'
  | 'red_card'
  | 'penalty_scored'
  | 'penalty_missed';

interface LeagueBadgeProps {
  type: EventBadgeType;
  size?: 'sm' | 'md';
}

/**
 * Ícono vectorial de arco de fútbol para penales.
 */
const SoccerGoalIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke={color}
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Postes y travesaño frontal */}
    <Path d="M3 17.5V4.5h14v13" />
    {/* Malla / Red del arco */}
    <Path d="M3 9h14" strokeWidth={1} opacity={0.55} />
    <Path d="M3 13.5h14" strokeWidth={1} opacity={0.55} />
    <Path d="M7.6 4.5v13" strokeWidth={1} opacity={0.55} />
    <Path d="M12.4 4.5v13" strokeWidth={1} opacity={0.55} />
  </Svg>
);

export const LeagueBadge: React.FC<LeagueBadgeProps> = ({ type, size = 'sm' }) => {
  const isSm = size === 'sm';
  const iconSize = isSm ? 14 : 17;

  switch (type) {
    case 'goal':
      // Gol regular: Balón de fútbol blanco
      return <MaterialCommunityIcons name="soccer" size={iconSize} color="#ffffff" />;

    case 'own_goal':
      // Autogol: Balón de fútbol rojo
      return <MaterialCommunityIcons name="soccer" size={iconSize} color="#ef4444" />;

    case 'penalty_scored':
      // Penal anotado: Arco de fútbol verde
      return <SoccerGoalIcon size={iconSize} color="#22c55e" />;

    case 'penalty_missed':
      // Penal fallado: Arco de fútbol rojo
      return <SoccerGoalIcon size={iconSize} color="#ef4444" />;

    case 'yellow_card':
      // Tarjeta amarilla: Rectángulo amarillo
      return <View style={[styles.cardYellow, isSm ? styles.cardSm : styles.cardMd]} />;

    case 'red_card':
      // Tarjeta roja: Rectángulo rojo
      return <View style={[styles.cardRed, isSm ? styles.cardSm : styles.cardMd]} />;

    default:
      return null;
  }
};

const styles = StyleSheet.create({
  cardYellow: {
    backgroundColor: '#eab308',
    borderColor: '#ca8a04',
    borderWidth: 1,
    borderRadius: 2,
  },
  cardRed: {
    backgroundColor: '#ef4444',
    borderColor: '#dc2626',
    borderWidth: 1,
    borderRadius: 2,
  },
  cardSm: {
    width: 9,
    height: 13,
  },
  cardMd: {
    width: 12,
    height: 17,
  },
});
