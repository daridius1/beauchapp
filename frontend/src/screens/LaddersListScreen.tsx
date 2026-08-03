import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, DeviceEventEmitter } from 'react-native';
import { theme } from '../theme/theme';
import { ladderService } from '../services/ladderService';
import { Ladder } from '../types/ladder';
import { withMinimumDelay } from '../utils/refresh';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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

          let iconName = 'trophy-outline';
          if (group.groupSlug.includes('ajedrez')) iconName = 'chess-pawn';
          else if (group.groupSlug.includes('ping-pong') || group.groupSlug.includes('tenis-de-mesa')) iconName = 'table-tennis';
          else if (group.groupSlug.includes('taca-taca')) iconName = 'soccer-field';

          return (
            <TouchableOpacity
              key={group.groupSlug}
              style={styles.ladderRowCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('LadderDetail', { slug: defaultSlug, name: group.groupName })}
            >
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name={iconName as any} size={24} color={theme.colors.primary} />
              </View>

              <View style={styles.rowMain}>
                <Text style={styles.ladderName}>{group.groupName}</Text>
                <Text style={styles.categoriesText}>{categoriesLabel}</Text>
              </View>

              <Feather name="chevron-right" color={theme.colors.textMuted} size={22} />
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
  listContainer: {
    gap: 12,
  },
  ladderRowCard: {
    backgroundColor: theme.colors.cardBg,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowMain: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  ladderName: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  categoriesText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
});
