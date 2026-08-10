import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, DeviceEventEmitter, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { beaudleService, BeaudleGameState } from '../services/beaudleService';
import { BeaudlePlace } from './beaudle/places';
import { PlaceSelector } from './beaudle/PlaceSelector';
import { GuessRow, GuessRowHeader } from './beaudle/GuessRow';
import { BeaudleStatsPanel } from './beaudle/BeaudleStatsPanel';
import { BeaudleSuccessModal } from './beaudle/BeaudleSuccessModal';
import { BeaudleInfoModal } from './beaudle/BeaudleInfoModal';
import { EntityCommentBox } from '../components/EntityCommentBox';
import { PostCard } from '../components/PostCard';
import { styles } from './beaudle/BeaudleScreen.styles';
import { withMinimumDelay } from '../utils/refresh';

export const BeaudleScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [game, setGame] = useState<BeaudleGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [comments, setComments] = useState<any[]>([]);

  const loadComments = async (statsId: string) => {
    try {
      const res = await pb.collection('posts').getList(1, 50, {
        filter: `targetType = "beaudle" && targetId = "${statsId}" && deleted = false`,
        sort: 'created',
        expand: 'author,replyTo.author',
      });
      setComments(res.items);
    } catch (err) {
      console.error('Error cargando comentarios del Beaudle de hoy:', err);
    }
  };

  const fetchToday = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      const data = await beaudleService.getToday();
      setGame(data);
      if (data.status !== 'in_progress' && data.statsId) {
        loadComments(data.statsId);
      }
    } catch (err) {
      console.error('Error fetching Beaudle:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchToday();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    const subRefresh = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchToday(true));
      setLoading(false);
    });
    return () => subRefresh.remove();
  }, []);

  const handlePullRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchToday(true));
  };

  const handleGuess = async (place: BeaudlePlace) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await beaudleService.submitGuess(place.code);
      setGame(data);
      if (data.status === 'won') {
        setShowSuccessModal(true);
      }
      if (data.status !== 'in_progress' && data.statsId) {
        loadComments(data.statsId);
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'No se pudo registrar tu intento.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendComment = async (content: string, photo: File | null) => {
    if (!user || !game?.statsId) return;

    const formData = new FormData();
    formData.append('author', user.id);
    formData.append('actionType', 'comment');
    formData.append('targetType', 'beaudle');
    formData.append('targetId', game.statsId);
    formData.append('content', content || ' ');

    if (photo) {
      formData.append('photo', photo);
    }

    await pb.collection('posts').create(formData);
    await loadComments(game.statsId);
  };

  const handleQuoteBeaudle = () => {
    if (!game?.statsId) return;
    // Sin spoilers: nunca el lugar/código secreto, solo el resultado (ganó/perdió y en
    // cuántos intentos) — mismos datos que ya se muestran en el panel de stats.
    navigation.navigate('Home', {
      quoteTargetType: 'beaudle',
      quoteTargetId: game.statsId,
      quoteTargetMeta: {
        day: game.day,
        variant: game.variant,
        status: game.status,
        solvedAtGuess: game.solvedAtGuess,
        maxGuesses: game.maxGuesses,
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!game) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se pudo cargar el Beaudle de hoy.</Text>
      </View>
    );
  }

  const isInProgress = game.status === 'in_progress';
  const guessedCodes = game.guesses.map((g) => g.code);
  const ownBucket = !isInProgress
    ? (game.status === 'won' ? String(game.guesses.length) : 'failed')
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handlePullRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <View style={styles.intro}>
        <Text style={styles.guessesRemaining}>
          {isInProgress
            ? `Te quedan ${game.guessesRemaining} de ${game.maxGuesses} intentos.`
            : game.status === 'won' ? '¡Felicidades, lo lograste!' : 'Fallaste esta vez.'}
        </Text>
        <TouchableOpacity style={styles.infoButton} activeOpacity={0.7} onPress={() => setInfoVisible(true)}>
          <Feather name="info" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {game.status === 'lost' && (
        <View style={[styles.endBanner, styles.endBannerLost]}>
          <Text style={styles.endBannerTitle}>Se acabaron los intentos.</Text>
          {game.revealedPlace && (
            <Text style={styles.endBannerText}>
              El lugar secreto era {game.revealedPlace.name} ({game.revealedPlace.shortName}).
            </Text>
          )}
        </View>
      )}

      {isInProgress && (
        <View style={styles.pickerSection}>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <PlaceSelector disabledCodes={guessedCodes} disabled={submitting} onConfirm={handleGuess} />
        </View>
      )}

      {game.guesses.length > 0 && <GuessRowHeader />}
      {[...game.guesses].reverse().map((g, idx) => (
        <GuessRow key={`${g.code}-${game.guesses.length - idx}`} guess={g} />
      ))}

      {!isInProgress && <BeaudleStatsPanel stats={game.stats} ownBucket={ownBucket} />}

      {/* Comentarios y citas — solo una vez terminado el Beaudle de hoy, sin spoilers */}
      {!isInProgress && game.statsId && (
        <>
          <View style={styles.divider} />
          <View style={styles.commentsHeaderRow}>
            <Text style={styles.sectionTitle}>Comentarios ({comments.length})</Text>
            <TouchableOpacity
              style={styles.quoteHeaderBtn}
              activeOpacity={0.7}
              onPress={handleQuoteBeaudle}
            >
              <FontAwesome name="quote-left" size={11} color={theme.colors.text} style={{ marginRight: 6 }} />
              <Text style={styles.quoteHeaderBtnText}>Citar</Text>
            </TouchableOpacity>
          </View>

          {user && (
            <EntityCommentBox
              onSendComment={handleSendComment}
              placeholder="Comenta sobre el Beaudle de hoy..."
              style={{ marginHorizontal: -theme.spacing.md }}
            />
          )}

          {comments.map((comment) => (
            <View key={comment.id} style={{ marginHorizontal: -theme.spacing.md }}>
              <PostCard
                post={comment}
                currentUser={user}
                hideTargetContext={true}
                onPress={() => navigation.push('PostDetail', { postId: comment.id })}
                onAuthorPress={() => navigation.navigate('UserProfile', { userId: comment.author })}
              />
            </View>
          ))}
        </>
      )}

      <BeaudleSuccessModal
        visible={showSuccessModal}
        guessCount={game.guesses.length}
        placeName={game.revealedPlace?.name}
        placeShortName={game.revealedPlace?.shortName}
        onClose={() => setShowSuccessModal(false)}
      />

      <BeaudleInfoModal visible={infoVisible} onClose={() => setInfoVisible(false)} />
    </ScrollView>
  );
};
