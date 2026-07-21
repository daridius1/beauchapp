import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
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

  useEffect(() => {
    fetchLadderData();
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
    <View style={styles.container}>
      <ScrollView
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
        {/* Banner Superior */}
        <View style={styles.bannerBox}>
          <View style={styles.bannerTop}>
            <Text style={styles.ladderTitle}>{ladder.name}</Text>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{ladder.allowed_modes?.join(' / ')}</Text>
            </View>
          </View>
          {!!ladder.description && (
            <Text style={styles.ladderDescription}>{ladder.description}</Text>
          )}

          {/* Botón Destacado: Arbitrar Partido */}
          <TouchableOpacity
            style={styles.arbitrateButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('LadderMatchArbitrator', { slug: ladder.slug })}
          >
            <Feather name="play" color="#000000" size={18} style={{ marginRight: 8 }} />
            <Text style={styles.arbitrateButtonText}>Arbitrar Partido en Vivo</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'leaderboard' && styles.tabButtonActive]}
            onPress={() => setActiveTab('leaderboard')}
          >
            <Feather name="award" color={activeTab === 'leaderboard' ? '#ffffff' : '#888888'} size={16} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>Tabla de Posiciones</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'matches' && styles.tabButtonActive]}
            onPress={() => setActiveTab('matches')}
          >
            <Feather name="calendar" color={activeTab === 'matches' ? '#ffffff' : '#888888'} size={16} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>Historial de Partidos</Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <View style={styles.sectionContainer}>
            {leaderboard.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Aún no hay posiciones en este ranking. ¡Sé el primero en jugar!</Text>
              </View>
            ) : (
              leaderboard.map((rank, index) => {
                const userObj = rank.expand?.user;
                const isTop1 = index === 0;
                const isTop2 = index === 1;
                const isTop3 = index === 2;

                let medal = `${index + 1}º`;
                if (isTop1) medal = '🥇 1º';
                else if (isTop2) medal = '🥈 2º';
                else if (isTop3) medal = '🥉 3º';

                const avatarUser = userObj
                  ? { id: userObj.id, collectionId: '_pb_users_auth_', avatar: userObj.avatar, name: userObj.name, username: userObj.username }
                  : { id: 'default', collectionId: '_pb_users_auth_', name: 'Alumno' };

                return (
                  <TouchableOpacity
                    key={rank.id}
                    style={[styles.rankCard, isTop1 && styles.rankCardTop1]}
                    activeOpacity={0.7}
                    onPress={() => userObj && navigation.navigate('UserProfile', { userId: userObj.id })}
                  >
                    <View style={styles.rankPositionBox}>
                      <Text style={[styles.rankPositionText, isTop1 && styles.rankPositionTextTop1]}>
                        {medal}
                      </Text>
                    </View>

                    <View style={styles.rankAvatarBox}>
                      <Avatar user={avatarUser} size={42} />
                    </View>

                    <View style={styles.rankInfo}>
                      <Text style={styles.rankUserName} numberOfLines={1}>
                        {userObj?.name || 'Alumno FCFM'}
                      </Text>
                      <Text style={styles.rankUserMeta}>
                        {rank.wins}V - {rank.losses}D ({rank.matches_played} PJ)
                      </Text>
                    </View>

                    <View style={styles.ratingBox}>
                      <Text style={styles.ratingScore}>{Math.round(rank.ordinal_rating)}</Text>
                      <Text style={styles.ratingLabel}>ELO</Text>
                    </View>
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

                return (
                  <View key={m.id} style={styles.matchCard}>
                    {/* Header del Partido */}
                    <View style={styles.matchCardHeader}>
                      <Text style={styles.matchModeText}>Partida {m.mode}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          isConfirmed && styles.statusBadgeConfirmed,
                          isDisputed && styles.statusBadgeDisputed,
                          isPending && styles.statusBadgePending,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {isConfirmed ? 'Confirmado' : isDisputed ? 'Disputado' : 'Pendiente'}
                        </Text>
                      </View>
                    </View>

                    {/* Marcador Rojo vs Azul */}
                    <View style={styles.scoreRow}>
                      <View style={styles.teamColumnRed}>
                        <Text style={styles.teamLabelRed}>EQUIPO ROJO</Text>
                        {m.expand?.team_red?.map((p) => (
                          <Text key={p.id} style={styles.playerText} numberOfLines={1}>
                            {p.name}
                          </Text>
                        )) || <Text style={styles.playerText}>Jugadores</Text>}
                      </View>

                      <View style={styles.scoreBox}>
                        <Text style={styles.scoreTextRed}>{m.score_red}</Text>
                        <Text style={styles.scoreDivider}>-</Text>
                        <Text style={styles.scoreTextBlue}>{m.score_blue}</Text>
                      </View>

                      <View style={styles.teamColumnBlue}>
                        <Text style={styles.teamLabelBlue}>EQUIPO AZUL</Text>
                        {m.expand?.team_blue?.map((p) => (
                          <Text key={p.id} style={styles.playerText} numberOfLines={1}>
                            {p.name}
                          </Text>
                        )) || <Text style={styles.playerText}>Jugadores</Text>}
                      </View>
                    </View>

                    {/* Footer de Árbitro */}
                    <View style={styles.matchFooter}>
                      <Text style={styles.arbiterText}>
                        Arbitrado por: @{m.expand?.arbiter?.username || m.expand?.arbiter?.name || 'Árbitro'}
                      </Text>
                    </View>

                    {/* Botones de Acción si el jugador debe confirmar */}
                    {requiresUserAction && (
                      <View style={styles.confirmActionBox}>
                        <Text style={styles.confirmPromptText}>¿Participaste en esta partida?</Text>
                        {actionLoadingId === m.id ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : (
                          <View style={styles.confirmButtonsRow}>
                            <TouchableOpacity
                              style={styles.acceptButton}
                              onPress={() => handleRespondMatch(m.id, 'accepted')}
                            >
                              <Feather name="check" color="#000000" size={16} style={{ marginRight: 4 }} />
                              <Text style={styles.acceptButtonText}>Confirmar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.rejectButton}
                              onPress={() => handleRespondMatch(m.id, 'rejected')}
                            >
                              <Feather name="x" color="#ffffff" size={16} style={{ marginRight: 4 }} />
                              <Text style={styles.rejectButtonText}>Rechazar</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
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
  bannerBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  ladderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
  },
  modeBadge: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#aaaaaa',
  },
  ladderDescription: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  arbitrateButton: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arbitrateButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: 4,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    flex: 1,
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  rankCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankCardTop1: {
    borderColor: '#ffffff',
    backgroundColor: '#121212',
  },
  rankPositionBox: {
    width: 44,
    alignItems: 'center',
    marginRight: theme.spacing.xs,
  },
  rankPositionText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  rankPositionTextTop1: {
    color: '#ffffff',
    fontWeight: '800',
  },
  rankAvatarBox: {
    marginRight: theme.spacing.sm,
  },
  rankInfo: {
    flex: 1,
  },
  rankUserName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  rankUserMeta: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  ratingBox: {
    alignItems: 'flex-end',
    paddingLeft: theme.spacing.sm,
  },
  ratingScore: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  ratingLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  matchCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  matchModeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333333',
  },
  statusBadgeConfirmed: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: '#22c55e',
  },
  statusBadgeDisputed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  statusBadgePending: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: '#eab308',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: theme.spacing.sm,
  },
  teamColumnRed: {
    flex: 1,
    alignItems: 'flex-start',
  },
  teamColumnBlue: {
    flex: 1,
    alignItems: 'flex-end',
  },
  teamLabelRed: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ff4444',
    marginBottom: 4,
  },
  teamLabelBlue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
    marginBottom: 4,
  },
  playerText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  scoreTextRed: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ff4444',
  },
  scoreDivider: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginHorizontal: 6,
  },
  scoreTextBlue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#38bdf8',
  },
  matchFooter: {
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  arbiterText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  confirmActionBox: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: '#121212',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
  },
  confirmPromptText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  acceptButton: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  rejectButton: {
    backgroundColor: '#ff4444',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
