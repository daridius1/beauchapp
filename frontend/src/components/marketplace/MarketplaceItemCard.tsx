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

  const isSold = item.status === 'sold';
  const isPaused = item.status === 'paused';

  const sellerUser = item.expand?.seller?.expand?.user || item.expand?.user;

  return (
    <TouchableOpacity
      style={[styles.card, (isSold || isPaused) && styles.cardInactive]}
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

        {/* Status Overlay if Sold or Paused */}
        {isSold && (
          <View style={styles.statusOverlaySold}>
            <Text style={styles.statusTextSold}>VENDIDO</Text>
          </View>
        )}
        {isPaused && !isSold && (
          <View style={styles.statusOverlayPaused}>
            <Text style={styles.statusTextPaused}>PAUSADO</Text>
          </View>
        )}
      </View>

      {/* Info Content */}
      <View style={styles.content}>
        {/* Categoría Badge */}
        <View style={styles.categoryRow}>
          <View style={[styles.categoryBadge, { borderColor: categoryObj?.color || theme.colors.primary }]}>
            <Text style={[styles.categoryText, { color: categoryObj?.color || theme.colors.primary }]}>
              {categoryObj?.label || item.category}
            </Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

        {/* Tags */}
        {Array.isArray(item.tags) && item.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {item.tags.slice(0, 2).map((t, idx) => (
              <Text key={idx} style={styles.tagChip}>#{t}</Text>
            ))}
            {item.tags.length > 2 && (
              <Text style={styles.tagMore}>+{item.tags.length - 2}</Text>
            )}
          </View>
        )}

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
  statusOverlaySold: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTextSold: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    borderWidth: 2,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusOverlayPaused: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTextPaused: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  content: {
    padding: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: 4,
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
  title: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  tagChip: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
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
