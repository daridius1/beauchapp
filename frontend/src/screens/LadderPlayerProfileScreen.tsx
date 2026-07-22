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

type LadderPlayerProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LadderPlayerProfile'>;
type LadderPlayerProfileRouteProp = RouteProp<RootStackParamList, 'LadderPlayerProfile'>;

interface Props {
  navigation: LadderPlayerProfileNavigationProp;
  route: LadderPlayerProfileRouteProp;
}

export const LadderPlayerProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const { userId, slug } = route.params;

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
        const ladderData = await ladderService.getLadderBySlug(slug);
        setLadder(ladderData);
        if (ladderData?.name) {
          navigation.setParams({ name: ladderData.name });
        }

        const [userData, ranksData, matchesData] = await Promise.all([
          ladderService.getUserById(userId),
          ladderService.getLadderLeaderboard(ladderData.id),
          ladderService.getPlayerMatchesInLadder(ladderData.id, userId),
        ]);

        setPlayerUser(userData);
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

  useFocusEffect(
    useCallback(() => {
      fetchData(!!ladder);
    }, [userId, slug, !!ladder])
  );

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
  let redMatches = 0;
  let redWins = 0;
  let blueMatches = 0;
  let blueWins = 0;

  playerMatches.forEach((m) => {
    const isRed = m.team_red.includes(userId);
    const isBlue = m.team_blue.includes(userId);

    const redWon = m.score_red > m.score_blue;
    const blueWon = m.score_blue > m.score_red;

    if (isRed) {
      redMatches++;
      if (redWon) {
        redWins++;
        totalWins++;
      }
    } else if (isBlue) {
      blueMatches++;
      if (blueWon) {
        blueWins++;
        totalWins++;
      }
    }
  });

  const totalLosses = totalMatches - totalWins;
  const winrate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  // Racha actual
  let streakType: 'win' | 'loss' | 'none' = 'none';
  let streakCount = 0;

  for (let i = 0; i < playerMatches.length; i++) {
    const m = playerMatches[i];
    const isRed = m.team_red.includes(userId);
    const won = isRed ? m.score_red > m.score_blue : m.score_blue > m.score_red;

    if (i === 0) {
      streakType = won ? 'win' : 'loss';
      streakCount = 1;
    } else {
      const currentWon = won;
      const lastType = streakType === 'win';
      if (currentWon === lastType) {
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
      {/* Banner Principal del Jugador */}
      <View style={styles.playerHeaderBox}>
        <Avatar user={avatarUser} size={64} />
        <View style={styles.playerMainInfo}>
          <Text style={styles.playerName}>{playerUser.name || 'Alumno FCFM'}</Text>
          {!!playerUser.username && (
            <Text style={styles.playerUsername}>@{playerUser.username}</Text>
          )}
          
          <TouchableOpacity
            style={styles.mainProfileBtn}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('UserProfile', { userId: playerUser.id })}
          >
            <Feather name="user" color={theme.colors.text} size={13} style={{ marginRight: 5 }} />
            <Text style={styles.mainProfileBtnText}>Ver Perfil Principal</Text>
          </TouchableOpacity>
        </View>
      </View>

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
            {totalMatches} PJ ({totalWins}V - {totalLosses}D)
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Racha Actual:</Text>
          <Text style={styles.detailValue}>
            {streakType === 'win'
              ? `${streakCount} V consecutivas`
              : streakType === 'loss'
              ? `${streakCount} D consecutivas`
              : 'Sin partidos'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabelRed}>Lado Rojo:</Text>
          <Text style={styles.detailValue}>
            {redMatches} PJ ({redWins}V - {redMatches - redWins}D)
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabelBlue}>Lado Azul:</Text>
          <Text style={styles.detailValue}>
            {blueMatches} PJ ({blueWins}V - {blueMatches - blueWins}D)
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
                onPress={() => navigation.navigate('LadderMatchDetail', { matchId: m.id, slug: ladder.slug, name: ladder.name })}
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
