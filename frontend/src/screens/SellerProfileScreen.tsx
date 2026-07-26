import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { Feather } from '@expo/vector-icons';
import {
  marketplaceService,
  SellerProfileRecord,
  MarketplaceItemRecord,
} from '../services/marketplaceService';
import { MarketplaceItemCard } from '../components/marketplace/MarketplaceItemCard';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerProfile'>;

export const SellerProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user: currentUser } = useAuth();
  const { sellerProfileId, userId } = route.params || {};

  const [sellerProfile, setSellerProfile] = useState<SellerProfileRecord | null>(null);
  const [items, setItems] = useState<MarketplaceItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isRecommended, setIsRecommended] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);

  const isOwner =
    currentUser &&
    sellerProfile &&
    (sellerProfile.user === currentUser.id || sellerProfile.expand?.user?.id === currentUser.id);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let profile: SellerProfileRecord | null = null;
      if (sellerProfileId) {
        profile = await marketplaceService.getSellerProfileById(sellerProfileId);
      } else if (userId) {
        profile = await marketplaceService.getSellerProfile(userId);
      } else if (currentUser) {
        profile = await marketplaceService.getSellerProfile(currentUser.id);
      }

      setSellerProfile(profile);

      if (profile) {
        // Cargar recomendación
        const recStatus = await marketplaceService.hasUserRecommended(profile.id);
        setIsRecommended(recStatus);

        // Cargar productos del vendedor
        const res = await marketplaceService.getMarketplaceItems({
          sellerProfileId: profile.id,
          perPage: 50,
        });
        setItems(res.items);
      }
    } catch (err) {
      console.error('Error loading seller profile:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sellerProfileId, userId, currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

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
      setSellerProfile({
        ...sellerProfile,
        recommendations_count: res.count,
      });

      Toast.show({
        type: 'success',
        text1: res.isRecommended ? '¡Vendedor Recomendado!' : 'Recomendación retirada',
        text2: res.isRecommended
          ? `Le diste tu respaldo a ${sellerProfile.expand?.user?.name || 'este vendedor'}.`
          : 'Has retirado tu recomendación.',
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

  const openWhatsApp = () => {
    if (!sellerProfile?.wsp_phone) return;
    const phone = sellerProfile.wsp_phone.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${phone}`);
  };

  const openInstagram = () => {
    if (!sellerProfile?.instagram_handle) return;
    const handle = sellerProfile.instagram_handle.replace(/^@/, '');
    Linking.openURL(`https://instagram.com/${handle}`);
  };

  const openTelegram = () => {
    if (!sellerProfile?.telegram_handle) return;
    const handle = sellerProfile.telegram_handle.replace(/^@/, '');
    Linking.openURL(`https://t.me/${handle}`);
  };

  const openSignal = () => {
    if (!sellerProfile?.signal_phone) return;
    const phone = sellerProfile.signal_phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`https://signal.me/#p/${phone}`);
  };

  const openEmail = () => {
    if (!sellerProfile?.contact_email) return;
    Linking.openURL(`mailto:${sellerProfile.contact_email}`);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!sellerProfile) {
    return (
      <View style={styles.centerContainer}>
        <Feather name="shopping-bag" size={48} color={theme.colors.textMuted} />
        <Text style={styles.emptyTitle}>Tienda no encontrada</Text>
        <Text style={styles.emptySub}>Este usuario no ha activado su perfil de vendedor.</Text>
        {currentUser && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('SellerProfileEditor')}
          >
            <Text style={styles.primaryBtnText}>Activar Mi Perfil de Vendedor</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const sellerUser = sellerProfile.expand?.user;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Cabecera del Vendedor */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <Avatar user={sellerUser} size={70} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.sellerName}>{sellerUser?.name || 'Vendedor'}</Text>
              {!!sellerUser?.username && <Text style={styles.sellerHandle}>@{sellerUser.username}</Text>}

              <View style={styles.recBadgeRow}>
                <View style={styles.recBadge}>
                  <Feather name="thumbs-up" size={12} color={theme.colors.primary} />
                  <Text style={styles.recBadgeText}>
                    {sellerProfile.recommendations_count || 0} Recomendaciones
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Bio de la Tienda */}
          {!!sellerProfile.bio && <Text style={styles.bioText}>{sellerProfile.bio}</Text>}

          {/* Botones de Contacto Directo */}
          <View style={styles.contactRow}>
            {!!sellerProfile.wsp_phone && (
              <TouchableOpacity style={styles.wspBtn} onPress={openWhatsApp}>
                <Feather name="message-circle" size={15} color="#ffffff" />
                <Text style={styles.wspBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            )}

            {!!sellerProfile.instagram_handle && (
              <TouchableOpacity style={styles.igBtn} onPress={openInstagram}>
                <Feather name="instagram" size={15} color="#ffffff" />
                <Text style={styles.igBtnText}>
                  {sellerProfile.instagram_handle.startsWith('@')
                    ? sellerProfile.instagram_handle
                    : `@${sellerProfile.instagram_handle}`}
                </Text>
              </TouchableOpacity>
            )}

            {!!sellerProfile.telegram_handle && (
              <TouchableOpacity style={styles.telegramBtn} onPress={openTelegram}>
                <Feather name="send" size={15} color="#ffffff" />
                <Text style={styles.telegramBtnText}>
                  {sellerProfile.telegram_handle.startsWith('@')
                    ? sellerProfile.telegram_handle
                    : `@${sellerProfile.telegram_handle}`}
                </Text>
              </TouchableOpacity>
            )}

            {!!sellerProfile.signal_phone && (
              <TouchableOpacity style={styles.signalBtn} onPress={openSignal}>
                <Feather name="shield" size={15} color="#ffffff" />
                <Text style={styles.signalBtnText}>Signal</Text>
              </TouchableOpacity>
            )}

            {!!sellerProfile.contact_email && (
              <TouchableOpacity style={styles.emailBtn} onPress={openEmail}>
                <Feather name="mail" size={15} color="#ffffff" />
                <Text style={styles.emailBtnText}>Email</Text>
              </TouchableOpacity>
            )}

            {/* Botón de Recomendación (+1) */}
            {!isOwner && currentUser && (
              <TouchableOpacity
                style={[styles.recommendBtn, isRecommended && styles.recommendBtnActive]}
                onPress={handleToggleRecommend}
                disabled={recommendLoading}
              >
                {recommendLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Feather name="thumbs-up" size={14} color={isRecommended ? theme.colors.primary : '#ffffff'} />
                    <Text style={[styles.recommendBtnText, isRecommended && styles.recommendBtnTextActive]}>
                      {isRecommended ? 'Recomendado (+1)' : 'Recomendar'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Botones de Administración si es el dueño */}
          {isOwner && (
            <View style={styles.ownerActionsRow}>
              <TouchableOpacity
                style={styles.editStoreBtn}
                onPress={() => navigation.navigate('SellerProfileEditor', { sellerProfileId: sellerProfile.id })}
              >
                <Feather name="edit-3" size={14} color={theme.colors.text} />
                <Text style={styles.editStoreBtnText}>Editar Tienda / Muro</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addPublishBtn}
                onPress={() => navigation.navigate('MarketplaceItemEditor')}
              >
                <Feather name="plus-circle" size={14} color="#000000" />
                <Text style={styles.addPublishBtnText}>Publicar Producto</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>



        {/* CATÁLOGO DE PRODUCTOS DEL VENDEDOR */}
        <View style={styles.catalogSection}>
          <Text style={styles.sectionTitle}>Catálogo de Productos ({items.length})</Text>

          {items.length === 0 ? (
            <View style={styles.emptyCatalog}>
              <Text style={styles.emptyCatalogText}>Este vendedor aún no ha publicado productos.</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {items.map((item) => (
                <View key={item.id} style={styles.gridItem}>
                  <MarketplaceItemCard
                    item={item}
                    onPress={() => navigation.navigate('MarketplaceItemDetail', { itemId: item.id })}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
    padding: 24,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerName: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sellerHandle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  recBadgeRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 6,
  },
  recBadgeText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  bioText: {
    color: theme.colors.text,
    fontSize: 13,
    marginTop: 12,
    lineHeight: 18,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  wspBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  wspBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  igBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E1306C',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  igBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  telegramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#229ED9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  telegramBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  signalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A76F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  signalBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  emailBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  recommendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  recommendBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  recommendBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  recommendBtnTextActive: {
    color: theme.colors.primary,
  },
  ownerActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  editStoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  editStoreBtnText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  addPublishBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  addPublishBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  wallContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  wallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  wallTitle: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '800',
  },
  wallContent: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  catalogSection: {
    marginTop: 6,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  emptyCatalog: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyCatalogText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '48%',
  },
});
