import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { RootStackParamList } from '../types/navigation';
import { NewsArticle } from '../types/news';
import { newsService } from '../services/newsService';
import { getFileUrl } from '../services/pocketbase';
import { withMinimumDelay } from '../utils/refresh';
import { OrgChip } from '../components/OrgChip';

type Props = NativeStackScreenProps<RootStackParamList, 'NoticiasList'>;

const PER_PAGE = 20;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const NoticiasListScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const isFirstLoad = useRef(true);

  const fetchNews = useCallback(async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      const { items: fetched, totalPages } = await newsService.listNews(1, PER_PAGE);
      setItems(fetched);
      setPage(1);
      setHasMore(totalPages > 1);
    } catch (err) {
      console.error('Error cargando noticias:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNews(!isFirstLoad.current);
      isFirstLoad.current = false;
    }, [fetchNews])
  );

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchNews(true));
      setLoading(false);
    });
    return () => sub.remove();
  }, [fetchNews]);

  const onRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchNews(true));
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { items: fetched, totalPages } = await newsService.listNews(nextPage, PER_PAGE);
      setItems((prev) => [...prev, ...fetched]);
      setPage(nextPage);
      setHasMore(nextPage < totalPages);
    } catch (err) {
      console.error('Error cargando más noticias:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onEndReachedThreshold={0.3}
          onEndReached={handleLoadMore}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="file-text" size={40} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>Todavía no hay noticias.</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.push('NoticiaDetail', { newsId: item.id, title: item.title })}
            >
              {!!item.coverImage && (
                <Image source={{ uri: getFileUrl(item, item.coverImage) }} style={styles.coverImage} resizeMode="cover" />
              )}
              <View style={styles.cardBody}>
                {item.expand?.author && <OrgChip organization={item.expand.author as any} size="sm" />}
                <Text style={styles.cardTitle} numberOfLines={3}>{item.title}</Text>
                <Text style={styles.cardDate}>{formatDate(item.created)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.cardBg,
  },
  coverImage: {
    width: '100%',
    height: 160,
  },
  cardBody: {
    padding: theme.spacing.md,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 21,
  },
  cardDate: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
});
