import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, DeviceEventEmitter } from 'react-native';
import { theme } from '../theme/theme';
import { ladderService } from '../services/ladderService';
import { Ladder } from '../types/ladder';
import { withMinimumDelay } from '../utils/refresh';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

type LaddersListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LaddersList'>;

interface Props {
  navigation: LaddersListScreenNavigationProp;
}

export const LaddersListScreen: React.FC<Props> = ({ navigation }) => {
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchLadders = async (hideLoading = false) => {
    if (!hideLoading) setLoading(true);
    try {
      await withMinimumDelay(async () => {
        const data = await ladderService.getLadders();
        setLadders(data);
      }, 400);
    } catch (err) {
      console.error('Error fetching ladders:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLadders(ladders.length > 0);
    }, [ladders.length])
  );

  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    const subScroll = DeviceEventEmitter.addListener('onScrollToTop', () => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });
    const subRefresh = DeviceEventEmitter.addListener('onGlobalRefresh', () => {
      handleRefresh();
    });
    return () => {
      subScroll.remove();
      subRefresh.remove();
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLadders(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <View style={styles.headerBox}>
        <Text style={styles.title}>Rankings FCFM</Text>
        <Text style={styles.subtitle}>
          Competencias deportivas de Beauchef. Selecciona una disciplina para ver posiciones y arbitrar.
        </Text>
      </View>

      {ladders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay ladders activos en este momento.</Text>
        </View>
      ) : (
        ladders.map((ladder) => (
          <TouchableOpacity
            key={ladder.id}
            style={styles.ladderCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('LadderDetail', { slug: ladder.slug })}
          >
            <View style={styles.cardMain}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.ladderName}>{ladder.name}</Text>
                <View style={styles.modeBadge}>
                  <Text style={styles.modeBadgeText}>
                    {ladder.allowed_modes?.join(' / ') || '1v1'}
                  </Text>
                </View>
              </View>

              {!!ladder.description && (
                <Text style={styles.description} numberOfLines={2}>
                  {ladder.description}
                </Text>
              )}
            </View>

            <Feather name="chevron-right" color={theme.colors.textMuted} size={18} />
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBox: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  ladderCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMain: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  ladderName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  modeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  description: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
});
