import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import { MarketplaceItemRecord, CATEGORIES, marketplaceService } from '../../services/marketplaceService';
import { theme } from '../../theme/theme';
import { Avatar } from '../Avatar';
import { Feather } from '@expo/vector-icons';

interface Props {
  item: MarketplaceItemRecord;
  onPress: () => void;
}

export const MarketplaceItemCard: React.FC<Props> = ({ item, onPress }) => {
  const categoryObj = CATEGORIES.find((c) => c.id === item.category);
  const mainImage = item.images && item.images.length > 0
    ? marketplaceService.getItemImageUrl(item, item.images[0])
    : null;

  const isUnavailable = item.status === 'unavailable';

  const sellerUser = item.expand?.seller?.expand?.user || item.expand?.user;

  return (
    <TouchableOpacity
      style={[styles.card, isUnavailable && styles.cardInactive]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      {/* Imagen Principal */}
      <View style={styles.imageContainer}>
        {mainImage ? (
          <Image source={{ uri: mainImage }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.noImage}>
            <Feather name="box" size={32} color={theme.colors.textMuted} />
          </View>
        )}

        {/* Badge de Precio */}
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>${item.price.toLocaleString('es-CL')}</Text>
        </View>

        {/* Status Overlay if Unavailable */}
        {isUnavailable && (
          <View style={styles.statusOverlayUnavailable}>
            <Text style={styles.statusTextUnavailable}>NO DISPONIBLE</Text>
          </View>
        )}
      </View>

      {/* Info Content */}
      <View style={styles.content}>
        {/* Filas de Chips (Categoría Principal + Sub-tags) */}
        <View style={styles.chipsRow}>
          {/* Categoría Principal Chip */}
          <View style={[styles.categoryBadge, { borderColor: categoryObj?.color || theme.colors.primary }]}>
            <Text style={[styles.categoryText, { color: categoryObj?.color || theme.colors.primary }]}>
              {categoryObj?.label || item.category}
            </Text>
          </View>

          {/* Sub-tags Chips */}
          {Array.isArray(item.tags) && item.tags.length > 0 && (
            <>
              {item.tags.slice(0, 2).map((t, idx) => (
                <View key={idx} style={styles.subTagBadge}>
                  <Text style={styles.subTagText}>{t}</Text>
                </View>
              ))}
              {item.tags.length > 2 && (
                <Text style={styles.tagMore}>+{item.tags.length - 2}</Text>
              )}
            </>
          )}
        </View>

        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

        {/* Vendedor Info */}
        {sellerUser && (
          <View style={styles.sellerRow}>
            <Avatar user={sellerUser} size={20} />
            <Text style={styles.sellerName} numberOfLines={1}>
              {sellerUser.name}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  cardInactive: {
    opacity: 0.7,
  },
  imageContainer: {
    height: 160,
    backgroundColor: '#161616',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priceText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  statusOverlayUnavailable: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTextUnavailable: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  content: {
    padding: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  categoryBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
  },
  subTagBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  subTagText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  title: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 18,
  },
  tagMore: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  sellerName: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
});
