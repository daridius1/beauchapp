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
import { LADDER_GROUPS } from '../config/ladderGroups';

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

  const displayedGroups = LADDER_GROUPS;

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
      <View style={styles.listContainer}>
        {displayedGroups.map((group) => {
          const categoriesLabel = group.categories.map((c) => c.label).join(' / ');
          const defaultSlug = group.categories[0].slug;

          return (
            <TouchableOpacity
              key={group.groupSlug}
              style={styles.ladderRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('LadderDetail', { slug: defaultSlug, name: group.groupName })}
            >
              <View style={styles.rowHeaderRow}>
                <Text style={styles.ladderName}>{group.groupName}</Text>
                <View style={styles.modeBadge}>
                  <Text style={styles.modeBadgeText}>{categoriesLabel}</Text>
                </View>
              </View>

              <Feather name="chevron-right" color={theme.colors.textMuted} size={18} />
            </TouchableOpacity>
          );
        })}
      </View>
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
  listContainer: {},
  ladderRow: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowMain: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  rowHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
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
