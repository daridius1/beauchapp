import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform, RefreshControl } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
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
import { pb } from '../services/pocketbase';

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
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [quoteModalVisible, setQuoteModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMatch(true);
    setRefreshing(false);
  };

  const handleShareMatchToFeed = () => {
    if (!match) return;
    const authUser = currentUser || pb.authStore.model;
    if (!authUser) {
      Toast.show({ type: 'info', text1: 'Autenticación requerida', text2: 'Inicia sesión para citar.' });
      return;
    }
    navigation.navigate('Home', {
      quoteTargetType: 'match',
      quoteTargetId: match.id,
      quoteTargetMeta: {
        sportName: match.expand?.ladder?.name || 'Escalafón',
        mode: match.mode || '1v1',
        scoreRed: match.score_red,
        scoreBlue: match.score_blue,
        teamRed: match.expand?.team_red?.map((u: any) => u.name) || [],
        teamBlue: match.expand?.team_blue?.map((u: any) => u.name) || [],
      }
    });
  };

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
  const day = String(createdDate.getDate()).padStart(2, '0');
  const month = String(createdDate.getMonth() + 1).padStart(2, '0');
  const year = String(createdDate.getFullYear()).slice(-2);
  const formattedDate = `${day}/${month}/${year}`;
  const formattedTime = createdDate.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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
      {/* Marcador Plano con Nombres Coloreados */}
      <View
        style={[
          styles.scoreboardCard,
          match.score_red > match.score_blue && styles.matchCardRedWon,
          match.score_blue > match.score_red && styles.matchCardBlueWon,
        ]}
      >
        {/* Avatares de Fondo Lado Rojo (Superpuestos con borde negro) */}
        {match.expand?.team_red && match.expand.team_red.length > 0 && (
          <View style={[styles.bgAvatarLeftGroup, { pointerEvents: 'none' }]}>
            {/* Jugador 1 (adelante / afuera) */}
            <View style={[styles.bgAvatarFrontLeft, match.expand.team_red.length > 1 && styles.bgAvatarBorderRing]}>
              <Avatar
                user={{
                  id: match.expand.team_red[0].id,
                  collectionId: '_pb_users_auth_',
                  avatar: match.expand.team_red[0].avatar,
                  name: match.expand.team_red[0].name,
                  username: match.expand.team_red[0].username,
                }}
                size={110}
              />
            </View>

            {/* Jugador 2 (atrás / adentro) */}
            {match.expand.team_red[1] && (
              <View style={styles.bgAvatarBackLeft}>
                <Avatar
                  user={{
                    id: match.expand.team_red[1].id,
                    collectionId: '_pb_users_auth_',
                    avatar: match.expand.team_red[1].avatar,
                    name: match.expand.team_red[1].name,
                    username: match.expand.team_red[1].username,
                  }}
                  size={92}
                />
              </View>
            )}
          </View>
        )}

        {/* Avatares de Fondo Lado Azul (Superpuestos con borde negro) */}
        {match.expand?.team_blue && match.expand.team_blue.length > 0 && (
          <View style={[styles.bgAvatarRightGroup, { pointerEvents: 'none' }]}>
            {/* Jugador 1 (adelante / afuera) */}
            <View style={[styles.bgAvatarFrontRight, match.expand.team_blue.length > 1 && styles.bgAvatarBorderRing]}>
              <Avatar
                user={{
                  id: match.expand.team_blue[0].id,
                  collectionId: '_pb_users_auth_',
                  avatar: match.expand.team_blue[0].avatar,
                  name: match.expand.team_blue[0].name,
                  username: match.expand.team_blue[0].username,
                }}
                size={110}
              />
            </View>

            {/* Jugador 2 (atrás / adentro) */}
            {match.expand.team_blue[1] && (
              <View style={styles.bgAvatarBackRight}>
                <Avatar
                  user={{
                    id: match.expand.team_blue[1].id,
                    collectionId: '_pb_users_auth_',
                    avatar: match.expand.team_blue[1].avatar,
                    name: match.expand.team_blue[1].name,
                    username: match.expand.team_blue[1].username,
                  }}
                  size={92}
                />
              </View>
            )}
          </View>
        )}

        {/* Fecha arriba al centro */}
        <View style={styles.dateCenteredHeader}>
          <Text style={styles.dateCenteredText}>{formattedDate}</Text>
        </View>

        <View style={styles.scoreboardMainRow}>
          {/* Lado Rojo */}
          <View style={styles.teamColumn}>
            {match.expand?.team_red?.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.playerColumnCentered}
                onPress={() => navigation.navigate('LadderPlayerProfile', { userId: p.id, slug: match.expand?.ladder?.slug || '', name: match.expand?.ladder?.name })}
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
                onPress={() => navigation.navigate('LadderPlayerProfile', { userId: p.id, slug: match.expand?.ladder?.slug || '', name: match.expand?.ladder?.name })}
              >
                <Text style={styles.playerNameBlueCentered} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Hora abajo al centro */}
        <View style={styles.dateCenteredFooter}>
          <Text style={styles.dateCenteredText}>{formattedTime}</Text>
        </View>
      </View>

      {/* Botón de Compartir/Citar en el Muro */}
      {match.status === 'confirmed' && (
        <TouchableOpacity
          style={styles.shareMatchBtn}
          activeOpacity={0.8}
          onPress={handleShareMatchToFeed}
        >
          <FontAwesome name="quote-left" size={12} color={theme.colors.text} style={{ marginRight: 6 }} />
          <Text style={styles.shareMatchBtnText}>Citar en el muro ({(match as any).quoteCount || 0})</Text>
        </TouchableOpacity>
      )}

      {/* Insignia / Banner de Estado Pendiente */}
      {(match.status === 'pending_confirmation' || match.status === 'disputed') && (
        <View style={styles.statusBannerPending}>
          <View style={styles.statusChipPending}>
            <Text style={styles.statusChipPendingText}>Pendiente</Text>
          </View>
          <Text style={styles.statusBannerText}>
            Resultado propuesto pendiente de confirmación por los jugadores.
          </Text>
        </View>
      )}

      {/* Acción de Confirmación para el usuario actual */}
      {(match.status === 'pending_confirmation' || match.status === 'disputed') &&
        currentUser &&
        (match.team_red.includes(currentUser.id) || match.team_blue.includes(currentUser.id)) &&
        match.confirmations?.[currentUser.id] !== 'accepted' &&
        match.confirmations?.[currentUser.id] !== 'rejected' && (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>¿Participaste en este partido y aceptas el resultado?</Text>
            {actionLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <View style={styles.confirmBtns}>
                <TouchableOpacity style={styles.acceptBtn} activeOpacity={0.8} onPress={() => handleRespondMatch('accepted')}>
                  <Text style={styles.acceptBtnText}>Aceptar Resultado</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} activeOpacity={0.8} onPress={() => handleRespondMatch('rejected')}>
                  <Text style={styles.rejectBtnText}>Rechazar Resultado</Text>
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
  bgAvatarLeftGroup: {
    position: 'absolute',
    left: -20,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.22,
  },
  bgAvatarRightGroup: {
    position: 'absolute',
    right: -20,
    top: 0,
    bottom: 0,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    opacity: 0.22,
  },
  bgAvatarFrontLeft: {
    zIndex: 2,
  },
  bgAvatarBackLeft: {
    zIndex: 1,
    marginLeft: -28,
  },
  bgAvatarFrontRight: {
    zIndex: 2,
  },
  bgAvatarBackRight: {
    zIndex: 1,
    marginRight: -28,
  },
  bgAvatarBorderRing: {
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#000000',
    backgroundColor: '#000000',
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
  dateCenteredHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  shareMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: theme.spacing.md,
  },
  shareMatchBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  dateCenteredFooter: {
    alignItems: 'center',
    marginTop: 6,
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
    fontWeight: '800',
    color: '#ff4444',
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? ({ textShadow: '0px 2px 8px #000000, 0px 0px 5px #000000, 0px 0px 2px #000000' } as any)
      : {
          textShadowColor: '#000000',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 8,
        }),
  },
  playerNameBlueCentered: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38bdf8',
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? ({ textShadow: '0px 2px 8px #000000, 0px 0px 5px #000000, 0px 0px 2px #000000' } as any)
      : {
          textShadowColor: '#000000',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 8,
        }),
  },
  scoreDisplay: {
    paddingHorizontal: 12,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
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
  statusBannerPending: {
    backgroundColor: 'rgba(255, 170, 0, 0.08)',
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 0, 0.3)',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  statusChipPending: {
    backgroundColor: 'rgba(255, 170, 0, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  statusChipPendingText: {
    color: '#ffaa00',
    fontSize: 12,
    fontWeight: '800',
  },
  statusBannerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  confirmBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  confirmTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  rejectBtnText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: '800',
  },
});
