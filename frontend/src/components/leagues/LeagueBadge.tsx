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

  let content: React.ReactNode;
  switch (type) {
    case 'goal':
      // Gol regular: Balón de fútbol blanco
      content = <MaterialCommunityIcons name="soccer" size={iconSize} color="#ffffff" />;
      break;

    case 'own_goal':
      // Autogol: Balón de fútbol rojo
      content = <MaterialCommunityIcons name="soccer" size={iconSize} color="#ef4444" />;
      break;

    case 'penalty_scored':
      // Penal anotado: Arco de fútbol verde
      content = <SoccerGoalIcon size={iconSize} color="#22c55e" />;
      break;

    case 'penalty_missed':
      // Penal fallado: Arco de fútbol rojo
      content = <SoccerGoalIcon size={iconSize} color="#ef4444" />;
      break;

    case 'yellow_card':
      // Tarjeta amarilla: Rectángulo amarillo
      content = <View style={[styles.cardYellow, isSm ? styles.cardSm : styles.cardMd]} />;
      break;

    case 'red_card':
      // Tarjeta roja: Rectángulo rojo
      content = <View style={[styles.cardRed, isSm ? styles.cardSm : styles.cardMd]} />;
      break;

    default:
      return null;
  }

  // Slot cuadrado común (mismo ancho y alto para todos los tipos) — sin esto, el balón/
  // arco (cuadrados de iconSize) y la tarjeta (rectángulo angosto de cardSm/cardMd)
  // ocupaban espacios distintos y quedaban desalineados entre sí en la cronología.
  return (
    <View style={[styles.badgeSlot, { width: iconSize, height: iconSize }]}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  badgeSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
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
