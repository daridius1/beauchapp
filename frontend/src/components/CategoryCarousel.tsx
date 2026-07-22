import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { theme } from '../theme/theme';
import { CategoryOption } from '../config/ladderGroups';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CategoryCarouselProps {
  categories: CategoryOption[];
  activeCategoryId: string;
  onSelectCategory: (category: CategoryOption) => void;
}

export const CategoryCarousel: React.FC<CategoryCarouselProps> = ({
  categories,
  activeCategoryId,
  onSelectCategory,
}) => {
  if (!categories || categories.length <= 1) {
    return null;
  }

  const handleSelect = (cat: CategoryOption) => {
    if (cat.id === activeCategoryId) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onSelectCategory(cat);
  };

  return (
    <View style={styles.container}>
      <View style={styles.carouselTrack}>
        {categories.map((cat) => {
          const isActive = cat.id === activeCategoryId;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryPill,
                isActive && styles.categoryPillActive,
              ]}
              activeOpacity={0.7}
              onPress={() => handleSelect(cat)}
            >
              <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  carouselTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryPill: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  categoryPillActive: {
    backgroundColor: '#ffffff',
    opacity: 1,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  categoryTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
});
