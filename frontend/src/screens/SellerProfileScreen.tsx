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
  Modal,
  Clipboard,
  Image,
  DeviceEventEmitter,
} from 'react-native';
import { withMinimumDelay } from '../utils/refresh';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { Feather, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  marketplaceService,
  SellerProfileRecord,
  MarketplaceItemRecord,
} from '../services/marketplaceService';
import { MarketplaceItemCard } from '../components/marketplace/MarketplaceItemCard';
import Toast from 'react-native-toast-message';
import { SIGNAL_LOGO_BASE64 } from '../assets/signalLogo';
import { pb } from '../services/pocketbase';
import { EntityCommentBox } from '../components/EntityCommentBox';
import { PostCard } from '../components/PostCard';
import { SocialButtonsRow } from '../components/SocialButtonsRow';

interface ContactModalData {
  type: 'whatsapp' | 'instagram' | 'telegram' | 'signal' | 'email';
  title: string;
  value: string;
  actionUrl: string;
  iconName: string;
  iconFamily: 'FontAwesome' | 'Feather' | 'MaterialCommunityIcons';
  color: string;
}

type Props = NativeStackScreenProps<RootStackParamList, 'SellerProfile'>;

export const SellerProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user: currentUser } = useAuth();
  const { sellerProfileId, userId } = route.params || {};

  const [sellerProfile, setSellerProfile] = useState<SellerProfileRecord | null>(null);
  const [items, setItems] = useState<MarketplaceItemRecord[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isRecommended, setIsRecommended] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);

  const [activeContactModal, setActiveContactModal] = useState<ContactModalData | null>(null);

  const copyToClipboard = (text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        Clipboard.setString(text);
      }
    } catch {
      Clipboard.setString(text);
    }
    Toast.show({
      type: 'success',
      text1: '¡Copiado!',
      text2: `${text} se copió al portapapeles.`,
    });
  };

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
        // Las 3 son independientes entre sí, solo dependen de profile.id (ya resuelto).
        const [recResult, itemsResult, commentsResult] = await Promise.allSettled([
          marketplaceService.hasUserRecommended(profile.id),
          marketplaceService.getMarketplaceItems({ sellerProfileId: profile.id, perPage: 50 }),
          pb.collection('posts').getList(1, 50, {
            filter: `targetType = "seller_profile" && targetId = "${profile.id}" && actionType = "comment" && deleted = false`,
            sort: '+created',
            expand: 'author',
          }),
        ]);

        setIsRecommended(recResult.status === 'fulfilled' ? recResult.value : false);
        setItems(itemsResult.status === 'fulfilled' ? itemsResult.value.items : []);
        if (commentsResult.status === 'fulfilled') {
          setComments(commentsResult.value.items);
        } else {
          console.error('Error loading seller wall comments:', commentsResult.reason);
        }
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

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => loadData(), 400);
      setLoading(false);
    });
    return () => sub.remove();
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

  const handleOpenWhatsAppModal = () => {
    if (!sellerProfile?.wsp_phone) return;
    const phone = sellerProfile.wsp_phone.trim();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    setActiveContactModal({
      type: 'whatsapp',
      title: 'WhatsApp',
      value: phone,
      actionUrl: `https://wa.me/${cleanPhone}`,
      iconName: 'whatsapp',
      iconFamily: 'FontAwesome',
      color: '#25D366',
    });
  };

  const handleOpenInstagramModal = () => {
    if (!sellerProfile?.instagram_handle) return;
    const handle = sellerProfile.instagram_handle.trim();
    const cleanHandle = handle.replace(/^@/, '');
    setActiveContactModal({
      type: 'instagram',
      title: 'Instagram',
      value: handle.startsWith('@') ? handle : `@${handle}`,
      actionUrl: `https://instagram.com/${cleanHandle}`,
      iconName: 'instagram',
      iconFamily: 'Feather',
      color: '#E1306C',
    });
  };

  const handleOpenTelegramModal = () => {
    if (!sellerProfile?.telegram_handle) return;
    const handle = sellerProfile.telegram_handle.trim();
    const cleanHandle = handle.replace(/^@/, '');
    setActiveContactModal({
      type: 'telegram',
      title: 'Telegram',
      value: handle.startsWith('@') ? handle : `@${handle}`,
      actionUrl: `https://t.me/${cleanHandle}`,
      iconName: 'telegram',
      iconFamily: 'FontAwesome',
      color: '#229ED9',
    });
  };

  const handleOpenSignalModal = () => {
    if (!sellerProfile?.signal_phone) return;
    const val = sellerProfile.signal_phone.trim();
    const cleanVal = val.replace(/^@/, '');
    const actionUrl = cleanVal.includes('.')
      ? `https://signal.me/#eu/${cleanVal}`
      : `https://signal.me/#p/${cleanVal.replace(/[^0-9+]/g, '')}`;

    setActiveContactModal({
      type: 'signal',
      title: 'Signal',
      value: val,
      actionUrl,
      iconName: 'signal-variant',
      iconFamily: 'MaterialCommunityIcons',
      color: '#3A76F0',
    });
  };

  const handleOpenEmailModal = () => {
    if (!sellerProfile?.contact_email) return;
    const email = sellerProfile.contact_email.trim();
    setActiveContactModal({
      type: 'email',
      title: 'Correo Electrónico',
      value: email,
      actionUrl: `mailto:${email}`,
      iconName: 'envelope',
      iconFamily: 'FontAwesome',
      color: '#ea4335',
    });
  };

  const handleSendComment = async (content: string, photoFile: File | null) => {
    if ((!content.trim() && !photoFile) || !currentUser || !sellerProfile) return;
    try {
      const sellerUser = sellerProfile.expand?.user;
      const postData: any = {
        content: content.trim() || ' ',
        author: currentUser.id,
        actionType: 'comment',
        targetType: 'seller_profile',
        targetId: sellerProfile.id,
        targetMeta: {
          sellerName: sellerUser?.name || 'Vendedor',
          sellerUsername: sellerUser?.username || '',
          bio: sellerProfile.bio || '',
        },
      };
      if (photoFile) postData.photo = photoFile;

      const created = await pb.collection('posts').create(postData, { expand: 'author' });
      setComments((prev) => [...prev, created]);
      Toast.show({ type: 'success', text1: 'Comentario publicado en el muro' });
    } catch (err) {
      console.error('Error enviando comentario al muro:', err);
      Toast.show({ type: 'error', text1: 'Error al publicar comentario' });
      throw err;
    }
  };

  const toggleLikeComment = async (post: any) => {
    if (!currentUser) return;
    try {
      const currentLikes = post.likes || [];
      let newLikes = [...currentLikes];
      if (newLikes.includes(currentUser.id)) {
        newLikes = newLikes.filter((id: string) => id !== currentUser.id);
      } else {
        newLikes.push(currentUser.id);
      }
      setComments((prev) => prev.map((p) => (p.id === post.id ? { ...p, likes: newLikes } : p)));
      await pb.collection('posts').update(post.id, { likes: newLikes });
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };

  const handleDeleteComment = async (postId: string) => {
    try {
      setComments((prev) => prev.filter((p) => p.id !== postId));
      await pb.collection('posts').update(postId, { deleted: true });
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const handleQuoteSellerProfile = () => {
    if (!sellerProfile) return;
    const sellerUser = sellerProfile.expand?.user;
    navigation.navigate('Home', {
      quoteTargetType: 'seller_profile',
      quoteTargetId: sellerProfile.id,
      quoteTargetMeta: {
        sellerName: sellerUser?.name || 'Perfil de Vendedor',
        sellerUsername: sellerUser?.username || '',
        bio: sellerProfile.bio || '',
      },
    });
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
          {/* Botón Estrella de Recomendación en la Esquina Superior Derecha */}
          {!isOwner && currentUser && (
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
                  size={24}
                  color={isRecommended ? '#f59e0b' : '#666666'}
                />
              )}
            </TouchableOpacity>
          )}

          <View style={styles.avatarRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => sellerUser?.id && navigation.navigate('UserProfile', { userId: sellerUser.id })}
            >
              <Avatar user={sellerUser} size={70} />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center', paddingRight: !isOwner && currentUser ? 36 : 0 }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => sellerUser?.id && navigation.navigate('UserProfile', { userId: sellerUser.id })}
              >
                <Text style={styles.sellerName}>{sellerUser?.name || 'Vendedor'}</Text>
              </TouchableOpacity>

              <View style={styles.sellerSubRow}>
                {!!sellerUser?.username && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => sellerUser?.id && navigation.navigate('UserProfile', { userId: sellerUser.id })}
                  >
                    <Text style={styles.sellerHandle}>@{sellerUser.username}</Text>
                  </TouchableOpacity>
                )}
                {!!sellerUser?.username && <Text style={styles.dotSeparator}>·</Text>}
                <TouchableOpacity
                  style={styles.recommendInline}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('FollowList', {
                    userId: sellerProfile.id,
                    type: 'recommendations',
                    username: sellerUser?.name || sellerUser?.username || 'Vendedor'
                  })}
                >
                  <FontAwesome name="star" size={12} color="#f59e0b" style={{ marginRight: 3 }} />
                  <Text style={styles.recommendCount}>{sellerProfile.recommendations_count || 0}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Bio de la Tienda */}
          {!!sellerProfile.bio && <Text style={styles.bioText}>{sellerProfile.bio}</Text>}

          {/* Botones de Contacto Directo */}
          <SocialButtonsRow
            contacts={{
              whatsapp: sellerProfile.wsp_phone,
              instagram: sellerProfile.instagram_handle,
              telegram: sellerProfile.telegram_handle,
              signal: sellerProfile.signal_phone,
              email: sellerProfile.contact_email,
            }}
          />

          {/* Botones de Administración si es el dueño */}
          {isOwner && (
            <View style={styles.ownerActionsRow}>
              <TouchableOpacity
                style={styles.editStoreBtn}
                onPress={() => navigation.navigate('SellerProfileEditor', { sellerProfileId: sellerProfile.id })}
              >
                <Feather name="edit-3" size={14} color={theme.colors.text} />
                <Text style={styles.editStoreBtnText}>Editar Muro</Text>
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

        {/* SECCIÓN DE MURO / COMENTARIOS DEL VENDEDOR */}
        <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.lg }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>Muro del Vendedor ({comments.length})</Text>

          <TouchableOpacity
            style={styles.quoteHeaderBtn}
            activeOpacity={0.7}
            onPress={handleQuoteSellerProfile}
          >
            <FontAwesome name="quote-left" size={11} color={theme.colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.quoteHeaderBtnText}>Citar Tienda</Text>
          </TouchableOpacity>
        </View>

        {/* Caja de Comentarios Reutilizable Inline */}
        {currentUser && (
          <EntityCommentBox
            placeholder="Escribe en el muro de este vendedor..."
            style={{ marginHorizontal: -theme.spacing.md }}
            onSendComment={handleSendComment}
          />
        )}

        {comments.length === 0 ? (
          <View style={{ padding: theme.spacing.xl, alignItems: 'center' }}>
            <Feather name="message-square" size={28} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Aún no hay publicaciones en este muro.</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>Sé el primero en dejar una reseña o comentario.</Text>
          </View>
        ) : (
          comments.map((c) => (
            <View key={c.id} style={{ marginHorizontal: -theme.spacing.md }}>
              <PostCard
                post={c}
                currentUser={currentUser}
                hideTargetContext={true}
                onPress={() => navigation.push('PostDetail', { postId: c.id })}
                onLikePress={() => toggleLikeComment(c)}
                onDeletePress={() => handleDeleteComment(c.id)}
                onAuthorPress={() => navigation.push('UserProfile', { userId: c.author })}
              />
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal de Acción de Contacto */}
      <Modal
        visible={!!activeContactModal}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveContactModal(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActiveContactModal(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            {/* Header del Modal */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconCircle, { backgroundColor: `${activeContactModal?.color}15`, borderColor: activeContactModal?.color }]}>
                {activeContactModal?.type === 'signal' ? (
                  <Image source={{ uri: SIGNAL_LOGO_BASE64 }} style={{ width: 34, height: 34, borderRadius: 17 }} />
                ) : (
                  <>
                    {activeContactModal?.iconFamily === 'FontAwesome' && (
                      <FontAwesome name={activeContactModal.iconName as any} size={28} color={activeContactModal.color} />
                    )}
                    {activeContactModal?.iconFamily === 'MaterialCommunityIcons' && (
                      <MaterialCommunityIcons name={activeContactModal.iconName as any} size={28} color={activeContactModal.color} />
                    )}
                    {activeContactModal?.iconFamily === 'Feather' && (
                      <Feather name={activeContactModal.iconName as any} size={28} color={activeContactModal.color} />
                    )}
                  </>
                )}
              </View>
              <Text style={styles.modalTitle}>{activeContactModal?.title}</Text>
            </View>

            {/* Caja de Datos de Contacto */}
            <View style={styles.contactValueBox}>
              <Text style={styles.contactValueText} selectable>{activeContactModal?.value}</Text>
            </View>

            {/* Botones de Acción */}
            <View style={styles.modalActionsRow}>
              {/* Botón Ir al Enlace */}
              <TouchableOpacity
                style={[styles.modalActionPrimary, { backgroundColor: activeContactModal?.color }]}
                onPress={() => {
                  if (activeContactModal?.actionUrl) {
                    Linking.openURL(activeContactModal.actionUrl);
                  }
                  setActiveContactModal(null);
                }}
              >
                <Feather name="external-link" size={16} color="#000000" />
                <Text style={styles.modalActionPrimaryText}>Ir al Enlace</Text>
              </TouchableOpacity>

              {/* Botón Copiar */}
              <TouchableOpacity
                style={styles.modalActionSecondary}
                onPress={() => {
                  if (activeContactModal?.value) {
                    copyToClipboard(activeContactModal.value);
                  }
                  setActiveContactModal(null);
                }}
              >
                <Feather name="copy" size={16} color={theme.colors.text} />
                <Text style={styles.modalActionSecondaryText}>Copiar</Text>
              </TouchableOpacity>
            </View>

            {/* Botón Cerrar */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setActiveContactModal(null)}
            >
              <Text style={styles.modalCloseBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  quoteHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quoteHeaderBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  profileCard: {
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
    width: '100%',
  },
  contactChip: {
    minWidth: '47%',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 9,
    gap: 8,
  },
  contactChipText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  contactValueBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
    alignItems: 'center',
  },
  contactValueText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalActionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  modalActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  modalActionPrimaryText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  modalActionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  modalActionSecondaryText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  modalCloseBtn: {
    paddingVertical: 6,
  },
  modalCloseBtnText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
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
