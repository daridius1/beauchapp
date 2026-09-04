import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb, getFileUrl } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { CommentsHeader } from './CommentsHeader';
import { EntityCommentBox } from './EntityCommentBox';
import { PostCard } from './PostCard';
import { withMinimumDelay } from '../utils/refresh';
import { Feather } from '@expo/vector-icons';
import { PetRecord, petsService } from '../services/petsService';
import Toast from 'react-native-toast-message';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 450);

interface Props {
  petId: string;
  /** Si vienen, se muestran las flechas de "mascota anterior/siguiente" (uso en Explorar). */
  onPrevProfile?: () => void;
  onNextProfile?: () => void;
  /** "2 de 5": aparece junto a las flechas para que quede claro que hay más mascotas (y,
   * cuando no aparecen flechas, que es porque hay una sola, no porque algo esté roto). */
  positionLabel?: string;
  /** Se llama justo antes de navegar a otra pantalla (ej. cerrar un overlay que envuelve esto). */
  onBeforeNavigate?: () => void;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Ver una mascota se siente como Tinder Beauchef: una tarjeta con su carrusel de fotos
// propio (tap izquierda/derecha) y, debajo, flechas para pasar a la mascota anterior/
// siguiente + el botón de like — mismo layout que TinderDiscoverCard. La diferencia es
// que acá abajo también hay comentarios y cita, inline, sin salir de la vista.
export const PetProfileCard: React.FC<Props> = ({ petId, onPrevProfile, onNextProfile, positionLabel, onBeforeNavigate }) => {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const [pet, setPet] = useState<PetRecord | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [photoIndex, setPhotoIndex] = useState(0);

  const fetchDetail = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);

      const [petRes, commentsRes] = await Promise.allSettled([
        petsService.getOne(petId),
        pb.collection('posts').getList(1, 50, {
          filter: `targetType = "pet" && targetId = "${petId}" && actionType = "comment" && deleted = false`,
          sort: '+created',
          expand: 'author',
        }),
      ]);

      if (petRes.status !== 'fulfilled') throw petRes.reason;
      setPet(petRes.value);
      setPhotoIndex(0);

      if (commentsRes.status === 'fulfilled') setComments((commentsRes.value as any).items);
    } catch (err) {
      console.error('Error fetching pet detail:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDetail();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [petId, user?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchDetail(true));
  };

  const goTo = (fn: () => void) => {
    onBeforeNavigate?.();
    fn();
  };

  const handleSendComment = async (content: string, photoFile: File | null, pollOptions: string[] | null) => {
    if ((!content.trim() && !photoFile) || !user || !pet) return;
    try {
      const postData: any = {
        content: content.trim() || ' ',
        author: user.id,
        actionType: 'comment',
        targetType: 'pet',
        targetId: pet.id,
        targetMeta: {
          name: pet.name,
          description: pet.description,
          photo: pet.photos?.[0] || '',
          ownerName: pet.expand?.user?.name,
          ownerUsername: pet.expand?.user?.username,
        },
      };
      if (photoFile) postData.photo = photoFile;
      if (pollOptions && pollOptions.length >= 2) postData.pollOptions = pollOptions;

      const created = await pb.collection('posts').create(postData, { expand: 'author' });
      setComments((prev) => [...prev, created]);
      setPet((prev) => (prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : prev));
      Toast.show({ type: 'success', text1: 'Comentario publicado' });
    } catch (err) {
      console.error('Error enviando comentario:', err);
      Toast.show({ type: 'error', text1: 'Error al enviar comentario' });
      throw err;
    }
  };

  const toggleLikeComment = async (post: any) => {
    if (!user) return;
    try {
      const currentLikes = post.likes || [];
      let newLikes = [...currentLikes];
      if (newLikes.includes(user.id)) newLikes = newLikes.filter((id: string) => id !== user.id);
      else newLikes.push(user.id);
      setComments((prev) => prev.map((p) => (p.id === post.id ? { ...p, likes: newLikes } : p)));
      await pb.collection('posts').update(post.id, { likes: newLikes });
    } catch (err) {
      console.error('Error liking comment:', err);
      setComments((prev) => prev.map((p) => (p.id === post.id ? { ...p, likes: post.likes || [] } : p)));
    }
  };

  const handleDeleteComment = async (postId: string) => {
    try {
      setComments((prev) => prev.filter((p) => p.id !== postId));
      await pb.collection('posts').update(postId, { deleted: true });
      Toast.show({ type: 'success', text1: 'Comentario eliminado' });
    } catch (err) {
      console.error('Error deleting comment:', err);
      fetchDetail(true);
    }
  };

  const handleCitePet = () => {
    if (!user || !pet) {
      Toast.show({ type: 'info', text1: 'Autenticación requerida', text2: 'Inicia sesión para citar.' });
      return;
    }
    goTo(() =>
      navigation.navigate('Home', {
        quoteTargetType: 'pet',
        quoteTargetId: pet.id,
        quoteTargetMeta: {
          name: pet.name,
          description: pet.description,
          photo: pet.photos?.[0] || '',
          ownerName: pet.expand?.user?.name,
          ownerUsername: pet.expand?.user?.username,
        },
      })
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!pet) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Esta mascota no está disponible.</Text>
      </View>
    );
  }

  const photos = pet.photos || [];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />
      }
    >
      <View style={styles.cardWrapper}>
        <View style={styles.profileCard}>
          <View style={styles.cardImageWrapper}>
            {photos.length > 0 ? (
              <>
                <Image source={{ uri: getFileUrl(pet, photos[photoIndex % photos.length]) }} style={styles.cardImage} />

                <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'box-none' }]}>
                  <TouchableOpacity
                    style={[styles.imageNavArea, { left: 0 }]}
                    onPress={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                  />
                  <TouchableOpacity
                    style={[styles.imageNavArea, { right: 0 }]}
                    onPress={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                  />
                </View>

                {photos.length > 1 && (
                  <View style={styles.photoDotsRow}>
                    {photos.map((_, idx) => (
                      <View key={idx} style={[styles.photoDot, idx === photoIndex % photos.length && styles.photoDotActive]} />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyCardImage}>
                <Feather name="image" size={48} color="#404040" />
                <Text style={styles.emptyCardImageText}>Sin fotos subidas</Text>
              </View>
            )}
          </View>

          <View style={styles.cardDetails}>
            <Text style={styles.cardName}>{pet.name}</Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => pet.user && goTo(() => navigation.push('UserProfile', { userId: pet.user }))}
              style={{ alignSelf: 'flex-start', marginVertical: 2 }}
            >
              <Text style={styles.cardUsername}>
                Mascota de {pet.expand?.user?.name || 'Usuario'}
                {pet.expand?.user?.username ? ` · @${pet.expand.user.username}` : ''}
              </Text>
            </TouchableOpacity>

            {pet.description ? (
              <Text style={styles.cardDesc}>{pet.description}</Text>
            ) : (
              <Text style={[styles.cardDesc, { fontStyle: 'italic', color: '#606060' }]}>Sin descripción</Text>
            )}
          </View>
        </View>

        {(onPrevProfile || onNextProfile) && (
          <View style={styles.swipeButtonsRow}>
            {onPrevProfile && (
              <TouchableOpacity style={[styles.swipeBtn, styles.swipeBtnControl]} onPress={onPrevProfile}>
                <Feather name="arrow-left" size={24} color="#a3a3a3" />
              </TouchableOpacity>
            )}

            {onNextProfile && (
              <TouchableOpacity style={[styles.swipeBtn, styles.swipeBtnControl]} onPress={onNextProfile}>
                <Feather name="arrow-right" size={24} color="#a3a3a3" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {!!positionLabel && <Text style={styles.positionLabel}>{positionLabel}</Text>}
      </View>

      <View style={styles.commentsSection}>
        <CommentsHeader onQuote={handleCitePet} />

        {user && (
          <EntityCommentBox
            placeholder="Escribe un comentario sobre esta mascota..."
            // EntityCommentBox trae su propio padding interno (spacing.md): sin este
            // margen negativo, se suma al padding de commentsSection y la caja queda
            // visiblemente más angosta que la tarjeta de arriba.
            style={{ marginHorizontal: -theme.spacing.md }}
            onSendComment={handleSendComment}
          />
        )}

        {comments.length === 0 ? (
          <View style={styles.emptyAnswers}>
            <Feather name="message-square" size={28} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyAnswersText}>Aún no hay comentarios.</Text>
          </View>
        ) : (
          comments.map((c) => (
            // PostCard también trae padding propio (spacing.md): mismo margen negativo
            // que EntityCommentBox para que quede al ras de la tarjeta de arriba.
            <View key={c.id} style={{ marginHorizontal: -theme.spacing.md }}>
              <PostCard
                post={c}
                currentUser={user}
                hideTargetContext={true}
                onPress={() => goTo(() => navigation.push('PostDetail', { postId: c.id }))}
                onLikePress={() => toggleLikeComment(c)}
                onDeletePress={() => handleDeleteComment(c.id)}
                onAuthorPress={() => goTo(() => navigation.push('UserProfile', { userId: c.author }))}
              />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  cardWrapper: {
    alignItems: 'center',
    width: '100%',
    maxWidth: CARD_WIDTH,
    paddingHorizontal: theme.spacing.md,
  },
  profileCard: {
    width: '100%',
  },
  cardImageWrapper: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0a0a0a',
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imageNavArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
  },
  photoDotsRow: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  photoDotActive: {
    backgroundColor: '#ffffff',
    width: 8,
  },
  emptyCardImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardImageText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  cardDetails: {
    paddingVertical: theme.spacing.md,
  },
  cardName: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  cardUsername: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  cardDesc: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 18,
    marginTop: theme.spacing.sm,
  },
  likeCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  likeCountPillText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  swipeButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
    width: '100%',
  },
  swipeBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  swipeBtnControl: {
    borderColor: '#404040',
  },
  swipeBtnLike: {
    borderColor: '#10B981',
  },
  positionLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  commentsSection: {
    // Mismo paddingHorizontal que cardWrapper (spacing.md, no spacing.lg): si no, el
    // cuadro de comentarios queda más angosto que la tarjeta de arriba y se ve descuadrado.
    width: '100%',
    maxWidth: CARD_WIDTH,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  emptyAnswers: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyAnswersText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
