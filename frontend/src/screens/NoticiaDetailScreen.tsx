import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../theme/theme';
import { RootStackParamList } from '../types/navigation';
import { NewsArticle } from '../types/news';
import { newsService } from '../services/newsService';
import { getFileUrl } from '../services/pocketbase';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { OrgChip } from '../components/OrgChip';

type Props = NativeStackScreenProps<RootStackParamList, 'NoticiaDetail'>;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const NoticiaDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { newsId } = route.params;
  const [news, setNews] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      setLoading(true);
      newsService
        .getNews(newsId)
        .then((item) => { if (isMounted) setNews(item); })
        .catch((err) => console.error('Error cargando noticia:', err))
        .finally(() => { if (isMounted) setLoading(false); });
      return () => { isMounted = false; };
    }, [newsId])
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!news) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>Noticia no encontrada</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!!news.coverImage && (
        <Image source={{ uri: getFileUrl(news, news.coverImage) }} style={styles.coverImage} resizeMode="cover" />
      )}
      <Text style={styles.title}>{news.title}</Text>
      <View style={styles.metaRow}>
        {news.expand?.author && <OrgChip organization={news.expand.author as any} size="sm" />}
        <Text style={styles.date}>{formatDate(news.created)}</Text>
      </View>

      <MarkdownRenderer content={news.body} height={400} />

      {!!news.relatedMatch && (
        <TouchableOpacity
          style={styles.matchBtn}
          onPress={() => navigation.push('LeagueMatchDetail', { matchId: news.relatedMatch! })}
        >
          <Text style={styles.matchBtnText}>Ver partido</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  coverImage: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 28,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: theme.spacing.md,
  },
  date: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  matchBtn: {
    marginTop: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  matchBtnText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
