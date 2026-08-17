import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { RootStackParamList } from '../types/navigation';
import { MatchEvent, Team, summarizeEvents } from '../utils/matchEvents';
import { LeagueBadge, EventBadgeType } from '../components/leagues/LeagueBadge';

type Props = NativeStackScreenProps<RootStackParamList, 'LeagueMatchArbitrator'>;

const storageKey = (matchId: string, userId: string) => `arbitration_events_${matchId}_${userId}`;

type ActionType = 'goal' | 'yellow_card' | 'red_card' | 'penalty';
type PendingAction = { type: ActionType; team: Team } | null;
type ReportStatus = 'in_progress' | 'submitted' | 'approved' | 'rejected' | null;

export const LeagueMatchArbitratorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { matchId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<any>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [synced, setSynced] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal de acción
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [ownGoalToggle, setOwnGoalToggle] = useState(false);
  const [penaltyScoredToggle, setPenaltyScoredToggle] = useState(true);

  // Convocatoria
  const [manualInputA, setManualInputA] = useState('');
  const [manualInputB, setManualInputB] = useState('');
  const [membersA, setMembersA] = useState<{ id: string; name: string }[]>([]);
  const [membersB, setMembersB] = useState<{ id: string; name: string }[]>([]);

  // Cronómetro
  const [now, setNow] = useState(Date.now());

  const eventsRef = useRef<MatchEvent[]>([]);
  eventsRef.current = events;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      const record = await pb.collection('league_matches').getOne(matchId, { expand: 'teamA,teamB' });
      setMatch(record);

      const [membersARes, membersBRes] = await Promise.all([
        pb.collection('organization_members').getList(1, 200, {
          filter: `organization = "${record.teamA}" && status = "active"`,
          expand: 'user',
        }),
        pb.collection('organization_members').getList(1, 200, {
          filter: `organization = "${record.teamB}" && status = "active"`,
          expand: 'user',
        }),
      ]);

      setMembersA(
        membersARes.items
          .filter((m: any) => m.expand?.user)
          .map((m: any) => ({ id: m.expand.user.id, name: m.expand.user.name || m.expand.user.username }))
      );
      setMembersB(
        membersBRes.items
          .filter((m: any) => m.expand?.user)
          .map((m: any) => ({ id: m.expand.user.id, name: m.expand.user.name || m.expand.user.username }))
      );

      let report: any = null;
      if (user) {
        try {
          report = await pb.collection('match_reports').getFirstListItem(
            `match = "${matchId}" && referee = "${user.id}"`
          );
        } catch {
          report = null;
        }
      }
      setReportId(report?.id || null);
      setReportStatus(report?.status || null);

      let localEvents: MatchEvent[] = [];
      try {
        const raw = await AsyncStorage.getItem(storageKey(matchId, user?.id || ''));
        if (raw) localEvents = JSON.parse(raw);
      } catch (err) {
        console.error('Error leyendo respaldo local del arbitraje:', err);
      }

      const serverEvents: MatchEvent[] = report?.events || [];
      const initial = localEvents.length > serverEvents.length ? localEvents : serverEvents;
      setEvents(initial);
      await AsyncStorage.setItem(storageKey(matchId, user?.id || ''), JSON.stringify(initial));

      const canStillEdit = record.status === 'confirmed' && report?.status !== 'submitted' && report?.status !== 'approved';
      if (localEvents.length > serverEvents.length && canStillEdit) {
        await syncToServer(initial);
      }
    } catch (err) {
      console.error('Error cargando el partido para arbitrar:', err);
      Toast.show({ type: 'error', text1: 'No se pudo cargar el partido' });
    } finally {
      setLoading(false);
    }
  }, [matchId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadInitial();
    }, [loadInitial])
  );

  const syncToServer = async (updated: MatchEvent[]) => {
    try {
      const res: any = await pb.send('/api/league-matches/events', { method: 'POST', body: { matchId, events: updated } });
      setReportId(res.reportId);
      setReportStatus('in_progress');
      setSynced(true);
    } catch (err: any) {
      console.error('Error sincronizando arbitraje con el servidor:', err);
      setSynced(false);
      Toast.show({
        type: 'error',
        text1: 'No se pudo respaldar en el servidor',
        text2: 'Sigue guardado en este celular, se reintentará.',
      });
    }
  };

  const pushEvent = async (event: MatchEvent) => {
    const updated = [...eventsRef.current, event];
    setEvents(updated);
    await AsyncStorage.setItem(storageKey(matchId, user?.id || ''), JSON.stringify(updated));
    await syncToServer(updated);
  };

  const undoLast = async () => {
    if (eventsRef.current.length === 0) return;
    const updated = eventsRef.current.slice(0, -1);
    setEvents(updated);
    await AsyncStorage.setItem(storageKey(matchId, user?.id || ''), JSON.stringify(updated));
    await syncToServer(updated);
  };

  const summary = summarizeEvents(events);

  // Manejo de convocatoria
  const toggleMemberLineup = async (team: Team, name: string) => {
    const currentLineup = team === 'A' ? summary.lineupA : summary.lineupB;
    const isIncluded = currentLineup.includes(name);
    const updated = isIncluded ? currentLineup.filter((p) => p !== name) : [...currentLineup, name];
    await pushEvent({ type: 'lineup', team, players: updated, at: new Date().toISOString() });
  };

  const addManualPlayer = async (team: Team) => {
    const input = team === 'A' ? manualInputA : manualInputB;
    const name = input.trim();
    if (!name) return;
    const currentLineup = team === 'A' ? summary.lineupA : summary.lineupB;
    if (currentLineup.includes(name)) return;
    await pushEvent({ type: 'lineup', team, players: [...currentLineup, name], at: new Date().toISOString() });
    if (team === 'A') setManualInputA('');
    else setManualInputB('');
  };

  const removeManualPlayer = async (team: Team, name: string) => {
    const currentLineup = team === 'A' ? summary.lineupA : summary.lineupB;
    await pushEvent({ type: 'lineup', team, players: currentLineup.filter((p) => p !== name), at: new Date().toISOString() });
  };

  const toggleHalf = async (half: 1 | 2, action: 'half_start' | 'half_end') => {
    await pushEvent({ type: action, half, at: new Date().toISOString() });
  };

  // Modales de acción
  const openActionModal = (type: ActionType, team: Team) => {
    setPendingAction({ type, team });
    setSelectedPlayer('');
    setOwnGoalToggle(false);
    setPenaltyScoredToggle(true);
  };

  const closeActionModal = () => {
    setPendingAction(null);
    setSelectedPlayer('');
    setOwnGoalToggle(false);
    setPenaltyScoredToggle(true);
  };

  // Cálculo del tiempo en vivo para guardar en el evento
  const activeHalfStart = [...events].reverse().find((ev) => ev.type === 'half_start') as any;
  const activeHalfEndedAfter = activeHalfStart
    ? events.some((ev, i) => ev.type === 'half_end' && (ev as any).half === activeHalfStart.half && events.indexOf(activeHalfStart) < i)
    : false;
  const liveElapsedMs = activeHalfStart && !activeHalfEndedAfter ? now - new Date(activeHalfStart.at).getTime() : null;

  const timerMinutes = liveElapsedMs !== null ? Math.floor(liveElapsedMs / 60000) : 0;
  const timerSeconds = liveElapsedMs !== null ? Math.floor((liveElapsedMs / 1000) % 60) : 0;
  const timerFormatted = `${String(timerMinutes).padStart(2, '0')}:${String(timerSeconds).padStart(2, '0')}`;

  const confirmActionModal = async () => {
    if (!pendingAction) return;
    const player = selectedPlayer.trim();
    if (!player) return;

    const at = new Date().toISOString();

    // Guardar el tiempo y tiempo jugado del evento
    let minute: number | undefined;
    let half: (1 | 2) | undefined;
    if (activeHalfStart && !activeHalfEndedAfter) {
      const elapsedMs = Math.max(0, Date.now() - new Date(activeHalfStart.at).getTime());
      minute = Math.floor(elapsedMs / 60000) + 1;
      half = activeHalfStart.half;
    }

    if (pendingAction.type === 'goal') {
      // "team" siempre es el equipo del JUGADOR que la metió, no a quién se le acredita
      // el punto — en autogol, el jugador convocado que se elige es del equipo RIVAL al
      // botón que se apretó (ver el filtro de modalEligiblePlayers más abajo), así que
      // el evento tiene que reflejar ESE equipo, no pendingAction.team, o summarizeEvents
      // termina acreditando el gol al lado contrario del que corresponde.
      const scorerTeam = ownGoalToggle ? (pendingAction.team === 'A' ? 'B' : 'A') : pendingAction.team;
      await pushEvent({
        type: 'goal',
        team: scorerTeam,
        player,
        ownGoal: ownGoalToggle,
        at,
        minute,
        half,
      });
    } else if (pendingAction.type === 'yellow_card') {
      await pushEvent({
        type: 'yellow_card',
        team: pendingAction.team,
        player,
        at,
        minute,
        half,
      });
    } else if (pendingAction.type === 'red_card') {
      await pushEvent({
        type: 'red_card',
        team: pendingAction.team,
        player,
        at,
        minute,
        half,
      });
    } else if (pendingAction.type === 'penalty') {
      await pushEvent({
        type: 'penalty',
        team: pendingAction.team,
        player,
        scored: penaltyScoredToggle,
        at,
        minute,
        half,
      });
    }

    closeActionModal();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await pb.send('/api/league-matches/submit', { method: 'POST', body: { matchId } });
      Toast.show({ type: 'success', text1: 'Arbitraje enviado', text2: 'Esperando aprobación de la liga.' });
      navigation.replace('LeagueMatchDetail', { matchId });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'No se pudo enviar', text2: err?.data?.error || err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.mutedText}>No se encontró el partido.</Text>
      </View>
    );
  }

  const nameA = match.expand?.teamA?.name || match.expand?.teamA?.username || 'Equipo A';
  const nameB = match.expand?.teamB?.name || match.expand?.teamB?.username || 'Equipo B';

  if (match.status === 'cancelled') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.mutedText}>Este partido fue cancelado.</Text>
      </View>
    );
  }

  if (match.status === 'played') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.mutedText}>
          {reportStatus === 'approved'
            ? '¡Tu informe fue aprobado — es el resultado oficial!'
            : 'Este partido ya tiene un resultado oficial.'}
        </Text>
      </View>
    );
  }

  if (reportStatus === 'submitted') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.submittedScoreText}>
          {nameA} {summary.scoreA} - {summary.scoreB} {nameB}
        </Text>
        <Text style={[styles.mutedText, { marginTop: theme.spacing.md }]}>
          Ya enviaste tu informe de este partido. Está esperando la aprobación de la liga.
        </Text>
      </View>
    );
  }

  // Separación de miembros y jugadores agregados a mano
  const memberNamesSetA = new Set(membersA.map((m) => m.name));
  const memberNamesSetB = new Set(membersB.map((m) => m.name));
  const manualPlayersA = summary.lineupA.filter((p) => !memberNamesSetA.has(p));
  const manualPlayersB = summary.lineupB.filter((p) => !memberNamesSetB.has(p));

  // Lista de jugadores elegibles para el modal de acción
  let modalEligiblePlayers: string[] = [];
  if (pendingAction) {
    if (pendingAction.type === 'goal' && ownGoalToggle) {
      // Autogol: jugadores del equipo RIVAL
      modalEligiblePlayers = pendingAction.team === 'A' ? summary.lineupB : summary.lineupA;
    } else {
      modalEligiblePlayers = pendingAction.team === 'A' ? summary.lineupA : summary.lineupB;
    }
  }

  const timelineEvents = events.filter((e) => e.type !== 'lineup' && e.type !== 'half_end');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!synced && (
        <View style={styles.syncWarning}>
          <Text style={styles.syncWarningText}>
            Sin sincronizar con el servidor — los datos están respaldados en este dispositivo.
          </Text>
        </View>
      )}

      {/* Marcador Principal */}
      <View style={styles.scoreboardSection}>
        <View style={styles.scoreRow}>
          <View style={styles.teamScoreCol}>
            <Text style={styles.teamScoreName} numberOfLines={2}>
              {nameA}
            </Text>
            <Text style={styles.scoreNumber}>{summary.scoreA}</Text>
          </View>

          <Text style={styles.scoreDash}>-</Text>

          <View style={styles.teamScoreCol}>
            <Text style={styles.teamScoreName} numberOfLines={2}>
              {nameB}
            </Text>
            <Text style={styles.scoreNumber}>{summary.scoreB}</Text>
          </View>
        </View>

        {/* Cronómetro Gigante */}
        <View style={styles.timerSection}>
          <Text style={styles.halfBadge}>
            {activeHalfStart && !activeHalfEndedAfter
              ? `${activeHalfStart.half}° Tiempo en juego`
              : summary.halfEnded[2]
              ? 'Partido finalizado'
              : summary.halfEnded[1]
              ? 'Entretiempo'
              : 'Por iniciar'}
          </Text>
          <Text style={styles.largeTimerText}>{timerFormatted}</Text>
        </View>

        {/* Controles de Tiempo */}
        <View style={styles.halfControls}>
          {!summary.halfStarted[1] && (
            <TouchableOpacity style={styles.halfControlBtn} onPress={() => toggleHalf(1, 'half_start')}>
              <Feather name="play" size={14} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.halfControlBtnText}>Iniciar 1° tiempo</Text>
            </TouchableOpacity>
          )}
          {summary.halfStarted[1] && !summary.halfEnded[1] && (
            <TouchableOpacity style={[styles.halfControlBtn, styles.halfControlBtnStop]} onPress={() => toggleHalf(1, 'half_end')}>
              <Feather name="square" size={14} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={[styles.halfControlBtnText, { color: '#ffffff' }]}>Terminar 1° tiempo</Text>
            </TouchableOpacity>
          )}
          {summary.halfEnded[1] && !summary.halfStarted[2] && (
            <TouchableOpacity style={styles.halfControlBtn} onPress={() => toggleHalf(2, 'half_start')}>
              <Feather name="play" size={14} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.halfControlBtnText}>Iniciar 2° tiempo</Text>
            </TouchableOpacity>
          )}
          {summary.halfStarted[2] && !summary.halfEnded[2] && (
            <TouchableOpacity style={[styles.halfControlBtn, styles.halfControlBtnStop]} onPress={() => toggleHalf(2, 'half_end')}>
              <Feather name="square" size={14} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={[styles.halfControlBtnText, { color: '#ffffff' }]}>Terminar 2° tiempo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Botonera de Acciones Rápidas */}
      <View style={styles.divider} />
      <Text style={styles.sectionHeader}>Registrar Incidencia</Text>
      <View style={styles.actionsGrid}>
        {/* Columna Equipo A */}
        <View style={styles.actionsColumn}>
          <Text style={styles.actionsTeamTitle} numberOfLines={1}>
            {nameA}
          </Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openActionModal('goal', 'A')}>
            <LeagueBadge type="goal" size="sm" />
            <Text style={styles.actionBtnLabel}>Gol</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openActionModal('penalty', 'A')}>
            <LeagueBadge type="penalty_scored" size="sm" />
            <Text style={styles.actionBtnLabel}>Penal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openActionModal('yellow_card', 'A')}>
            <LeagueBadge type="yellow_card" size="sm" />
            <Text style={styles.actionBtnLabel}>Amarilla</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openActionModal('red_card', 'A')}>
            <LeagueBadge type="red_card" size="sm" />
            <Text style={styles.actionBtnLabel}>Roja</Text>
          </TouchableOpacity>
        </View>

        {/* Columna Equipo B */}
        <View style={styles.actionsColumn}>
          <Text style={styles.actionsTeamTitle} numberOfLines={1}>
            {nameB}
          </Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openActionModal('goal', 'B')}>
            <LeagueBadge type="goal" size="sm" />
            <Text style={styles.actionBtnLabel}>Gol</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openActionModal('penalty', 'B')}>
            <LeagueBadge type="penalty_scored" size="sm" />
            <Text style={styles.actionBtnLabel}>Penal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openActionModal('yellow_card', 'B')}>
            <LeagueBadge type="yellow_card" size="sm" />
            <Text style={styles.actionBtnLabel}>Amarilla</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openActionModal('red_card', 'B')}>
            <LeagueBadge type="red_card" size="sm" />
            <Text style={styles.actionBtnLabel}>Roja</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista en vivo de Incidencias Agregadas */}
      <View style={styles.divider} />
      <View style={styles.eventsHeaderRow}>
        <Text style={styles.sectionHeader}>Historial de Eventos ({timelineEvents.length})</Text>
        <TouchableOpacity
          style={[styles.undoButton, events.length === 0 && styles.btnDisabled]}
          onPress={undoLast}
          disabled={events.length === 0}
        >
          <Feather name="rotate-ccw" size={12} color={theme.colors.danger} style={{ marginRight: 4 }} />
          <Text style={styles.undoButtonText}>Deshacer último</Text>
        </TouchableOpacity>
      </View>

      {timelineEvents.length === 0 ? (
        <Text style={styles.emptyEventsText}>Aún no se han registrado eventos en este partido.</Text>
      ) : (
        <View style={styles.eventsList}>
          {timelineEvents.map((ev, idx) => {
            if (ev.type === 'half_start') {
              return (
                <View key={`ev-${idx}`} style={styles.eventHalfMarker}>
                  <Text style={styles.eventHalfMarkerText}>{`${ev.half}° Tiempo`}</Text>
                </View>
              );
            }

            const nextEv = timelineEvents[idx + 1];
            const isLastInBlock = !nextEv || nextEv.type === 'half_start';

            const isA = (ev as any).team === 'A';
            const teamName = isA ? nameA : nameB;
            let badgeType: EventBadgeType = 'goal';
            if (ev.type === 'goal') badgeType = ev.ownGoal ? 'own_goal' : 'goal';
            else if (ev.type === 'yellow_card') badgeType = 'yellow_card';
            else if (ev.type === 'red_card') badgeType = 'red_card';
            else if (ev.type === 'penalty') badgeType = ev.scored ? 'penalty_scored' : 'penalty_missed';

            return (
              <View
                key={`ev-${idx}`}
                style={[styles.eventFeedRow, isLastInBlock && { borderBottomWidth: 0 }]}
              >
                <View style={styles.eventFeedLeft}>
                  <LeagueBadge type={badgeType} size="sm" />
                  <Text style={styles.eventFeedPlayer}>{(ev as any).player}</Text>
                  <Text style={styles.eventFeedTeam}>({teamName})</Text>
                  {!!(ev as any).minute && (
                    <Text style={styles.eventFeedMinute}>{(ev as any).minute}'</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Convocatoria y Planteles con Checklist */}
      <View style={styles.divider} />
      <Text style={styles.sectionHeader}>Convocatoria de Jugadores</Text>

      <View style={styles.lineupRow}>
        {(['A', 'B'] as Team[]).map((team) => {
          const isA = team === 'A';
          const teamName = isA ? nameA : nameB;
          const lineup = isA ? summary.lineupA : summary.lineupB;
          const registeredMembers = isA ? membersA : membersB;
          const manualList = isA ? manualPlayersA : manualPlayersB;

          return (
            <View key={team} style={styles.lineupCol}>
              <Text style={styles.lineupColTitle} numberOfLines={1}>
                {teamName} ({lineup.length})
              </Text>

              {/* Checklist de integrantes oficiales */}
              <Text style={styles.lineupSubLabel}>Plantel Registrado</Text>
              {registeredMembers.length === 0 ? (
                <Text style={styles.mutedTextSmall}>Sin miembros registrados en el equipo.</Text>
              ) : (
                registeredMembers.map((m) => {
                  const isChecked = lineup.includes(m.name);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.checklistRow}
                      onPress={() => toggleMemberLineup(team, m.name)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkboxBox, isChecked && styles.checkboxBoxChecked]}>
                        {isChecked && <Feather name="check" size={11} color="#000000" />}
                      </View>
                      <Text style={[styles.checklistName, isChecked && styles.checklistNameChecked]} numberOfLines={1}>
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Jugadores Agregados Manualmente */}
              <Text style={[styles.lineupSubLabel, { marginTop: 12 }]}>
                Agregados a mano ({manualList.length})
              </Text>
              {manualList.length === 0 ? (
                <Text style={styles.mutedTextSmall}>Ninguno</Text>
              ) : (
                manualList.map((player) => (
                  <View key={player} style={styles.manualPlayerRow}>
                    <Text style={styles.manualPlayerName} numberOfLines={1}>
                      {player}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeManualPlayer(team, player)}
                      style={styles.removePlayerBtn}
                    >
                      <Feather name="x" size={13} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {/* Input para agregar manual */}
              <View style={styles.manualInputRow}>
                <TextInput
                  style={styles.manualTextInput}
                  placeholder="Otro jugador..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={isA ? manualInputA : manualInputB}
                  onChangeText={isA ? setManualInputA : setManualInputB}
                  onSubmitEditing={() => addManualPlayer(team)}
                />
                <TouchableOpacity style={styles.addManualBtn} onPress={() => addManualPlayer(team)}>
                  <Feather name="plus" size={14} color="#000000" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Botón Final de Envío */}
      <View style={styles.divider} />
      <TouchableOpacity
        style={[styles.submitMainBtn, submitting && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitMainBtnText}>
          {submitting ? 'Enviando informe...' : 'Finalizar y Enviar a Revisión'}
        </Text>
      </TouchableOpacity>

      {/* Modal de Acción (Gol, Penal, Tarjetas) */}
      <Modal
        visible={!!pendingAction}
        transparent={true}
        animationType="fade"
        onRequestClose={closeActionModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            {/* Header del Modal */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                {pendingAction?.type === 'goal' && <LeagueBadge type={ownGoalToggle ? 'own_goal' : 'goal'} size="md" />}
                {pendingAction?.type === 'yellow_card' && <LeagueBadge type="yellow_card" size="md" />}
                {pendingAction?.type === 'red_card' && <LeagueBadge type="red_card" size="md" />}
                {pendingAction?.type === 'penalty' && <LeagueBadge type={penaltyScoredToggle ? 'penalty_scored' : 'penalty_missed'} size="md" />}

                <Text style={styles.modalTitle}>
                  {pendingAction?.type === 'goal' && (ownGoalToggle ? 'Autogol' : 'Registrar Gol')}
                  {pendingAction?.type === 'yellow_card' && 'Tarjeta Amarilla'}
                  {pendingAction?.type === 'red_card' && 'Tarjeta Roja'}
                  {pendingAction?.type === 'penalty' && 'Registrar Penal'}
                </Text>
              </View>

              <Text style={styles.modalSubTitle}>
                {pendingAction?.team === 'A' ? nameA : nameB}
              </Text>
            </View>

            {/* Opciones específicas según el tipo de acción */}
            {pendingAction?.type === 'goal' && (
              <View style={styles.modalSwitchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>¿Fue autogol / gol en contra?</Text>
                  <Text style={styles.switchSubLabel}>
                    {ownGoalToggle ? 'Se listan jugadores del rival' : 'Se listan jugadores del equipo'}
                  </Text>
                </View>
                <Switch
                  value={ownGoalToggle}
                  onValueChange={(val) => {
                    setOwnGoalToggle(val);
                    setSelectedPlayer('');
                  }}
                  trackColor={{ false: '#222222', true: theme.colors.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            )}

            {pendingAction?.type === 'penalty' && (
              <View style={styles.penaltyToggleRow}>
                <TouchableOpacity
                  style={[styles.penaltyOptionBtn, penaltyScoredToggle && styles.penaltyOptionBtnActive]}
                  onPress={() => setPenaltyScoredToggle(true)}
                >
                  <LeagueBadge type="penalty_scored" size="sm" />
                  <Text style={[styles.penaltyOptionText, penaltyScoredToggle && styles.penaltyOptionTextActive]}>
                    Anotado
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.penaltyOptionBtn, !penaltyScoredToggle && styles.penaltyOptionBtnActive]}
                  onPress={() => setPenaltyScoredToggle(false)}
                >
                  <LeagueBadge type="penalty_missed" size="sm" />
                  <Text style={[styles.penaltyOptionText, !penaltyScoredToggle && styles.penaltyOptionTextActive]}>
                    Fallado
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Lista de Selección de Jugador (Solo convocados) */}
            <Text style={styles.modalPlayerListLabel}>Selecciona el jugador convocado:</Text>

            <ScrollView style={styles.modalPlayerScroll} contentContainerStyle={styles.modalPlayerScrollContent}>
              {modalEligiblePlayers.length === 0 ? (
                <View style={styles.modalEmptyBox}>
                  <Text style={styles.modalEmptyText}>
                    No hay jugadores convocados en este equipo. Debes convocarlos primero en la sección de Convocatoria.
                  </Text>
                </View>
              ) : (
                modalEligiblePlayers.map((p) => {
                  const isSelected = selectedPlayer === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.modalPlayerItem, isSelected && styles.modalPlayerItemSelected]}
                      onPress={() => setSelectedPlayer(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalPlayerItemText, isSelected && styles.modalPlayerItemTextSelected]}>
                        {p}
                      </Text>
                      {isSelected && <Feather name="check" size={14} color="#000000" />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Botones del Modal */}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeActionModal}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  !selectedPlayer && styles.btnDisabled,
                ]}
                onPress={confirmActionModal}
                disabled={!selectedPlayer}
              >
                <Text style={styles.modalConfirmBtnText}>Registrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  submittedScoreText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  mutedText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  mutedTextSmall: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  syncWarning: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: 4,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  syncWarningText: {
    color: theme.colors.text,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e1e1e',
    marginVertical: theme.spacing.md,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // Marcador y Cronómetro
  scoreboardSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 10,
  },
  teamScoreCol: {
    flex: 1,
    alignItems: 'center',
  },
  teamScoreName: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  scoreNumber: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  scoreDash: {
    color: '#444444',
    fontSize: 24,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  timerSection: {
    alignItems: 'center',
    marginVertical: 4,
  },
  halfBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  largeTimerText: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  halfControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  halfControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 4,
  },
  halfControlBtnStop: {
    backgroundColor: '#333333',
    borderWidth: 1,
    borderColor: '#444444',
  },
  halfControlBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },

  // Botonera de Acciones
  actionsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionsColumn: {
    flex: 1,
    gap: 6,
  },
  actionsTeamTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 4,
    paddingVertical: 10,
  },
  actionBtnLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Historial de Eventos
  eventsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#331111',
    backgroundColor: '#1a0505',
    borderRadius: 4,
  },
  undoButtonText: {
    color: theme.colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyEventsText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  eventsList: {
    marginTop: 4,
  },
  eventHalfMarker: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: '#222222',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    marginVertical: 4,
  },
  eventHalfMarkerText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  eventFeedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  eventFeedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventFeedPlayer: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  eventFeedTeam: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  eventFeedMinute: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // Convocatoria
  lineupRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  lineupCol: {
    flex: 1,
  },
  lineupColTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  lineupSubLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  checkboxBox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 3,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  checkboxBoxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checklistName: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  checklistNameChecked: {
    color: '#ffffff',
    fontWeight: '700',
  },
  manualPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  manualPlayerName: {
    color: '#cccccc',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  removePlayerBtn: {
    padding: 4,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  manualTextInput: {
    flex: 1,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: '#ffffff',
    fontSize: 12,
  },
  addManualBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Envío Final
  submitMainBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitMainBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.35,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 6,
    padding: theme.spacing.md,
    maxHeight: '85%',
  },
  modalHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
    paddingBottom: 10,
    marginBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalSubTitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  modalSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
  },
  switchLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  switchSubLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  penaltyToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  penaltyOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 4,
    paddingVertical: 10,
  },
  penaltyOptionBtnActive: {
    borderColor: '#ffffff',
    backgroundColor: '#1c1c1c',
  },
  penaltyOptionText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  penaltyOptionTextActive: {
    color: '#ffffff',
  },
  modalPlayerListLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalPlayerScroll: {
    maxHeight: 220,
  },
  modalPlayerScrollContent: {
    gap: 4,
  },
  modalEmptyBox: {
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalPlayerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  modalPlayerItemSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modalPlayerItemText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  modalPlayerItemTextSelected: {
    color: '#000000',
    fontWeight: '800',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
    paddingTop: 10,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modalCancelBtnText: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  modalConfirmBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});
