import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { User } from '../context/AuthContext';
import { chipBaseStyles } from './chipStyles';

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
        chipBaseStyles.chip,
        isSmall ? chipBaseStyles.chipSm : chipBaseStyles.chipMd,
        styles.chip,
        {
          borderColor: chipColor,
          backgroundColor: `${chipColor}15`, // Translucidez al 15%
        },
      ]}
      activeOpacity={0.75}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[chipBaseStyles.chipText, isSmall ? chipBaseStyles.chipTextSm : chipBaseStyles.chipTextMd, { color: chipColor }]} numberOfLines={1}>
        {chipText}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
});
