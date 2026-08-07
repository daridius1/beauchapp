import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { ProfessorRecord, DualRatingSummary } from '../services/reviewsService';

interface Props {
  professor: ProfessorRecord;
  rating?: DualRatingSummary;
  onPress: () => void;
}

const renderStars = (value: number, color: string) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (value >= i) {
      stars.push(<FontAwesome key={i} name="star" size={12} color={color} style={{ marginRight: 2 }} />);
    } else if (value >= i - 0.75) {
      stars.push(<FontAwesome key={i} name="star-half-o" size={12} color={color} style={{ marginRight: 2 }} />);
    } else {
      stars.push(<FontAwesome key={i} name="star" size={12} color="#262626" style={{ marginRight: 2 }} />);
    }
  }
  return stars;
};

export const ProfessorListItem: React.FC<Props> = ({ professor, rating, onPress }) => {
  const r = rating || { rating: 0, ratingCount: 0, secondary: 0, secondaryCount: 0, myRating: 0, mySecondary: 0 };

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{professor.nombre}</Text>

        <View style={styles.ratingsRow}>
          <View style={styles.ratingCol}>
            <Text style={styles.ratingLabel}>Clases: </Text>
            <View style={styles.starsWrapper}>
              {renderStars(r.rating, '#F59E0B')}
              {r.ratingCount > 0 ? (
                <Text style={styles.ratingCount}>{r.rating} ({r.ratingCount})</Text>
              ) : (
                <Text style={styles.ratingCount}>Sin notas</Text>
              )}
            </View>
          </View>
          <View style={styles.ratingCol}>
            <Text style={styles.ratingLabel}>Gestión: </Text>
            <View style={styles.starsWrapper}>
              {renderStars(r.secondary, '#EF4444')}
              {r.secondaryCount > 0 ? (
                <Text style={styles.ratingCount}>{r.secondary} ({r.secondaryCount})</Text>
              ) : (
                <Text style={styles.ratingCount}>Sin notas</Text>
              )}
            </View>
          </View>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  ratingsRow: {
    marginTop: 4,
  },
  ratingCol: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    width: 62,
  },
  starsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingCount: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginLeft: 4,
  },
});
