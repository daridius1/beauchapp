import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { beaudleService, BeaudleDaySummary } from '../services/beaudleService';
import { RootStackParamList } from '../types/navigation';
import { styles } from './beaudle/BeaudleListScreen.styles';
import { withMinimumDelay } from '../utils/refresh';

type Props = NativeStackScreenProps<RootStackParamList, 'Beaudle'>;

const STATUS_LABELS: Record<string, string> = {
  not_played: 'Sin responder',
  in_progress: 'En curso',
  lost: 'No lo lograste',
};

const formatDay = (day: string) => {
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const BeaudleScreen: React.FC<Props> = ({ navigation }) => {
  const [days, setDays] = useState<BeaudleDaySummary[]>([]);
  const [maxGuesses, setMaxGuesses] = useState(6);
  const [myStreak, setMyStreak] = useState(0);
  const [myBestStreak, setMyBestStreak] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PER_PAGE = 30;

  const fetchDays = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      setError(null);
      const res = await beaudleService.getDays('classic', 1, PER_PAGE);
      setDays(res.days);
      setMaxGuesses(res.maxGuesses);
      setMyStreak(res.myStreak);
      setMyBestStreak(res.myBestStreak);
      setPage(1);
      setHasMore(res.days.length === PER_PAGE);
    } catch (err) {
      console.error('Error fetching Beaudle days:', err);
      setError('No se pudo cargar la lista de días de Beaudle.');
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDays();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  React.useEffect(() => {
    const subRefresh = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchDays(true));
      setLoading(false);
    });
    return () => subRefresh.remove();
  }, []);

  const handlePullRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchDays(true));
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await beaudleService.getDays('classic', nextPage, PER_PAGE);
      setDays((prev) => [...prev, ...res.days]);
      setPage(nextPage);
      setHasMore(res.days.length === PER_PAGE);
    } catch (err) {
      console.error('Error loading more Beaudle days:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const renderStatus = (item: BeaudleDaySummary) => {
    if (item.myStatus === 'won') {
      return { text: `Resuelto en ${item.myGuessCount}/${maxGuesses}`, style: styles.dayStatusWon };
    }
    if (item.myStatus === 'lost') {
      return { text: STATUS_LABELS.lost, style: styles.dayStatusLost };
    }
    return { text: STATUS_LABELS[item.myStatus] || item.myStatus, style: null };
  };

  const renderItem = ({ item, index }: { item: BeaudleDaySummary; index: number }) => {
    const status = renderStatus(item);
    return (
      <TouchableOpacity
        style={[styles.dayRow, index === days.length - 1 && styles.dayRowLast]}
        activeOpacity={0.7}
        onPress={() => navigation.push('BeaudleDay', { day: item.day })}
      >
        <View style={styles.dayInfo}>
          <Text style={styles.dayTitle}>
            {item.isToday ? 'Beaudle de hoy' : (item.dayNumber ? `Beaudle #${item.dayNumber}` : 'Beaudle')}
          </Text>
          <Text style={styles.dayDate}>{formatDay(item.day)}</Text>
        </View>
        <Text style={[styles.dayStatus, status.style]}>{status.text}</Text>
        <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      data={days}
      keyExtractor={(item) => item.day}
      renderItem={renderItem}
      onEndReachedThreshold={0.3}
      onEndReached={handleLoadMore}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handlePullRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
      ListHeaderComponent={
        <>
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.streakRow}>
            <View style={styles.streakItem}>
              <Text style={styles.streakValue}>{myStreak}</Text>
              <Text style={styles.streakLabel}>Racha actual</Text>
            </View>
            <View style={styles.streakItem}>
              <Text style={styles.streakValue}>{myBestStreak}</Text>
              <Text style={styles.streakLabel}>Mejor racha</Text>
            </View>
          </View>
          <View style={styles.divider} />
        </>
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>Todavía no hay ningún Beaudle jugado.</Text>
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.loadMoreBtn}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : null
      }
    />
  );
};
