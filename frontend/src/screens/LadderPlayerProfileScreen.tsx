import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, DeviceEventEmitter, Platform } from 'react-native';
import { theme } from '../theme/theme';
import { ladderService } from '../services/ladderService';
import { Ladder, LadderRank, LadderMatch } from '../types/ladder';
import { withMinimumDelay } from '../utils/refresh';
import { Avatar } from '../components/Avatar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { getSportGroup } from '../config/ladderGroups';

type LadderPlayerProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LadderPlayerProfile'>;
type LadderPlayerProfileRouteProp = RouteProp<RootStackParamList, 'LadderPlayerProfile'>;

interface Props {
  navigation: LadderPlayerProfileNavigationProp;
  route: LadderPlayerProfileRouteProp;
}

export const LadderPlayerProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const { userId, slug } = route.params;
  const sportGroupInfo = getSportGroup(slug);

  const [playerUser, setPlayerUser] = useState<any | null>(null);
  const [ladder, setLadder] = useState<Ladder | null>(null);
  const [leaderboard, setLeaderboard] = useState<LadderRank[]>([]);
  const [playerMatches, setPlayerMatches] = useState<LadderMatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchData = async (hideLoading = false) => {
    if (!hideLoading) setLoading(true);
    try {
      await withMinimumDelay(async () => {
        const [ladderData, userData] = await Promise.all([
          ladderService.getLadderBySlug(slug),
          ladderService.getUserById(userId),
        ]);
        setLadder(ladderData);
        if (ladderData?.name) {
          navigation.setParams({ name: ladderData.name });
        }
        setPlayerUser(userData);

        const [ranksData, matchesData] = await Promise.all([
          ladderService.getLadderLeaderboard(ladderData.id, sportGroupInfo.activeCategory.id),
          ladderService.getPlayerMatchesInLadder(ladderData.id, userId, sportGroupInfo.activeCategory.id),
        ]);

        setLeaderboard(ranksData);
        setPlayerMatches(matchesData);
      }, 400);
    } catch (err) {
      console.error('Error loading player ladder profile:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  const scrollViewRef = React.useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      fetchData(!!playerUser && !!ladder);
    }, [userId, slug])
  );

  useEffect(() => {
    const subScroll = DeviceEventEmitter.addListener('onScrollToTop', () => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });
    const subRefresh = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await fetchData(true);
      setLoading(false);
    });
    return () => {
      subScroll.remove();
      subRefresh.remove();
    };
  }, [userId, slug]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!playerUser || !ladder) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No se encontró la información del jugador o disciplina.</Text>
      </View>
    );
  }

  // Calcular estadísticas
  const rankIndex = leaderboard.findIndex((r) => r.user === userId);
  const rankPosition = rankIndex >= 0 ? rankIndex + 1 : undefined;
  const userRank = rankIndex >= 0 ? leaderboard[rankIndex] : null;

  const ratingElo = userRank ? Math.round(userRank.ordinal_rating) : 1200;

  const totalMatches = playerMatches.length;
  let totalWins = 0;
  let totalDraws = 0;
  let totalLosses = 0;
  let redMatches = 0;
  let redWins = 0;
  let redDraws = 0;
  let redLosses = 0;
  let blueMatches = 0;
  let blueWins = 0;
  let blueDraws = 0;
  let blueLosses = 0;

  playerMatches.forEach((m) => {
    const isRed = m.team_red.includes(userId);
    const isBlue = m.team_blue.includes(userId);

    const isDraw = m.score_red === m.score_blue;
    const redWon = m.score_red > m.score_blue;
    const blueWon = m.score_blue > m.score_red;

    if (isRed) {
      redMatches++;
      if (isDraw) {
        redDraws++;
        totalDraws++;
      } else if (redWon) {
        redWins++;
        totalWins++;
      } else {
        redLosses++;
        totalLosses++;
      }
    } else if (isBlue) {
      blueMatches++;
      if (isDraw) {
        blueDraws++;
        totalDraws++;
      } else if (blueWon) {
        blueWins++;
        totalWins++;
      } else {
        blueLosses++;
        totalLosses++;
      }
    }
  });

  const winrate = totalMatches > 0 ? Math.round(((totalWins + 0.5 * totalDraws) / totalMatches) * 100) : 0;

  // Racha actual
  let streakType: 'win' | 'loss' | 'draw' | 'none' = 'none';
  let streakCount = 0;

  for (let i = 0; i < playerMatches.length; i++) {
    const m = playerMatches[i];
    const isRed = m.team_red.includes(userId);
    const isDraw = m.score_red === m.score_blue;
    const won = isRed ? m.score_red > m.score_blue : m.score_blue > m.score_red;
    const resultType: 'win' | 'loss' | 'draw' = isDraw ? 'draw' : (won ? 'win' : 'loss');

    if (i === 0) {
      streakType = resultType;
      streakCount = 1;
    } else {
      if (resultType === streakType) {
        streakCount++;
      } else {
        break;
      }
    }
  }

  const avatarUser = {
    id: playerUser.id,
    collectionId: '_pb_users_auth_',
    avatar: playerUser.avatar,
    name: playerUser.name,
    username: playerUser.username,
  };

  return (
    <ScrollView
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
      {/* Banner Principal del Jugador (Clickable hacia perfil principal) */}
      <TouchableOpacity
        style={styles.playerHeaderBox}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('UserProfile', { userId: playerUser.id })}
      >
        <Avatar user={avatarUser} size={64} />
        <View style={styles.playerMainInfo}>
          <Text style={styles.playerName}>{playerUser.name || 'Alumno FCFM'}</Text>
          {!!playerUser.username && (
            <Text style={styles.playerUsername}>@{playerUser.username}</Text>
          )}
        </View>
        <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
      </TouchableOpacity>

      {/* Tarjetas de Resumen ELO / Puesto / Rendimiento */}
      <View style={styles.statsCardsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{ratingElo}</Text>
          <Text style={styles.statCardLabel}>ELO Puntos</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>
            {rankPosition ? `#${rankPosition}` : '-'}
          </Text>
          <Text style={styles.statCardLabel}>En la Tabla</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{winrate}%</Text>
          <Text style={styles.statCardLabel}>Rendimiento</Text>
        </View>
      </View>

      {/* Tarjeta de Desglose de Rendimiento */}
      <View style={styles.detailBox}>
        <Text style={styles.detailTitle}>Rendimiento en {ladder.name}</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Partidos Totales:</Text>
          <Text style={styles.detailValue}>
            {totalDraws > 0
              ? `${totalMatches} PJ (${totalWins}V - ${totalDraws}E - ${totalLosses}D)`
              : `${totalMatches} PJ (${totalWins}V - ${totalLosses}D)`}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Racha Actual:</Text>
          <Text style={styles.detailValue}>
            {streakType === 'win'
              ? `${streakCount} V consecutivas`
              : streakType === 'draw'
              ? `${streakCount} E consecutivos`
              : streakType === 'loss'
              ? `${streakCount} D consecutivas`
              : 'Sin partidos'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabelRed}>Lado Rojo / Blancas:</Text>
          <Text style={styles.detailValue}>
            {redDraws > 0
              ? `${redMatches} PJ (${redWins}V - ${redDraws}E - ${redLosses}D)`
              : `${redMatches} PJ (${redWins}V - ${redLosses}D)`}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabelBlue}>Lado Azul / Negras:</Text>
          <Text style={styles.detailValue}>
            {blueDraws > 0
              ? `${blueMatches} PJ (${blueWins}V - ${blueDraws}E - ${blueLosses}D)`
              : `${blueMatches} PJ (${blueWins}V - ${blueLosses}D)`}
          </Text>
        </View>
      </View>

      {/* Historial de Partidos en este Deporte */}
      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>Partidos de {playerUser.name?.split(' ')[0] || 'Jugador'} en {ladder.name}</Text>

        {playerMatches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay partidos registrados en este juego.</Text>
          </View>
        ) : (
          playerMatches.map((m) => {
            const createdDate = new Date(m.created);
            const day = String(createdDate.getDate()).padStart(2, '0');
            const month = String(createdDate.getMonth() + 1).padStart(2, '0');
            const year = String(createdDate.getFullYear()).slice(-2);
            const formattedDate = `${day}/${month}/${year}`;

            const isPending = m.status === 'pending_confirmation' || m.status === 'disputed';
            const inRed = m.team_red.includes(userId);
            const isDraw = m.score_red === m.score_blue;
            const playerWon = isDraw ? false : (inRed ? m.score_red > m.score_blue : m.score_blue > m.score_red);
            const playerLost = isDraw ? false : !playerWon;

            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.matchCard,
                  !isPending && playerWon && styles.matchCardPlayerWon,
                  !isPending && isDraw && styles.matchCardDraw,
                  !isPending && playerLost && styles.matchCardPlayerLost,
                  isPending && styles.matchCardPending,
                ]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('LadderMatchDetail', { matchId: m.id, slug: ladder.slug, name: ladder.name })}
              >
                {/* Chip Indicador de Resultado Personal */}
                <View style={styles.outcomeChipRow}>
                  {isPending ? (
                    <View style={styles.pendingChip}>
                      <Feather name="clock" size={10} color="#ffaa00" style={{ marginRight: 4 }} />
                      <Text style={styles.pendingChipText}>
                        {m.status === 'disputed' ? 'Disputado (Rechazado)' : 'Pendiente de confirmación'}
                      </Text>
                    </View>
                  ) : playerWon ? (
                    <View style={styles.winChip}>
                      <Feather name="check-circle" size={10} color="#10b981" style={{ marginRight: 4 }} />
                      <Text style={styles.winChipText}>VICTORIA</Text>
                    </View>
                  ) : isDraw ? (
                    <View style={styles.drawChip}>
                      <Feather name="minus-circle" size={10} color="#facc15" style={{ marginRight: 4 }} />
                      <Text style={styles.drawChipText}>EMPATE</Text>
                    </View>
                  ) : (
                    <View style={styles.lossChip}>
                      <Feather name="x-circle" size={10} color="#9ca3af" style={{ marginRight: 4 }} />
                      <Text style={styles.lossChipText}>DERROTA</Text>
                    </View>
                  )}
                </View>

                <View style={styles.matchCardMain}>
                  {/* Integrantes Equipo Rojo */}
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    {m.expand?.team_red && m.expand.team_red.length > 0 ? (
                      m.expand.team_red.map((p) => (
                        <Text key={p.id} style={styles.teamRedName} numberOfLines={1}>
                          {p.name}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.teamRedName} numberOfLines={1}>Lado Rojo</Text>
                    )}
                  </View>

                  {/* Marcador con Guión Estrictamente Centrado */}
                  <View style={styles.scoreContainerFixed}>
                    <Text style={styles.scoreNumRed}>{m.score_red}</Text>
                    <Text style={styles.scoreDash}>-</Text>
                    <Text style={styles.scoreNumBlue}>{m.score_blue}</Text>
                  </View>

                  {/* Integrantes Equipo Azul */}
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end' }}>
                    {m.expand?.team_blue && m.expand.team_blue.length > 0 ? (
                      m.expand.team_blue.map((p) => (
                        <Text key={p.id} style={styles.teamBlueNameRight} numberOfLines={1}>
                          {p.name}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.teamBlueNameRight} numberOfLines={1}>Lado Azul</Text>
                    )}
                  </View>
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
  emptyContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  playerHeaderBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  playerMainInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  playerUsername: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  mainProfileBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'flex-start',
  },
  mainProfileBtnText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  statsCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statCardValue: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  detailBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  detailLabelRed: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff4444',
  },
  detailLabelBlue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 8,
  },
  historySection: {
    gap: 6,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  matchCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 6,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: 8,
  },
  matchCardPlayerWon: Platform.OS === 'web' ? ({
    backgroundImage: 'linear-gradient(to right, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.02) 60%, transparent 100%)',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  } as any) : {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  matchCardDraw: Platform.OS === 'web' ? ({
    backgroundImage: 'linear-gradient(to right, rgba(250, 204, 21, 0.15) 0%, rgba(250, 204, 21, 0.02) 60%, transparent 100%)',
    borderLeftWidth: 4,
    borderLeftColor: '#facc15',
  } as any) : {
    borderLeftWidth: 4,
    borderLeftColor: '#facc15',
    backgroundColor: 'rgba(250, 204, 21, 0.04)',
  },
  matchCardPlayerLost: Platform.OS === 'web' ? ({
    backgroundImage: 'linear-gradient(to right, rgba(100, 116, 139, 0.15) 0%, rgba(100, 116, 139, 0.02) 60%, transparent 100%)',
    borderLeftWidth: 4,
    borderLeftColor: '#4b5563',
  } as any) : {
    borderLeftWidth: 4,
    borderLeftColor: '#4b5563',
    backgroundColor: 'rgba(75, 85, 99, 0.06)',
  },
  matchCardPending: {
    borderColor: '#ffaa00',
    borderWidth: 1,
    backgroundColor: 'rgba(255, 170, 0, 0.04)',
  },
  outcomeChipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  winChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  winChipText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  drawChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  drawChipText: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lossChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  lossChipText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 170, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pendingChipText: {
    color: '#ffaa00',
    fontSize: 10,
    fontWeight: '700',
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
