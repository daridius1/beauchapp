import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { Feather, FontAwesome } from '@expo/vector-icons';
import {
  marketplaceService,
  MarketplaceItemRecord,
  CATEGORIES,
} from '../services/marketplaceService';
import { DeleteConfirmationModal } from '../components/marketplace/DeleteConfirmationModal';
import Toast from 'react-native-toast-message';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Props = NativeStackScreenProps<RootStackParamList, 'MarketplaceItemDetail'>;

export const MarketplaceItemDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { itemId } = route.params;
  const { user: currentUser } = useAuth();

  const [item, setItem] = useState<MarketplaceItemRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [isRecommended, setIsRecommended] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadItem = useCallback(async () => {
    setLoading(true);
    try {
      const record = await marketplaceService.getItemDetail(itemId);
      setItem(record);

      if (record?.expand?.seller?.id) {
        const isRec = await marketplaceService.hasUserRecommended(record.expand.seller.id);
        setIsRecommended(isRec);
      }
    } catch (err) {
      console.error('Error fetching item detail:', err);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  if (loading || !item) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const sellerProfile = item.expand?.seller;
  const sellerUser = sellerProfile?.expand?.user || item.expand?.user;
  const isOwner = currentUser && (item.user === currentUser.id || sellerUser?.id === currentUser.id);

  const categoryObj = CATEGORIES.find((c) => c.id === item.category);

  const imageUrls =
    item.images && item.images.length > 0
      ? item.images.map((img) => marketplaceService.getItemImageUrl(item, img))
      : [];

  const handleToggleRecommend = async () => {
    if (!sellerProfile || !currentUser) {
      Toast.show({
        type: 'error',
        text1: 'Autenticación requerida',
        text2: 'Debes iniciar sesión para recomendar a un vendedor.',
      });
      return;
    }

    if (isOwner) {
      Toast.show({
        type: 'info',
        text1: 'Tu propia tienda',
        text2: 'No puedes recomendar tu propio perfil de vendedor.',
      });
      return;
    }

    setRecommendLoading(true);
    try {
      const res = await marketplaceService.toggleRecommendation(sellerProfile.id);
      setIsRecommended(res.isRecommended);
      if (sellerProfile) {
        sellerProfile.recommendations_count = res.count;
      }

      Toast.show({
        type: 'success',
        text1: res.isRecommended ? '¡Vendedor Recomendado!' : 'Recomendación registrada',
        text2: res.isRecommended
          ? `Respaldaste la tienda de ${sellerUser?.name || 'este vendedor'}.`
          : 'Has actualizado tu recomendación.',
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'No se pudo procesar la recomendación.',
      });
    } finally {
      setRecommendLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'available' | 'unavailable') => {
    if (!item) return;
    setStatusLoading(true);
    try {
      const updated = await marketplaceService.updateItemStatus(item.id, newStatus);
      setItem(updated);
      Toast.show({
        type: 'success',
        text1: 'Estado actualizado',
        text2: `El producto fue marcado como ${newStatus === 'available' ? 'Disponible' : 'No disponible'}.`,
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'No se pudo cambiar el estado.',
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!item) return;
    setDeleting(true);
    try {
      await marketplaceService.softDeleteItem(item.id);
      Toast.show({
        type: 'info',
        text1: 'Producto eliminado',
        text2: 'La publicación ha sido removida del Marketplace.',
      });
      setShowDeleteModal(false);
      navigation.goBack();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error al eliminar',
        text2: err.message || 'No se pudo eliminar el producto.',
      });
    } finally {
      setDeleting(false);
    }
  };



  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Galería / Carrusel de Imágenes */}
        {imageUrls.length > 0 ? (
          <View style={styles.galleryContainer}>
            <Image
              source={{ uri: imageUrls[activeImageIndex] }}
              style={styles.galleryImage}
              resizeMode="contain"
            />
            {imageUrls.length > 1 && (
              <View style={styles.thumbnailsRow}>
                {imageUrls.map((url, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.thumbTouch,
                      activeImageIndex === idx && styles.thumbTouchActive,
                    ]}
                    onPress={() => setActiveImageIndex(idx)}
                  >
                    <Image source={{ uri: url }} style={styles.thumbImage} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noImageHeader}>
            <Feather name="box" size={48} color={theme.colors.textMuted} />
          </View>
        )}

        {/* Info Principal */}
        <View style={styles.mainCard}>
          {/* Badge de Categoría & Estado */}
          <View style={styles.badgesRow}>
            <View style={[styles.categoryBadge, { borderColor: categoryObj?.color || theme.colors.primary }]}>
              <Text style={[styles.categoryBadgeText, { color: categoryObj?.color || theme.colors.primary }]}>
                {categoryObj?.label || item.category}
              </Text>
            </View>

            {item.status === 'unavailable' && (
              <View style={styles.unavailableBadge}>
                <Text style={styles.unavailableBadgeText}>NO DISPONIBLE</Text>
              </View>
            )}
            {item.status === 'available' && (
              <View style={styles.availableBadge}>
                <Text style={styles.availableBadgeText}>DISPONIBLE</Text>
              </View>
            )}
          </View>

          {/* Título & Precio */}
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.price}>${item.price.toLocaleString('es-CL')}</Text>

          {/* Sub-tags */}
          {Array.isArray(item.tags) && item.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.map((t, idx) => (
                <View key={idx} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Descripción */}
          <Text style={styles.sectionHeader}>Descripción</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>

        {/* Tarjeta del Vendedor & Botón a su Perfil Dedicado */}
        {sellerProfile && (
          <View style={styles.sellerCard}>
            {!isOwner && (
              <TouchableOpacity
                style={styles.starCornerBtn}
                onPress={handleToggleRecommend}
                disabled={recommendLoading}
                activeOpacity={0.7}
              >
                {recommendLoading ? (
                  <ActivityIndicator size="small" color="#f59e0b" />
                ) : (
                  <FontAwesome
                    name={isRecommended ? 'star' : 'star-o'}
                    size={22}
                    color={isRecommended ? '#f59e0b' : '#666666'}
                  />
                )}
              </TouchableOpacity>
            )}

            <Text style={styles.sectionHeader}>Vendedor</Text>
            <View style={styles.sellerHeaderRow}>
              <Avatar user={sellerUser} size={50} />
              <View style={{ flex: 1, marginLeft: 10, justifyContent: 'center', paddingRight: !isOwner ? 32 : 0 }}>
                <Text style={styles.sellerName}>{sellerUser?.name || 'Vendedor'}</Text>
                <View style={styles.sellerSubRow}>
                  {!!sellerUser?.username && (
                    <Text style={styles.sellerHandle}>@{sellerUser.username}</Text>
                  )}
                  {!!sellerUser?.username && <Text style={styles.dotSeparator}>·</Text>}
                  <View style={styles.recommendInline}>
                    <FontAwesome name="star" size={11} color="#f59e0b" style={{ marginRight: 3 }} />
                    <Text style={styles.recommendCount}>{sellerProfile.recommendations_count || 0}</Text>
                  </View>
                </View>
              </View>
            </View>



            {/* Botón Destacado: Ver Muro / Tienda del Vendedor */}
            <TouchableOpacity
              style={styles.viewStoreBtn}
              onPress={() => navigation.navigate('SellerProfile', { sellerProfileId: sellerProfile.id })}
            >
              <Text style={styles.viewStoreBtnText}>Ver Tienda</Text>
              <Feather name="chevron-right" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Panel de Controles para el Dueño del Producto */}
        {isOwner && (
          <View style={styles.ownerPanel}>
            <Text style={styles.sectionHeader}>Administrar Publicación</Text>
            <View style={styles.ownerActionsRow}>
              {item.status === 'available' ? (
                <TouchableOpacity
                  style={styles.unavailableActionBtn}
                  onPress={() => handleUpdateStatus('unavailable')}
                  disabled={statusLoading}
                >
                  <Feather name="slash" size={14} color="#ffffff" />
                  <Text style={styles.unavailableActionBtnText} numberOfLines={1}>Marcar No Disponible</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.availableActionBtn}
                  onPress={() => handleUpdateStatus('available')}
                  disabled={statusLoading}
                >
                  <Feather name="check-circle" size={14} color="#000000" />
                  <Text style={styles.availableActionBtnText} numberOfLines={1}>Marcar Disponible</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.deleteActionBtn}
                onPress={() => setShowDeleteModal(true)}
              >
                <Feather name="trash-2" size={14} color="#ef4444" />
                <Text style={styles.deleteActionBtnText} numberOfLines={1}>Eliminar Producto</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal de Advertencia Estilo Beauchapp para Eliminar Producto */}
      <DeleteConfirmationModal
        visible={showDeleteModal}
        itemTitle={item.title}
        deleting={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setShowDeleteModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  galleryContainer: {
    backgroundColor: '#161616',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  galleryImage: {
    width: '100%',
    height: 280,
  },
  thumbnailsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    backgroundColor: '#0c0c0c',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  thumbTouch: {
    width: 50,
    height: 50,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbTouchActive: {
    borderColor: theme.colors.primary,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  noImageHeader: {
    height: 180,
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  mainCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  unavailableBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unavailableBadgeText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '800',
  },
  availableBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: theme.colors.primary,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  availableBadgeText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  price: {
    color: theme.colors.primary,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tagChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagChipText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 6,
  },
  description: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  sellerCard: {
    position: 'relative',
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  starCornerBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    padding: 6,
  },
  sellerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sellerName: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sellerHandle: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  sellerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  dotSeparator: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  recommendInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  viewStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  viewStoreBtnText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  ownerPanel: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  ownerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  unavailableActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 10,
    gap: 4,
  },
  unavailableActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  availableActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 10,
    gap: 4,
  },
  availableActionBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 10,
    gap: 4,
  },
  deleteActionBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '800',
  },
});
