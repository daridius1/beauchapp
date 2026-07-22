import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, DeviceEventEmitter, Platform } from 'react-native';
import { theme } from '../theme/theme';
import { ladderService } from '../services/ladderService';
import { Ladder, LadderRank, LadderMatch } from '../types/ladder';
import { withMinimumDelay } from '../utils/refresh';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getSportGroup, CategoryOption } from '../config/ladderGroups';
import { CategoryCarousel } from '../components/CategoryCarousel';

type LadderDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LadderDetail'>;
type LadderDetailScreenRouteProp = RouteProp<RootStackParamList, 'LadderDetail'>;

interface Props {
  navigation: LadderDetailScreenNavigationProp;
  route: LadderDetailScreenRouteProp;
}

export const LadderDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { slug } = route.params;
  const { user } = useAuth();

  const sportGroupInfo = getSportGroup(slug);
  const [activeCategory, setActiveCategory] = useState<CategoryOption>(sportGroupInfo.activeCategory);

  const [ladder, setLadder] = useState<Ladder | null>(null);
  const [leaderboard, setLeaderboard] = useState<LadderRank[]>([]);
  const [matches, setMatches] = useState<LadderMatch[]>([]);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'matches'>('leaderboard');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const info = getSportGroup(slug);
    setActiveCategory(info.activeCategory);
  }, [slug]);

  const fetchLadderData = async (hideLoading = false, targetSlug?: string) => {
    if (!hideLoading) setLoading(true);
    const slugToFetch = targetSlug || activeCategory.slug;

    try {
      await withMinimumDelay(async () => {
        const ladderData = await ladderService.getLadderBySlug(slugToFetch);
        setLadder(ladderData);
        
        // El título del Header siempre muestra el nombre limpio del deporte
        navigation.setParams({ name: sportGroupInfo.group.groupName });

        const [ranksData, matchesData] = await Promise.all([
          ladderService.getLadderLeaderboard(ladderData.id),
          ladderService.getLadderMatches(ladderData.id),
        ]);

        setLeaderboard(ranksData);
        setMatches(matchesData);
      }, 400);
    } catch (err) {
      console.error('Error loading ladder details:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLadderData(!!ladder);
    }, [activeCategory.slug, !!ladder])
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
  }, [slug, activeCategory.slug]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLadderData(true);
  };

  const handleCategorySelect = (cat: CategoryOption) => {
    setActiveCategory(cat);
    fetchLadderData(false, cat.slug);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!ladder) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No se encontró el ladder especificado.</Text>
      </View>
    );
  }

  // Filtrar solo las partidas confirmadas para el historial
  const confirmedMatches = matches.filter((m) => m.status === 'confirmed');

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
      {/* Header Banner Minimalista */}
      <View style={styles.headerBox}>
        {/* Carrusel Centrado de Categorías (1v1 / 2v2) */}
        <CategoryCarousel
          categories={sportGroupInfo.group.categories}
          activeCategoryId={activeCategory.id}
          onSelectCategory={handleCategorySelect}
        />

        <TouchableOpacity
          style={styles.arbitrateButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('LadderMatchArbitrator', { slug: activeCategory.slug, name: sportGroupInfo.group.groupName })}
        >
          <Feather name="play-circle" color={theme.colors.text} size={15} style={{ marginRight: 6 }} />
          <Text style={styles.arbitrateButtonText}>Arbitrar</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs Planos */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'leaderboard' && styles.tabButtonActive]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>Tabla de Posiciones</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'matches' && styles.tabButtonActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>Historial de Partidos</Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: TABLA DE POSICIONES */}
      {activeTab === 'leaderboard' && (
        <View style={styles.sectionContainer}>
          {leaderboard.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aún no hay posiciones registradas en {activeCategory.label}.</Text>
            </View>
          ) : (
            <>
              {/* Header de la Tabla */}
              <View style={styles.tableHeaderRow}>
                <Text style={styles.thPos}>POS</Text>
                <Text style={styles.thName}>NOMBRE</Text>
                <Text style={styles.thScore}>ELO</Text>
              </View>

              {leaderboard.map((rank, index) => {
                const userObj = rank.expand?.user;
                const position = index + 1;
                const avatarUser = userObj
                  ? { id: userObj.id, collectionId: '_pb_users_auth_', avatar: userObj.avatar, name: userObj.name, username: userObj.username }
                  : { id: 'default', collectionId: '_pb_users_auth_', name: 'Alumno' };

                return (
                  <TouchableOpacity
                    key={rank.id}
                    style={styles.rankRow}
                    activeOpacity={0.7}
                    onPress={() => userObj && navigation.navigate('LadderPlayerProfile', { userId: userObj.id, slug: activeCategory.slug, name: sportGroupInfo.group.groupName })}
                  >
                    <Text style={[styles.rankPosNumber, position <= 3 && styles.rankPosTop]}>
                      {position}
                    </Text>

                    <Avatar user={avatarUser} size={34} />

                    <View style={styles.rankInfo}>
                      <Text style={styles.rankUserName} numberOfLines={1}>
                        {userObj?.name || 'Alumno FCFM'}
                      </Text>
                    </View>

                    <Text style={styles.ratingScore}>{Math.round(rank.ordinal_rating)}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </View>
      )}

      {/* TAB 2: HISTORIAL DE PARTIDOS (Solo partidos confirmados) */}
      {activeTab === 'matches' && (
        <View style={styles.sectionContainer}>
          {confirmedMatches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aún no hay partidos confirmados en {activeCategory.label}.</Text>
            </View>
          ) : (
            confirmedMatches.map((m) => {
              const redName = m.expand?.team_red?.[0]?.name || 'Lado Rojo';
              const blueName = m.expand?.team_blue?.[0]?.name || 'Lado Azul';
              const formattedDate = new Date(m.created).toLocaleDateString('es-CL', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });

              const isRedWinner = m.score_red > m.score_blue;
              const isBlueWinner = m.score_blue > m.score_red;

              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.matchCard,
                    isRedWinner && styles.matchCardRedWon,
                    isBlueWinner && styles.matchCardBlueWon,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('LadderMatchDetail', { matchId: m.id, slug: activeCategory.slug, name: sportGroupInfo.group.groupName })}
                >
                  <View style={styles.matchCardMain}>
                    <Text style={styles.teamRedName} numberOfLines={1}>{redName}</Text>
                    
                    {/* Marcador con Guión Estrictamente Centrado */}
                    <View style={styles.scoreContainerFixed}>
                      <Text style={styles.scoreNumRed}>{m.score_red}</Text>
                      <Text style={styles.scoreDash}>-</Text>
                      <Text style={styles.scoreNumBlue}>{m.score_blue}</Text>
                    </View>

                    <Text style={styles.teamBlueNameRight} numberOfLines={1}>{blueName}</Text>
                  </View>

                  {/* Fecha abajo al centro */}
                  <View style={styles.matchDateFooter}>
                    <Text style={styles.matchDateText}>{formattedDate}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  ladderTitle: {
    fontSize: 20,
    fontWeight: '800',
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
  ladderDescription: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
    marginBottom: theme.spacing.xs,
  },
  arbitrateButton: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'center',
    marginTop: 4,
  },
  arbitrateButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  tabButton: {
    paddingVertical: 10,
    marginRight: theme.spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  sectionContainer: {
    gap: 0,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 2,
  },
  thPos: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted,
    width: 28,
  },
  thName: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted,
    marginLeft: 44,
  },
  thScore: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textAlign: 'right',
  },
  emptyContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  rankRow: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rankPosNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textMuted,
    width: 28,
  },
  rankPosTop: {
    color: theme.colors.primary,
  },
  rankInfo: {
    flex: 1,
    marginLeft: 10,
  },
  rankUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  rankUserMeta: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  ratingScore: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  matchCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 6,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  matchCardRedWon: Platform.OS === 'web' ? ({
    backgroundImage: 'linear-gradient(to top, rgba(255, 68, 68, 0.22) 0%, rgba(255, 68, 68, 0.04) 60%, transparent 100%)',
    borderBottomWidth: 3,
    borderBottomColor: '#ff4444',
    borderTopWidth: 3,
    borderTopColor: theme.colors.border,
  } as any) : {
    borderBottomWidth: 3,
    borderBottomColor: '#ff4444',
    borderTopWidth: 3,
    borderTopColor: theme.colors.border,
  },
  matchCardBlueWon: Platform.OS === 'web' ? ({
    backgroundImage: 'linear-gradient(to top, rgba(56, 189, 248, 0.22) 0%, rgba(56, 189, 248, 0.04) 60%, transparent 100%)',
    borderBottomWidth: 3,
    borderBottomColor: '#38bdf8',
    borderTopWidth: 3,
    borderTopColor: theme.colors.border,
  } as any) : {
    borderBottomWidth: 3,
    borderBottomColor: '#38bdf8',
    borderTopWidth: 3,
    borderTopColor: theme.colors.border,
  },
  matchDateFooter: {
    alignItems: 'center',
    marginTop: 6,
  },
  matchDateText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  matchCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamRedName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#ff4444',
  },
  teamBlueNameRight: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#38bdf8',
    textAlign: 'right',
  },
  scoreContainerFixed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scoreNumRed: {
    minWidth: 20,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '800',
    color: '#ff4444',
  },
  scoreDash: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textMuted,
    marginHorizontal: 4,
    textAlign: 'center',
  },
  scoreNumBlue: {
    minWidth: 20,
    textAlign: 'left',
    fontSize: 15,
    fontWeight: '800',
    color: '#38bdf8',
  },
});
