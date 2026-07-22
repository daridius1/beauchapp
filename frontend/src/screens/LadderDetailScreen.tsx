import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, DeviceEventEmitter } from 'react-native';
import { theme } from '../theme/theme';
import { ladderService } from '../services/ladderService';
import { Ladder, LadderRank, LadderMatch } from '../types/ladder';
import { withMinimumDelay } from '../utils/refresh';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import Toast from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

type LadderDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LadderDetail'>;
type LadderDetailScreenRouteProp = RouteProp<RootStackParamList, 'LadderDetail'>;

interface Props {
  navigation: LadderDetailScreenNavigationProp;
  route: LadderDetailScreenRouteProp;
}

export const LadderDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { slug } = route.params;
  const { user } = useAuth();

  const [ladder, setLadder] = useState<Ladder | null>(null);
  const [leaderboard, setLeaderboard] = useState<LadderRank[]>([]);
  const [matches, setMatches] = useState<LadderMatch[]>([]);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'matches'>('leaderboard');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchLadderData = async (hideLoading = false) => {
    if (!hideLoading) setLoading(true);
    try {
      await withMinimumDelay(async () => {
        const ladderData = await ladderService.getLadderBySlug(slug);
        setLadder(ladderData);

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
    }, [slug, !!ladder])
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
  }, [slug]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLadderData(true);
  };

  const handleRespondMatch = async (matchId: string, decision: 'accepted' | 'rejected') => {
    setActionLoadingId(matchId);
    try {
      await ladderService.respondToMatchConfirmation(matchId, decision);
      Toast.show({
        type: 'success',
        text1: decision === 'accepted' ? 'Resultado Confirmado' : 'Partido Disputado',
        text2: decision === 'accepted' ? 'Tu confirmación ha sido registrada.' : 'El partido ha pasado a estado disputado.',
      });
      fetchLadderData(true);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'No se pudo procesar tu respuesta.',
      });
    } finally {
      setActionLoadingId(null);
    }
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
        <View style={styles.headerRow}>
          <Text style={styles.ladderTitle}>{ladder.name}</Text>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>{ladder.allowed_modes?.join(' / ')}</Text>
          </View>
        </View>

        {!!ladder.description && (
          <Text style={styles.ladderDescription}>{ladder.description}</Text>
        )}

        <TouchableOpacity
          style={styles.arbitrateButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('LadderMatchArbitrator', { slug: ladder.slug })}
        >
          <Feather name="play-circle" color={theme.colors.text} size={15} style={{ marginRight: 6 }} />
          <Text style={styles.arbitrateButtonText}>Arbitrar Partido en Vivo</Text>
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
              <Text style={styles.emptyText}>Aún no hay posiciones registradas.</Text>
            </View>
          ) : (
            leaderboard.map((rank, index) => {
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
                  onPress={() => userObj && navigation.navigate('UserProfile', { userId: userObj.id })}
                >
                  <Text style={[styles.rankPosNumber, position <= 3 && styles.rankPosTop]}>
                    {position}º
                  </Text>

                  <Avatar user={avatarUser} size={34} />

                  <View style={styles.rankInfo}>
                    <Text style={styles.rankUserName} numberOfLines={1}>
                      {userObj?.name || 'Alumno FCFM'}
                    </Text>
                    <Text style={styles.rankUserMeta}>
                      {rank.wins}V - {rank.losses}D ({rank.matches_played} PJ)
                    </Text>
                  </View>

                  <Text style={styles.ratingScore}>{Math.round(rank.ordinal_rating)} ELO</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {/* TAB 2: HISTORIAL DE PARTIDOS */}
      {activeTab === 'matches' && (
        <View style={styles.sectionContainer}>
          {matches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay partidos registrados recientemente.</Text>
            </View>
          ) : (
            matches.map((m) => {
              const isPending = m.status === 'pending_confirmation';
              const isDisputed = m.status === 'disputed';
              const isConfirmed = m.status === 'confirmed';

              const currentUserId = user?.id;
              const requiresUserAction =
                isPending &&
                currentUserId &&
                (m.team_red.includes(currentUserId) || m.team_blue.includes(currentUserId)) &&
                m.confirmations?.[currentUserId] === undefined;

              const redName = m.expand?.team_red?.[0]?.name || 'Lado Rojo';
              const blueName = m.expand?.team_blue?.[0]?.name || 'Lado Azul';

              return (
                <TouchableOpacity
                  key={m.id}
                  style={styles.matchCard}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('LadderMatchDetail', { matchId: m.id })}
                >
                  <View style={styles.matchCardTop}>
                    <Text style={styles.matchDateText}>
                      {new Date(m.created).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                    </Text>
                    <View style={[styles.statusBadge, isConfirmed && styles.statusConfirmed, isPending && styles.statusPending]}>
                      <Text style={styles.statusBadgeText}>
                        {isConfirmed ? 'CONFIRMADO' : isDisputed ? 'DISPUTADO' : 'PENDIENTE'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.matchCardMain}>
                    <Text style={styles.teamRedName} numberOfLines={1}>{redName}</Text>
                    <Text style={styles.matchScoreText}>
                      <Text style={{ color: '#ff4444' }}>{m.score_red}</Text> - <Text style={{ color: '#38bdf8' }}>{m.score_blue}</Text>
                    </Text>
                    <Text style={styles.teamBlueNameRight} numberOfLines={1}>{blueName}</Text>
                  </View>

                  {requiresUserAction && (
                    <View style={styles.confirmPromptRow}>
                      <Text style={styles.confirmPromptText}>Tu confirmación está pendiente</Text>
                      {actionLoadingId === m.id ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <View style={styles.promptBtns}>
                          <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRespondMatch(m.id, 'accepted')}>
                            <Text style={styles.btnText}>Aceptar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRespondMatch(m.id, 'rejected')}>
                            <Text style={styles.btnText}>Objetar</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
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
    marginBottom: theme.spacing.sm,
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
    alignSelf: 'flex-start',
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
    gap: 6,
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
    backgroundColor: theme.colors.cardBg,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  },
  matchCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchDateText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusConfirmed: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  statusPending: {
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textMuted,
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
  matchScoreText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    paddingHorizontal: 12,
  },
  confirmPromptRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmPromptText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  promptBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  acceptBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
