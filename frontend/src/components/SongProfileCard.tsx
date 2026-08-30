import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
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
import { SongPlayer } from './SongPlayer';
import { withMinimumDelay } from '../utils/refresh';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { SongRecord, songsService } from '../services/songsService';
import Toast from 'react-native-toast-message';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 450);

interface Props {
  songId: string;
  onPrevProfile?: () => void;
  onNextProfile?: () => void;
  positionLabel?: string;
  onBeforeNavigate?: () => void;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Mismo patrón que PetProfileCard: una tarjeta con flechas anterior/siguiente + like +
// comentarios y cita inline. La diferencia es que en vez de un carrusel de fotos, arriba
// va el título/autor/año y, debajo, el reproductor.
export const SongProfileCard: React.FC<Props> = ({ songId, onPrevProfile, onNextProfile, positionLabel, onBeforeNavigate }) => {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const [song, setSong] = useState<SongRecord | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [liked, setLiked] = useState(false);
  const [likeRecordId, setLikeRecordId] = useState<string | undefined>(undefined);
  const [likeBusy, setLikeBusy] = useState(false);

  const fetchDetail = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);

      const [songRes, commentsRes, likeRes] = await Promise.allSettled([
        songsService.getOne(songId),
        pb.collection('posts').getList(1, 50, {
          filter: `targetType = "song" && targetId = "${songId}" && actionType = "comment" && deleted = false`,
          sort: '+created',
          expand: 'author',
        }),
        user
          ? songsService.checkIsLiked(songId, user.id)
          : Promise.resolve<{ liked: boolean; likeRecordId?: string }>({ liked: false }),
      ]);

      if (songRes.status !== 'fulfilled') throw songRes.reason;
      setSong(songRes.value);

      if (commentsRes.status === 'fulfilled') setComments((commentsRes.value as any).items);
      if (likeRes.status === 'fulfilled') {
        setLiked(likeRes.value.liked);
        setLikeRecordId(likeRes.value.likeRecordId);
      }
    } catch (err) {
      console.error('Error fetching song detail:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDetail();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [songId, user?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchDetail(true));
  };

  const goTo = (fn: () => void) => {
    onBeforeNavigate?.();
    fn();
  };

  const handleToggleLike = async () => {
    if (!user) {
      Toast.show({ type: 'info', text1: 'Autenticación requerida', text2: 'Inicia sesión para dar like.' });
      return;
    }
    if (likeBusy || !song) return;
    setLikeBusy(true);
    const wasLiked = liked;
    const prevRecordId = likeRecordId;
    setLiked(!wasLiked);
    setSong((prev) => (prev ? { ...prev, like_count: (prev.like_count || 0) + (wasLiked ? -1 : 1) } : prev));
    try {
      const nowLiked = await songsService.toggleLike(song.id, user.id, prevRecordId);
      if (nowLiked) {
        const check = await songsService.checkIsLiked(song.id, user.id);
        setLikeRecordId(check.likeRecordId);
      } else {
        setLikeRecordId(undefined);
      }
    } catch (err) {
      console.error('Error dando like a la canción:', err);
      setLiked(wasLiked);
      setLikeRecordId(prevRecordId);
      setSong((prev) => (prev ? { ...prev, like_count: (prev.like_count || 0) + (wasLiked ? 1 : -1) } : prev));
    } finally {
      setLikeBusy(false);
    }
  };

  const handleSendComment = async (content: string, photoFile: File | null, pollOptions: string[] | null) => {
    if ((!content.trim() && !photoFile) || !user || !song) return;
    try {
      const postData: any = {
        content: content.trim() || ' ',
        author: user.id,
        actionType: 'comment',
        targetType: 'song',
        targetId: song.id,
        targetMeta: {
          title: song.title,
          author: song.author,
          year: song.year,
          description: song.description,
          ownerName: song.expand?.user?.name,
          ownerUsername: song.expand?.user?.username,
        },
      };
      if (photoFile) postData.photo = photoFile;
      if (pollOptions && pollOptions.length >= 2) postData.pollOptions = pollOptions;

      const created = await pb.collection('posts').create(postData, { expand: 'author' });
      setComments((prev) => [...prev, created]);
      setSong((prev) => (prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : prev));
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

  const handleCiteSong = () => {
    if (!user || !song) {
      Toast.show({ type: 'info', text1: 'Autenticación requerida', text2: 'Inicia sesión para citar.' });
      return;
    }
    goTo(() =>
      navigation.navigate('Home', {
        quoteTargetType: 'song',
        quoteTargetId: song.id,
        quoteTargetMeta: {
          title: song.title,
          author: song.author,
          year: song.year,
          description: song.description,
          ownerName: song.expand?.user?.name,
          ownerUsername: song.expand?.user?.username,
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

  if (!song) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Esta canción no está disponible.</Text>
      </View>
    );
  }

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
          <View style={styles.cardDetails}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.cardName}>{song.title}</Text>
              <View style={styles.likeCountPill}>
                <FontAwesome name="heart" size={12} color="#ef4444" />
                <Text style={styles.likeCountPillText}>{song.like_count || 0}</Text>
              </View>
            </View>

            <Text style={styles.cardSubtitle}>
              {song.author}
              {song.year ? ` · ${song.year}` : ''}
            </Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => song.user && goTo(() => navigation.push('UserProfile', { userId: song.user }))}
              style={{ alignSelf: 'flex-start', marginVertical: 2 }}
            >
              <Text style={styles.cardUsername}>
                Canción de {song.expand?.user?.name || 'Usuario'}
                {song.expand?.user?.username ? ` · @${song.expand.user.username}` : ''}
              </Text>
            </TouchableOpacity>

            {song.description ? (
              <Text style={styles.cardDesc}>{song.description}</Text>
            ) : (
              <Text style={[styles.cardDesc, { fontStyle: 'italic', color: '#606060' }]}>Sin descripción</Text>
            )}

            <View style={{ marginTop: theme.spacing.md }}>
              <SongPlayer uri={song.audio ? getFileUrl(song, song.audio) : null} />
            </View>
          </View>
        </View>

        <View style={styles.swipeButtonsRow}>
          {onPrevProfile && (
            <TouchableOpacity style={[styles.swipeBtn, styles.swipeBtnControl]} onPress={onPrevProfile}>
              <Feather name="arrow-left" size={24} color="#a3a3a3" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.swipeBtn, styles.swipeBtnLike, liked && { backgroundColor: '#10B981', borderColor: '#10B981' }]}
            onPress={handleToggleLike}
            disabled={likeBusy}
          >
            <FontAwesome name={liked ? 'heart' : 'heart-o'} size={26} color={liked ? '#ffffff' : '#10B981'} />
          </TouchableOpacity>

          {onNextProfile && (
            <TouchableOpacity style={[styles.swipeBtn, styles.swipeBtnControl]} onPress={onNextProfile}>
              <Feather name="arrow-right" size={24} color="#a3a3a3" />
            </TouchableOpacity>
          )}
        </View>

        {!!positionLabel && <Text style={styles.positionLabel}>{positionLabel}</Text>}
      </View>

      <View style={styles.commentsSection}>
        <CommentsHeader onQuote={handleCiteSong} />

        {user && (
          <EntityCommentBox
            placeholder="Escribe un comentario sobre esta canción..."
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
    paddingTop: theme.spacing.lg,
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
  cardDetails: {
    paddingVertical: theme.spacing.sm,
  },
  cardName: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  cardSubtitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
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
