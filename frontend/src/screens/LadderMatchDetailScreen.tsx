import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
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
import { Feather } from '@expo/vector-icons';

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

  const isRedWinner = match.score_red > match.score_blue;
  const isBlueWinner = match.score_blue > match.score_red;
  const isDraw = match.score_red === match.score_blue;

  const createdDate = new Date(match.created);
  const formattedDate = createdDate.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const requiresUserAction =
    isPending &&
    currentUser &&
    (match.team_red.includes(currentUser.id) || match.team_blue.includes(currentUser.id)) &&
    match.confirmations?.[currentUser.id] === undefined;

  // Reconstruir la secuencia de puntos/peloteos paso a paso para el Replay Timeline
  let runningRed = 0;
  let runningBlue = 0;
  const isTipTap = match.expand?.ladder?.slug === 'tiptap';

  const timelineEvents = (match.goal_history || []).map((step, index) => {
    const stepStr = typeof step === 'string' ? step : '';

    // Si es un registro de peloteo de TipTap (ej: "Peloteo 1: Eduardo pierde 9 pt(s) -> cata cobra +9 pts (9 - 0)")
    const scoreMatch = stepStr.match(/\((\d+)\s*-\s*(\d+)\)/);
    const pozoMatch = stepStr.match(/\+(\d+)\s*pts?/i);

    if (scoreMatch) {
      const scoreRedAfter = parseInt(scoreMatch[1], 10);
      const scoreBlueAfter = parseInt(scoreMatch[2], 10);
      const deltaRed = scoreRedAfter - runningRed;
      const deltaBlue = scoreBlueAfter - runningBlue;
      const team = deltaRed > 0 ? 'red' : 'blue';
      const pozo = parseInt(pozoMatch?.[1] || `${Math.max(deltaRed, deltaBlue)}`, 10);

      runningRed = scoreRedAfter;
      runningBlue = scoreBlueAfter;

      return {
        index: index + 1,
        team,
        pozo,
        scoreRedAfter,
        scoreBlueAfter,
        text: stepStr,
      };
    }

    // Comportamiento estándar gol por gol (1 a 1)
    const isRed = step === 'red' || stepStr.toLowerCase().includes('rojo');
    if (isRed) runningRed += 1;
    else runningBlue += 1;

    return {
      index: index + 1,
      team: isRed ? 'red' : 'blue',
      pozo: 1,
      scoreRedAfter: runningRed,
      scoreBlueAfter: runningBlue,
      text: isRed ? 'Punto Lado Rojo 🔴' : 'Punto Lado Azul 🔵',
    };
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* CABECERA SUPERIOR */}
      <View style={styles.matchHeaderBox}>
        <View style={styles.badgeRow}>
          <View style={styles.sportBadge}>
            <Text style={styles.sportBadgeText}>
              {match.expand?.ladder?.name ? match.expand.ladder.name.toUpperCase() : `LADDER ${match.mode}`}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              isConfirmed && styles.statusBadgeConfirmed,
              isDisputed && styles.statusBadgeDisputed,
              isPending && styles.statusBadgePending,
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {isConfirmed ? 'CONFIRMADO' : isDisputed ? 'DISPUTADO' : 'PENDIENTE'}
            </Text>
          </View>
        </View>

        <Text style={styles.matchDateText}>
          <Feather name="calendar" size={12} color={theme.colors.textMuted} /> {formattedDate}
        </Text>
      </View>

      {/* TARJETA MARCADOR FINAL */}
      <View style={styles.scoreCard}>
        {/* LADO ROJO */}
        <View style={styles.teamSideBox}>
          {isRedWinner && <Text style={styles.winnerBadge}>🏆 GANADOR</Text>}
          <Text style={styles.teamHeaderRed}>LADO ROJO</Text>
          {match.expand?.team_red?.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.playerAvatarRow}
              onPress={() => navigation.navigate('UserProfile', { userId: p.id })}
            >
              <Avatar
                user={{ id: p.id, collectionId: '_pb_users_auth_', avatar: p.avatar, name: p.name, username: p.username }}
                size={38}
              />
              <Text style={styles.playerNameText} numberOfLines={1}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* NÚMEROS DEL MARCADOR */}
        <View style={styles.bigScoreBox}>
          <Text style={[styles.bigScoreRed, isRedWinner && styles.bigScoreWinner]}>{match.score_red}</Text>
          <Text style={styles.scoreDivider}>-</Text>
          <Text style={[styles.bigScoreBlue, isBlueWinner && styles.bigScoreWinner]}>{match.score_blue}</Text>
        </View>

        {/* LADO AZUL */}
        <View style={styles.teamSideBox}>
          {isBlueWinner && <Text style={styles.winnerBadge}>🏆 GANADOR</Text>}
          <Text style={styles.teamHeaderBlue}>LADO AZUL</Text>
          {match.expand?.team_blue?.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.playerAvatarRow}
              onPress={() => navigation.navigate('UserProfile', { userId: p.id })}
            >
              <Avatar
                user={{ id: p.id, collectionId: '_pb_users_auth_', avatar: p.avatar, name: p.name, username: p.username }}
                size={38}
              />
              <Text style={styles.playerNameText} numberOfLines={1}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ACCIÓN PENDIENTE PARA EL JUGADOR ACTUAL */}
      {requiresUserAction && (
        <View style={styles.confirmActionBox}>
          <Text style={styles.confirmPromptTitle}>¿Participaste en esta partida?</Text>
          <Text style={styles.confirmPromptSub}>Confirma el resultado para validar los puntos OpenSkill.</Text>
          {actionLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 8 }} />
          ) : (
            <View style={styles.confirmButtonsRow}>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleRespondMatch('accepted')}
              >
                <Feather name="check" color="#000000" size={16} style={{ marginRight: 6 }} />
                <Text style={styles.acceptButtonText}>Confirmar Resultado</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => handleRespondMatch('rejected')}
              >
                <Feather name="x" color="#ffffff" size={16} style={{ marginRight: 6 }} />
                <Text style={styles.rejectButtonText}>Rechazar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* DESGLOSE OPENSKILL (ELO CHANGES) */}
      {isConfirmed && match.openskill_changes && (
        <View style={styles.sectionBox}>
          <View style={styles.sectionTitleRow}>
            <Feather name="trending-up" color="#ffffff" size={16} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>Variación de Rating OpenSkill (ELO)</Text>
          </View>

          {/* Cambios Equipo Rojo */}
          {match.openskill_changes.red?.map((data: any) => {
            const playerRec = match.expand?.team_red?.find((p) => p.id === data.userId);
            const isPositive = data.delta >= 0;
            return (
              <View key={data.userId} style={styles.eloChangeRow}>
                <Text style={styles.eloPlayerName} numberOfLines={1}>
                  🔴 {playerRec?.name || 'Jugador'}
                </Text>
                <View style={styles.eloDeltaBox}>
                  <Text style={[styles.eloDeltaText, isPositive ? styles.deltaPlus : styles.deltaMinus]}>
                    {isPositive ? `+${data.delta.toFixed(1)}` : `${data.delta.toFixed(1)}`} ELO
                  </Text>
                  <Text style={styles.eloNewRating}>Rating: {Math.round(data.ordinal_rating)}</Text>
                </View>
              </View>
            );
          })}

          {/* Cambios Equipo Azul */}
          {match.openskill_changes.blue?.map((data: any) => {
            const playerRec = match.expand?.team_blue?.find((p) => p.id === data.userId);
            const isPositive = data.delta >= 0;
            return (
              <View key={data.userId} style={styles.eloChangeRow}>
                <Text style={styles.eloPlayerName} numberOfLines={1}>
                  🔵 {playerRec?.name || 'Jugador'}
                </Text>
                <View style={styles.eloDeltaBox}>
                  <Text style={[styles.eloDeltaText, isPositive ? styles.deltaPlus : styles.deltaMinus]}>
                    {isPositive ? `+${data.delta.toFixed(1)}` : `${data.delta.toFixed(1)}`} ELO
                  </Text>
                  <Text style={styles.eloNewRating}>Rating: {Math.round(data.ordinal_rating)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* REPLAY TIMELINE (DESGLOSE GOL POR GOL / PUNTO POR PUNTO) */}
      <View style={styles.sectionBox}>
        <View style={styles.sectionTitleRow}>
          <Feather name="activity" color="#ffffff" size={16} style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>
            {isTipTap
              ? `Secuencia de Peloteos (${timelineEvents.length} Peloteos)`
              : `Secuencia Punto por Punto (${timelineEvents.length} Puntos)`}
          </Text>
        </View>

        {timelineEvents.length === 0 ? (
          <Text style={styles.emptyText}>No se guardó el historial detallado de puntos.</Text>
        ) : (
          timelineEvents.map((evt) => {
            const isMatchPoint = evt.index === timelineEvents.length;
            return (
              <View key={evt.index} style={styles.timelineItemRow}>
                <View style={styles.stepNumberCircle}>
                  <Text style={styles.stepNumberText}>{evt.index}</Text>
                </View>

                <View style={styles.stepContent}>
                  <Text style={styles.stepText}>{evt.text}</Text>
                  {isMatchPoint && <Text style={styles.matchPointText}>🏆 Punto de Partido</Text>}
                </View>

                <View style={styles.stepScoreBox}>
                  <Text style={[styles.stepScoreRed, evt.team === 'red' && styles.stepScoreBold]}>
                    {evt.scoreRedAfter}
                  </Text>
                  <Text style={styles.stepScoreDivider}>-</Text>
                  <Text style={[styles.stepScoreBlue, evt.team === 'blue' && styles.stepScoreBold]}>
                    {evt.scoreBlueAfter}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ÁRBITRO Y ESTADO ANTI-FRAUDE */}
      <View style={styles.sectionBox}>
        <View style={styles.sectionTitleRow}>
          <Feather name="shield" color="#ffffff" size={16} style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>Arbitraje y Verificación Anti-Fraude</Text>
        </View>

        <Text style={styles.arbiterInfoText}>
          Partido arbitrado y registrado por: <Text style={{ color: '#ffffff', fontWeight: '700' }}>@{match.expand?.arbiter?.username || match.expand?.arbiter?.name || 'Árbitro'}</Text>
        </Text>

        <View style={styles.confirmationsList}>
          {match.expand?.team_red?.concat(match.expand?.team_blue || []).map((player) => {
            const statusStr = match.confirmations?.[player.id];
            const isAccepted = statusStr === 'accepted';
            const isRejected = statusStr === 'rejected';

            return (
              <View key={player.id} style={styles.confirmationRow}>
                <Text style={styles.confPlayerName}>{player.name}</Text>
                <View style={styles.confStatusBadge}>
                  {isAccepted && <Text style={styles.confAcceptedText}>✅ Confirmado</Text>}
                  {isRejected && <Text style={styles.confRejectedText}>❌ Rechazado</Text>}
                  {!isAccepted && !isRejected && <Text style={styles.confPendingText}>⏳ Esperando confirmación</Text>}
                </View>
              </View>
            );
          })}
        </View>
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
    justifyContent: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  matchHeaderBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  sportBadge: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333333',
  },
  sportBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    fontWeight: '800',
    color: theme.colors.text,
  },
  matchDateText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  scoreCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamSideBox: {
    flex: 1,
    alignItems: 'center',
  },
  winnerBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#eab308',
    marginBottom: 4,
  },
  teamHeaderRed: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ff4444',
    marginBottom: 6,
  },
  teamHeaderBlue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
    marginBottom: 6,
  },
  playerAvatarRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  playerNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 4,
  },
  bigScoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  bigScoreRed: {
    fontSize: 44,
    fontWeight: '900',
    color: '#ff4444',
  },
  bigScoreBlue: {
    fontSize: 44,
    fontWeight: '900',
    color: '#38bdf8',
  },
  bigScoreWinner: {
    fontSize: 52,
  },
  scoreDivider: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginHorizontal: 8,
  },
  confirmActionBox: {
    backgroundColor: '#121212',
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#eab308',
    alignItems: 'center',
  },
  confirmPromptTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  confirmPromptSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  acceptButton: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  rejectButton: {
    backgroundColor: '#ff4444',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  eloChangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  eloPlayerName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  eloDeltaBox: {
    alignItems: 'flex-end',
  },
  eloDeltaText: {
    fontSize: 14,
    fontWeight: '900',
  },
  deltaPlus: {
    color: '#22c55e',
  },
  deltaMinus: {
    color: '#ef4444',
  },
  eloNewRating: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  timelineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  stepNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  matchPointText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#eab308',
  },
  stepScoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stepScoreRed: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff4444',
  },
  stepScoreBlue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  stepScoreBold: {
    fontWeight: '900',
    fontSize: 13,
  },
  stepScoreDivider: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginHorizontal: 4,
  },
  arbiterInfoText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  confirmationsList: {
    gap: 6,
  },
  confirmationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  confPlayerName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  confStatusBadge: {
    alignItems: 'flex-end',
  },
  confAcceptedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22c55e',
  },
  confRejectedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
  },
  confPendingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#eab308',
  },
});
