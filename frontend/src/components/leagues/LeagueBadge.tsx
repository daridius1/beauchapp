import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export type EventBadgeType = 'goal' | 'own_goal' | 'yellow_card' | 'red_card' | 'penalty_scored' | 'penalty_missed';

interface LeagueBadgeProps {
  type: EventBadgeType;
  count?: number;
  size?: 'sm' | 'md';
}

export const LeagueBadge: React.FC<LeagueBadgeProps> = ({ type, count, size = 'sm' }) => {
  const isSm = size === 'sm';
  const iconSize = isSm ? 14 : 16;
  const subIconSize = isSm ? 10 : 12;

  switch (type) {
    case 'yellow_card':
      return <View style={[styles.cardYellow, isSm ? styles.cardSm : styles.cardMd]} />;

    case 'red_card':
      return <View style={[styles.cardRed, isSm ? styles.cardSm : styles.cardMd]} />;

    case 'goal':
      return (
        <View style={styles.iconWrapper}>
          <MaterialCommunityIcons name="soccer" size={iconSize} color="#ffffff" />
          {count && count > 1 ? <Text style={styles.countText}>x{count}</Text> : null}
        </View>
      );

    case 'own_goal':
      return (
        <View style={styles.compoundIcon}>
          <MaterialCommunityIcons name="soccer" size={iconSize} color="#ef4444" />
          <Feather name="corner-down-left" size={subIconSize} color="#ef4444" style={styles.subIcon} />
        </View>
      );

    case 'penalty_scored':
      return (
        <View style={styles.compoundIcon}>
          <MaterialCommunityIcons name="soccer" size={iconSize} color="#ffffff" />
          <Feather name="check" size={subIconSize} color="#22c55e" style={styles.subIcon} />
        </View>
      );

    case 'penalty_missed':
      return (
        <View style={styles.compoundIcon}>
          <MaterialCommunityIcons name="soccer" size={iconSize} color="#666666" />
          <Feather name="x" size={subIconSize} color="#ef4444" style={styles.subIcon} />
        </View>
      );

    default:
      return null;
  }
};

const styles = StyleSheet.create({
  inlineCards: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  compoundIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subIcon: {
    marginLeft: 2,
  },
  countText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 2,
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
