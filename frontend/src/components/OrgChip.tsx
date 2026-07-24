import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { User } from '../context/AuthContext';

interface Props {
  organization: User;
  onPress?: () => void;
  size?: 'sm' | 'md';
}

export const OrgChip: React.FC<Props> = ({ organization, onPress, size = 'md' }) => {
  const chipText = organization.chip_text?.trim() || organization.name || `@${organization.username}`;
  const chipColor = organization.chip_color?.trim() || '#38bdf8';

  const isSmall = size === 'sm';

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        isSmall ? styles.chipSm : styles.chipMd,
        {
          borderColor: chipColor,
          backgroundColor: `${chipColor}15`, // Translucidez al 15%
        },
      ]}
      activeOpacity={0.75}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[styles.chipText, isSmall ? styles.chipTextSm : styles.chipTextMd, { color: chipColor }]} numberOfLines={1}>
        {chipText}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
  },
  chipMd: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipSm: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  iconCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  chipText: {
    fontWeight: '700',
  },
  chipTextMd: {
    fontSize: 11,
  },
  chipTextSm: {
    fontSize: 10,
  },
});
