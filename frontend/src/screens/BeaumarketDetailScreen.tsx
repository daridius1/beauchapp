import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, DeviceEventEmitter, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../theme/theme';
import { CommentsHeader } from '../components/CommentsHeader';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { beaumarketService, BeaumarketMarket } from '../services/beaumarketService';
import { withMinimumDelay } from '../utils/refresh';
import { RootStackParamList } from '../types/navigation';
import { OddsChart } from './beaumarket/OddsChart';
import { TradeModal } from './beaumarket/TradeModal';
import { EntityCommentBox } from '../components/EntityCommentBox';
import { PostCard } from '../components/PostCard';
import { styles } from './beaumarket/BeaumarketDetail.styles';

type Props = NativeStackScreenProps<RootStackParamList, 'BeaumarketDetail'>;

export const BeaumarketDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { marketId } = route.params;
  const { user, refreshUser } = useAuth();

  const [market, setMarket] = useState<BeaumarketMarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tradeOutcome, setTradeOutcome] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);

  const toggleLike = async (post: any) => {
    if (!user) return;
    try {
      const currentLikes = post.likes || [];
      let newLikes = [...currentLikes];
      if (newLikes.includes(user.id)) {
        newLikes = newLikes.filter((id: string) => id !== user.id);
      } else {
        newLikes.push(user.id);
      }
      setComments(current => current.map(c => c.id === post.id ? { ...c, likes: newLikes } : c));
      await pb.collection('posts').update(post.id, { likes: newLikes });
    } catch (err) {
      console.error(err);
      setComments(current => current.map(c => c.id === post.id ? { ...c, likes: post.likes || [] } : c));
    }
  };

  const fetchMarket = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      const [detail, , commentsResult] = await Promise.all([
        beaumarketService.getMarketDetail(marketId),
        refreshUser(),
        pb.collection('posts').getList(1, 50, {
          filter: `targetType = "beaumarket" && targetId = "${marketId}" && actionType = "comment" && deleted = false`,
          sort: 'created',
          expand: 'author,replyTo.author',
        }),
      ]);
      setMarket(detail);
      setComments(commentsResult.items);
    } catch (err) {
      console.error('Error fetching Beaumarket market:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSendComment = async (content: string, photo: File | null, pollOptions: string[] | null) => {
    if (!user || !market) return;

    const formData = new FormData();
    formData.append('author', user.id);
    formData.append('actionType', 'comment');
    formData.append('targetType', 'beaumarket');
    formData.append('targetId', market.id);
    formData.append('content', content || ' ');

    if (photo) {
      formData.append('photo', photo);
    }
    if (pollOptions && pollOptions.length >= 2) {
      formData.append('pollOptions', JSON.stringify(pollOptions));
    }

    await pb.collection('posts').create(formData);
    await fetchMarket(true);
  };

  const handleQuoteMarket = () => {
    if (!market) return;
    navigation.navigate('Home', {
      quoteTargetType: 'beaumarket',
      quoteTargetId: market.id,
      quoteTargetMeta: {
        title: market.title,
        status: market.status,
        outcomes: market.outcomes,
        prices: market.prices,
      },
    });
  };

  useFocusEffect(
    useCallback(() => {
      fetchMarket();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketId])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchMarket(true));
      setLoading(false);
    });
    return () => sub.remove();
  }, []);

  const handlePullRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchMarket(true));
  };

  const handleBet = async (amount: number) => {
    if (tradeOutcome === null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await beaumarketService.placeBet(marketId, tradeOutcome, amount);
      // El modal se queda abierto (se puede seguir apostando en otro resultado) — solo
      // se refresca el mercado para que el saldo y el pozo queden al día.
      await fetchMarket(true);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'No se pudo completar la apuesta.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeTradeModal = () => {
    setTradeOutcome(null);
    setError(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!market) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se encontró este mercado.</Text>
      </View>
    );
  }

  // Se puede seguir apostando mientras el mercado esté abierto — el pozo se mueve solo
  // con la actividad real de apuestas, así que siempre hay motivo para volver. Las
  // apuestas son definitivas, no hay forma de retirarlas.
  const canTrade = market.status === 'open';

  const closesAtLabel = market.closesAt
    ? new Date(market.closesAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handlePullRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <Text style={styles.title}>{market.title}</Text>
      {!!market.description && <Text style={styles.description}>{market.description}</Text>}
      {!!closesAtLabel && (
        <Text style={styles.closesAt}>
          {market.status === 'open' ? `Cierra el ${closesAtLabel}` : `Cerró el ${closesAtLabel}`}
        </Text>
      )}

      {market.history && market.history.length > 0 && (
        <>
          <View style={styles.divider} />
          <OddsChart
            outcomes={market.outcomes}
            history={market.history}
            winningOutcomeIndex={market.winningOutcomeIndex}
            status={market.status}
            myPositions={market.myPositions}
            onSelectOutcome={canTrade ? setTradeOutcome : undefined}
            disabled={submitting}
          />
        </>
      )}

      <TradeModal
        visible={tradeOutcome !== null}
        outcomeLabel={tradeOutcome !== null ? market.outcomes[tradeOutcome] : null}
        outcomeIndex={tradeOutcome}
        balance={user?.beautokens ?? 0}
        submitting={submitting}
        error={error}
        onBet={handleBet}
        onClose={closeTradeModal}
      />

      <View style={styles.commentsSection}>
        <CommentsHeader count={comments.length} onQuote={handleQuoteMarket} />

        <EntityCommentBox
          onSendComment={handleSendComment}
          placeholder="Pregunta o comenta sobre este mercado..."
          style={{ marginHorizontal: -theme.spacing.md }}
        />

        {comments.map((comment) => (
          <View key={comment.id} style={{ marginHorizontal: -theme.spacing.md }}>
            <PostCard
              post={comment}
              currentUser={user}
              hideTargetContext={true}
              onPress={() => navigation.push('PostDetail', { postId: comment.id })}
              onLikePress={() => toggleLike(comment)}
              onAuthorPress={() => navigation.navigate('UserProfile', { userId: comment.author })}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
};
