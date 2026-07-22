import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { theme } from '../theme/theme';
import { ladderService } from '../services/ladderService';
import { LadderMatch } from '../types/ladder';
import { withMinimumDelay } from '../utils/refresh';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import Toast from 'react-native-toast-message';

type MatchDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LadderMatchDetail'>;
type MatchDetailScreenRouteProp = RouteProp<RootStackParamList, 'LadderMatchDetail'>;

interface Props {
  navigation: MatchDetailScreenNavigationProp;
  route: MatchDetailScreenRouteProp;
}

export const LadderMatchDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { matchId } = route.params;
  const { user: currentUser } = useAuth();

  const [match, setMatch] = useState<LadderMatch | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchMatch = async (hideLoading = false) => {
    if (!hideLoading) setLoading(true);
    try {
      await withMinimumDelay(async () => {
        const data = await ladderService.getMatchById(matchId);
        setMatch(data);
        if (data?.expand?.ladder) {
          navigation.setParams({
            slug: data.expand.ladder.slug,
            name: data.expand.ladder.name,
          });
        }
      }, 400);
    } catch (err) {
      console.error('Error fetching match details:', err);
    } finally {
      if (!hideLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatch();
  }, [matchId]);

  const handleRespondMatch = async (decision: 'accepted' | 'rejected') => {
    if (!match) return;
    setActionLoading(true);
    try {
      await ladderService.respondToMatchConfirmation(match.id, decision);
      Toast.show({
        type: 'success',
        text1: decision === 'accepted' ? 'Resultado Confirmado' : 'Partido Disputado',
        text2: decision === 'accepted' ? 'Tu confirmación ha sido registrada.' : 'El partido ha pasado a estado disputado.',
      });
      fetchMatch(true);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'No se pudo procesar tu respuesta.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No se encontró la información del partido.</Text>
      </View>
    );
  }

  const createdDate = new Date(match.created);
  const formattedDate = createdDate.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let runningRed = 0;
  let runningBlue = 0;

  const timelineEvents = (match.goal_history || []).map((step: any, index: number) => {
    let team: 'red' | 'blue' = 'red';
    let points = 1;

    if (typeof step === 'object' && step !== null) {
      team = step.team === 'blue' ? 'blue' : 'red';
      points = typeof step.points === 'number' ? step.points : 1;
    } else if (typeof step === 'string') {
      const scoreMatch = step.match(/\((\d+)\s*-\s*(\d+)\)/);
      const pozoMatch = step.match(/\+(\d+)\s*pts?/i);

      if (scoreMatch) {
        const scoreRedAfter = parseInt(scoreMatch[1], 10);
        const scoreBlueAfter = parseInt(scoreMatch[2], 10);
        const deltaRed = scoreRedAfter - runningRed;
        const deltaBlue = scoreBlueAfter - runningBlue;
        team = deltaRed > 0 ? 'red' : 'blue';
        points = parseInt(pozoMatch?.[1] || `${Math.max(deltaRed, deltaBlue)}`, 10);
      } else {
        team = step === 'red' || step.toLowerCase().includes('rojo') ? 'red' : 'blue';
        points = 1;
      }
    }

    if (team === 'red') runningRed += points;
    else runningBlue += points;

    const winnerName = team === 'red'
      ? (match.expand?.team_red?.[0]?.name || 'Jugador Rojo')
      : (match.expand?.team_blue?.[0]?.name || 'Jugador Azul');

    return {
      index: index + 1,
      team,
      points,
      winnerName,
      scoreRedAfter: runningRed,
      scoreBlueAfter: runningBlue,
    };
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Marcador Plano con Nombres Coloreados */}
      <View
        style={[
          styles.scoreboardCard,
          match.score_red > match.score_blue && styles.matchCardRedWon,
          match.score_blue > match.score_red && styles.matchCardBlueWon,
        ]}
      >
        {/* Avatar de Fondo Lado Rojo (Sangrando por el borde izquierdo) */}
        {match.expand?.team_red?.[0] && (
          <View style={styles.bgAvatarLeft} pointerEvents="none">
            <Avatar
              user={{
                id: match.expand.team_red[0].id,
                collectionId: '_pb_users_auth_',
                avatar: match.expand.team_red[0].avatar,
                name: match.expand.team_red[0].name,
                username: match.expand.team_red[0].username,
              }}
              size={120}
            />
          </View>
        )}

        {/* Avatar de Fondo Lado Azul (Sangrando por el borde derecho) */}
        {match.expand?.team_blue?.[0] && (
          <View style={styles.bgAvatarRight} pointerEvents="none">
            <Avatar
              user={{
                id: match.expand.team_blue[0].id,
                collectionId: '_pb_users_auth_',
                avatar: match.expand.team_blue[0].avatar,
                name: match.expand.team_blue[0].name,
                username: match.expand.team_blue[0].username,
              }}
              size={120}
            />
          </View>
        )}

        <View style={styles.scoreboardMainRow}>
          {/* Lado Rojo */}
          <View style={styles.teamColumn}>
            {match.expand?.team_red?.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.playerColumnCentered}
                onPress={() => navigation.navigate('UserProfile', { userId: p.id })}
              >
                <Text style={styles.playerNameRedCentered} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Resultado Uniforme Centrado */}
          <View style={styles.scoreContainerFixedMain}>
            <Text style={styles.scoreNumRedMain}>{match.score_red}</Text>
            <Text style={styles.scoreDashMain}>-</Text>
            <Text style={styles.scoreNumBlueMain}>{match.score_blue}</Text>
          </View>

          {/* Lado Azul */}
          <View style={styles.teamColumnRight}>
            {match.expand?.team_blue?.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.playerColumnCentered}
                onPress={() => navigation.navigate('UserProfile', { userId: p.id })}
              >
                <Text style={styles.playerNameBlueCentered} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Fecha abajo al centro */}
        <View style={styles.dateCenteredFooter}>
          <Text style={styles.dateCenteredText}>{formattedDate}</Text>
        </View>
      </View>

      {/* Acción Pendiente */}
      {match.status === 'pending_confirmation' && currentUser && (match.team_red.includes(currentUser.id) || match.team_blue.includes(currentUser.id)) && match.confirmations?.[currentUser.id] === undefined && (
        <View style={styles.confirmBox}>
          <Text style={styles.confirmTitle}>¿Participaste en este partido?</Text>
          {actionLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRespondMatch('accepted')}>
                <Text style={styles.btnText}>Confirmar Resultado</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRespondMatch('rejected')}>
                <Text style={styles.btnText}>Objetar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Secuencia Dinámica de Puntos con Gradiente Direccional */}
      {timelineEvents.length > 0 && (
        <View style={styles.timelineSection}>

          {timelineEvents.map((ev) => {
            const isRed = ev.team === 'red';
            return (
              <View
                key={ev.index}
                style={[
                  styles.eventRowCard,
                  isRed ? styles.eventRowRed : styles.eventRowBlue,
                ]}
              >
                {/* Lado Izquierdo (Info de Lado Rojo) */}
                <View style={styles.eventSideLeft}>
                  {isRed && (
                    <View style={styles.eventMetaLeft}>
                      <Text style={styles.eventIndexRed}>#{ev.index}</Text>
                      <Text style={styles.eventPlayerRed} numberOfLines={1}>{ev.winnerName}</Text>
                      {ev.points > 1 && <Text style={styles.eventPointsBadgeRed}>+{ev.points}</Text>}
                    </View>
                  )}
                </View>

                {/* Marcador al centro siempre actualizándose */}
                <View style={styles.eventCenterScore}>
                  <Text style={styles.eventScoreNumRed}>{ev.scoreRedAfter}</Text>
                  <Text style={styles.eventScoreDash}>-</Text>
                  <Text style={styles.eventScoreNumBlue}>{ev.scoreBlueAfter}</Text>
                </View>

                {/* Lado Derecho (Info de Lado Azul) */}
                <View style={styles.eventSideRight}>
                  {!isRed && (
                    <View style={styles.eventMetaRight}>
                      {ev.points > 1 && <Text style={styles.eventPointsBadgeBlue}>+{ev.points}</Text>}
                      <Text style={styles.eventPlayerBlue} numberOfLines={1}>{ev.winnerName}</Text>
                      <Text style={styles.eventIndexBlue}>#{ev.index}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
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
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  scoreboardCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  bgAvatarLeft: {
    position: 'absolute',
    left: -25,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.18,
  },
  bgAvatarRight: {
    position: 'absolute',
    right: -25,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.18,
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
  dateCenteredFooter: {
    alignItems: 'center',
    marginTop: 8,
  },
  dateCenteredText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  scoreboardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamColumnRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerColumnCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  playerNameRedCentered: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff4444',
    textAlign: 'center',
  },
  playerNameBlueCentered: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38bdf8',
    textAlign: 'center',
  },
  scoreDisplay: {
    paddingHorizontal: 12,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  confirmBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  timelineSection: {
    gap: 6,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  eventRowCard: {
    backgroundColor: '#121212',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  eventRowRed: Platform.OS === 'web' ? ({
    backgroundImage: 'linear-gradient(to right, rgba(255, 68, 68, 0.22) 0%, rgba(255, 68, 68, 0.03) 55%, transparent 100%)',
    borderLeftWidth: 3,
    borderLeftColor: '#ff4444',
    borderRightWidth: 3,
    borderRightColor: theme.colors.border,
  } as any) : {
    borderLeftWidth: 3,
    borderLeftColor: '#ff4444',
    borderRightWidth: 3,
    borderRightColor: theme.colors.border,
    backgroundColor: 'rgba(255, 68, 68, 0.06)',
  },
  eventRowBlue: Platform.OS === 'web' ? ({
    backgroundImage: 'linear-gradient(to left, rgba(56, 189, 248, 0.22) 0%, rgba(56, 189, 248, 0.03) 55%, transparent 100%)',
    borderRightWidth: 3,
    borderRightColor: '#38bdf8',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.border,
  } as any) : {
    borderRightWidth: 3,
    borderRightColor: '#38bdf8',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.border,
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
  },
  scoreContainerFixedMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  scoreNumRedMain: {
    minWidth: 28,
    textAlign: 'right',
    fontSize: 22,
    fontWeight: '800',
    color: '#ff4444',
  },
  scoreDashMain: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textMuted,
    marginHorizontal: 5,
    textAlign: 'center',
  },
  scoreNumBlueMain: {
    minWidth: 28,
    textAlign: 'left',
    fontSize: 22,
    fontWeight: '800',
    color: '#38bdf8',
  },
  eventSideLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventSideRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  eventCenterScore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    minWidth: 64,
  },
  eventScoreNumRed: {
    minWidth: 18,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: '#ff4444',
  },
  eventScoreDash: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textMuted,
    marginHorizontal: 3,
    textAlign: 'center',
  },
  eventScoreNumBlue: {
    minWidth: 18,
    textAlign: 'left',
    fontSize: 13,
    fontWeight: '800',
    color: '#38bdf8',
  },
  eventMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventIndexRed: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ff4444',
    opacity: 0.7,
  },
  eventIndexBlue: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    opacity: 0.7,
  },
  eventPlayerRed: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff4444',
  },
  eventPlayerBlue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  eventPointsBadgeRed: {
    backgroundColor: 'rgba(255, 68, 68, 0.18)',
    color: '#ff4444',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  eventPointsBadgeBlue: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
});
