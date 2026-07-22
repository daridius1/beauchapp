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

  const isConfirmed = match.status === 'confirmed';
  const isDisputed = match.status === 'disputed';
  const isPending = match.status === 'pending_confirmation';

  const createdDate = new Date(match.created);
  const formattedDate = createdDate.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isTipTap = match.expand?.ladder?.slug === 'tiptap';

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
        <View style={styles.scoreboardMainRow}>
          {/* Lado Rojo */}
          <View style={styles.teamColumn}>
            {match.expand?.team_red?.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.playerRow}
                onPress={() => navigation.navigate('UserProfile', { userId: p.id })}
              >
                <Avatar user={{ id: p.id, collectionId: '_pb_users_auth_', avatar: p.avatar, name: p.name, username: p.username }} size={28} />
                <Text style={styles.playerNameRed} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Resultado Uniforme */}
          <View style={styles.scoreDisplay}>
            <Text style={styles.scoreValue}>
              <Text style={{ color: '#ff4444' }}>{match.score_red}</Text> - <Text style={{ color: '#38bdf8' }}>{match.score_blue}</Text>
            </Text>
          </View>

          {/* Lado Azul */}
          <View style={styles.teamColumnRight}>
            {match.expand?.team_blue?.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.playerRowRight}
                onPress={() => navigation.navigate('UserProfile', { userId: p.id })}
              >
                <Text style={styles.playerNameBlue} numberOfLines={1}>{p.name}</Text>
                <Avatar user={{ id: p.id, collectionId: '_pb_users_auth_', avatar: p.avatar, name: p.name, username: p.username }} size={28} />
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

      {/* Timeline de Secuencia con Nombres Coloreados */}
      <View style={styles.timelineSection}>
        <Text style={styles.timelineTitle}>Secuencia de Juego ({timelineEvents.length})</Text>

        {timelineEvents.map((ev) => (
          <View key={ev.index} style={styles.timelineRow}>
            <Text style={styles.timelineIndex}>#{ev.index}</Text>
            <Text style={styles.timelineText}>
              Peloteo #{ev.index}:{' '}
              <Text style={{ color: ev.team === 'red' ? '#ff4444' : '#38bdf8', fontWeight: '700' }}>
                {ev.winnerName}
              </Text>
              {ev.points > 1 ? ` cobra +${ev.points} pts` : ' suma 1 pt'}
            </Text>
            <Text style={styles.timelineScore}>({ev.scoreRedAfter} - {ev.scoreBlueAfter})</Text>
          </View>
        ))}
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
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  headerBox: {
    marginBottom: theme.spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sportTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
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
  dateText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  scoreboardCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  matchCardRedWon: Platform.OS === 'web' ? ({
    backgroundImage: 'linear-gradient(to top, rgba(255, 68, 68, 0.22) 0%, rgba(255, 68, 68, 0.04) 60%, transparent 100%)',
    borderBottomWidth: 3,
    borderBottomColor: '#ff4444',
  } as any) : {
    borderBottomWidth: 3,
    borderBottomColor: '#ff4444',
  },
  matchCardBlueWon: Platform.OS === 'web' ? ({
    backgroundImage: 'linear-gradient(to top, rgba(56, 189, 248, 0.22) 0%, rgba(56, 189, 248, 0.04) 60%, transparent 100%)',
    borderBottomWidth: 3,
    borderBottomColor: '#38bdf8',
  } as any) : {
    borderBottomWidth: 3,
    borderBottomColor: '#38bdf8',
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
  },
  teamColumnRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerNameRed: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff4444',
    flex: 1,
  },
  playerNameBlue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38bdf8',
    textAlign: 'right',
    flex: 1,
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
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  timelineIndex: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    width: 28,
  },
  timelineText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.text,
  },
  timelineScore: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
});
