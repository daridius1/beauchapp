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
  DeviceEventEmitter,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { withMinimumDelay } from '../utils/refresh';
import { RootStackParamList } from '../types/navigation';
import { MatchEvent, Team, summarizeEvents, isClockGatedSequenceValid, computeLiveElapsedMs, annotateEventsWithHalfTime, formatClockTime } from '../utils/matchEvents';
import { LeagueBadge, EventBadgeType } from '../components/leagues/LeagueBadge';

type Props = NativeStackScreenProps<RootStackParamList, 'LeagueMatchArbitrator'>;

const eventsStorageKey = (matchId: string) => `arbitration_events_${matchId}`;
const codeStorageKey = (matchId: string) => `arbitration_code_${matchId}`;
const POLL_INTERVAL_MS = 10000;

type ActionType = 'goal' | 'yellow_card' | 'red_card' | 'penalty';
type PendingAction = { type: ActionType; team: Team } | null;
type ReportStatus = 'in_progress' | 'submitted' | 'approved' | 'rejected' | null;

interface ConfirmModalState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

export const LeagueMatchArbitratorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { matchId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<any>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [notes, setNotes] = useState('');
  const [synced, setSynced] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Código de la sesión — o lo creamos, o hay que pedirlo para unirse.
  const [code, setCode] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);

  // Modal de acción (gol/tarjeta/penal)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [ownGoalToggle, setOwnGoalToggle] = useState(false);
  const [penaltyScoredToggle, setPenaltyScoredToggle] = useState(true);

  // Convocatoria
  const [manualInputA, setManualInputA] = useState('');
  const [manualInputB, setManualInputB] = useState('');
  const [membersA, setMembersA] = useState<{ id: string; name: string }[]>([]);
  const [membersB, setMembersB] = useState<{ id: string; name: string }[]>([]);

  // Modal genérico de confirmación (iniciar/terminar tiempo, pausar, eliminar evento, enviar)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Modal del informe arbitral (texto libre)
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Cronómetro
  const [now, setNow] = useState(Date.now());

  const eventsRef = useRef<MatchEvent[]>([]);
  eventsRef.current = events;
  const codeRef = useRef<string | null>(null);
  codeRef.current = code;
  const pushInFlightRef = useRef(false);
  const reportIdRef = useRef<string | null>(null);
  reportIdRef.current = reportId;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const askConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    opts?: { confirmLabel?: string; danger?: boolean }
  ) => {
    setConfirmModal({ title, message, onConfirm, confirmLabel: opts?.confirmLabel || 'Confirmar', danger: opts?.danger });
  };

  const runConfirm = async () => {
    if (!confirmModal) return;
    setConfirming(true);
    try {
      await confirmModal.onConfirm();
    } finally {
      setConfirming(false);
      setConfirmModal(null);
    }
  };

  const loadInitial = useCallback(async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      await withMinimumDelay(async () => {
        const record = await pb.collection('league_matches').getOne(matchId, { expand: 'teamA,teamB' });
        setMatch(record);

        // Integrantes de cada equipo — sugerencia lista para agregar a la convocatoria,
        // no reemplaza el texto libre (un equipo puede convocar a alguien sin cuenta).
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
          membersARes.items.filter((m: any) => m.expand?.user).map((m: any) => ({ id: m.expand.user.id, name: m.expand.user.name || m.expand.user.username }))
        );
        setMembersB(
          membersBRes.items.filter((m: any) => m.expand?.user).map((m: any) => ({ id: m.expand.user.id, name: m.expand.user.name || m.expand.user.username }))
        );

        if (record.status !== 'confirmed') {
          // No hace falta ningún código — la vista se muestra en modo terminal más abajo.
          return;
        }

        // El código lo genera la liga al agendar el partido y hace falta desde el
        // primer intento de arbitrarlo — no hay ningún "fundador" que lo reciba gratis.
        // Si ya lo guardamos en este dispositivo se revalida (puede estar mal o haber
        // cambiado); si no, se pide.
        const storedCode = await AsyncStorage.getItem(codeStorageKey(matchId));
        if (storedCode) {
          try {
            await pb.send('/api/league-matches/join', { method: 'POST', body: { matchId, code: storedCode } });
            setCode(storedCode);
            codeRef.current = storedCode;
            setNeedsCode(false);
            await loadReportState(storedCode);
          } catch (err) {
            await AsyncStorage.removeItem(codeStorageKey(matchId));
            setNeedsCode(true);
          }
        } else {
          setNeedsCode(true);
        }
      }, 400);
    } catch (err) {
      console.error('Error cargando el partido para arbitrar:', err);
      Toast.show({ type: 'error', text1: 'No se pudo cargar el partido' });
    } finally {
      if (!hideLoading) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  // Se llama una vez el código ya está validado — trae (si existe) la sesión
  // compartida de arbitraje. No crea nada: el primer push de eventos de cualquiera
  // es lo que crea la sesión (ver /api/league-matches/events).
  const loadReportState = async (activeCode: string) => {
    let report: any = null;
    try {
      report = await pb.collection('match_reports').getFirstListItem(`match = "${matchId}"`);
    } catch {
      report = null;
    }

    if (!report) {
      setReportId(null);
      setReportStatus(null);
      setEvents([]);
      setNotes('');
      return;
    }

    setReportId(report.id);
    setReportStatus(report.status);
    setNotes(report.notes || '');

    const stillWritable = report.status !== 'submitted' && report.status !== 'approved';
    let localEvents: MatchEvent[] = [];
    try {
      const raw = await AsyncStorage.getItem(eventsStorageKey(matchId));
      if (raw) localEvents = JSON.parse(raw);
    } catch (err) {
      console.error('Error leyendo respaldo local del arbitraje:', err);
    }
    const serverEvents: MatchEvent[] = report.events || [];
    const initial = localEvents.length > serverEvents.length ? localEvents : serverEvents;
    setEvents(initial);
    await AsyncStorage.setItem(eventsStorageKey(matchId), JSON.stringify(initial));

    if (stillWritable && localEvents.length > serverEvents.length) {
      await syncToServer(initial, activeCode);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadInitial();
    }, [loadInitial])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await loadInitial(true);
      setLoading(false);
    });
    return () => sub.remove();
  }, [loadInitial]);

  // Sincronización periódica — cada ~10s se trae el estado real del servidor, para que
  // los eventos que agreguen otras personas aparezcan acá sin tener que hacer nada. No
  // pisa una escritura propia que esté en curso en ese instante.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (pushInFlightRef.current || !reportIdRef.current) return;
      try {
        const fresh = await pb.collection('match_reports').getOne(reportIdRef.current);
        const freshEvents: MatchEvent[] = fresh.events || [];
        if (JSON.stringify(freshEvents) !== JSON.stringify(eventsRef.current)) {
          setEvents(freshEvents);
          await AsyncStorage.setItem(eventsStorageKey(matchId), JSON.stringify(freshEvents));
        }
        setReportStatus(fresh.status);
        setNotes(fresh.notes || '');

        const freshMatch = await pb.collection('league_matches').getOne(matchId);
        setMatch((prev: any) => (prev && prev.status === freshMatch.status ? prev : freshMatch));
      } catch (err) {
        // Se reintenta en el próximo ciclo.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [matchId]);

  const syncToServer = async (updated: MatchEvent[], codeOverride?: string) => {
    const activeCode = codeOverride || codeRef.current;
    if (!activeCode) {
      setSynced(false);
      return;
    }
    pushInFlightRef.current = true;
    try {
      await pb.send('/api/league-matches/events', { method: 'POST', body: { matchId, code: activeCode, events: updated } });
      setSynced(true);
    } catch (err: any) {
      console.error('Error sincronizando arbitraje con el servidor:', err);
      setSynced(false);
      Toast.show({
        type: 'error',
        text1: 'No se pudo respaldar en el servidor',
        text2: err?.data?.error || 'Sigue guardado en este celular, se reintentará.',
      });
    } finally {
      pushInFlightRef.current = false;
    }
  };

  const pushEvent = async (event: MatchEvent) => {
    const updated = [...eventsRef.current, event];
    setEvents(updated);
    await AsyncStorage.setItem(eventsStorageKey(matchId), JSON.stringify(updated));
    await syncToServer(updated);
  };

  const deleteEventAt = (index: number) => {
    const target = eventsRef.current[index];
    if (!target) return;
    askConfirm('Eliminar evento', '¿Eliminar este evento? No se puede deshacer.', async () => {
      const updated = eventsRef.current.filter((_, i) => i !== index);
      if (!isClockGatedSequenceValid(updated)) {
        Toast.show({
          type: 'error',
          text1: 'No se puede eliminar',
          text2: 'Dejaría un gol, tarjeta o penal fuera de un tiempo en juego.',
        });
        return;
      }
      setEvents(updated);
      await AsyncStorage.setItem(eventsStorageKey(matchId), JSON.stringify(updated));
      await syncToServer(updated);
    }, { confirmLabel: 'Eliminar', danger: true });
  };

  const summary = summarizeEvents(events);
  const annotatedEvents = annotateEventsWithHalfTime(events);

  const handleJoin = async () => {
    if (codeInput.trim().length !== 6) return;
    setJoiningCode(true);
    try {
      const c = codeInput.trim().toUpperCase();
      await pb.send('/api/league-matches/join', { method: 'POST', body: { matchId, code: c } });
      setCode(c);
      codeRef.current = c;
      await AsyncStorage.setItem(codeStorageKey(matchId), c);
      setNeedsCode(false);
      await loadReportState(c);
      Toast.show({ type: 'success', text1: 'Código verificado' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Código incorrecto', text2: err?.data?.error || err?.message });
    } finally {
      setJoiningCode(false);
    }
  };

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

  // Iniciar/terminar tiempo y pausar SIEMPRE piden confirmación; reanudar no (para no
  // entorpecer volver al juego).
  const requestHalfStart = (half: 1 | 2) => {
    askConfirm(
      half === 1 ? 'Iniciar el partido' : 'Iniciar el 2do tiempo',
      half === 1 ? '¿Confirmas iniciar el partido? Empieza a correr el reloj.' : '¿Confirmas iniciar el 2do tiempo?',
      () => pushEvent({ type: 'half_start', half, at: new Date().toISOString() })
    );
  };
  const requestHalfEnd = (half: 1 | 2) => {
    askConfirm(
      half === 1 ? 'Terminar el 1er tiempo' : 'Terminar el partido',
      half === 1 ? '¿Confirmas terminar el 1er tiempo?' : '¿Confirmas terminar el partido? No se podrán registrar más eventos.',
      () => pushEvent({ type: 'half_end', half, at: new Date().toISOString() })
    );
  };
  const requestPause = () => {
    askConfirm('Pausar el partido', '¿Confirmas pausar? Mientras esté pausado no se pueden registrar goles, tarjetas ni penales.', () =>
      pushEvent({ type: 'pause', at: new Date().toISOString() })
    );
  };
  const requestResume = () => {
    askConfirm('Reanudar el partido', '¿Confirmas reanudar? Vuelve a correr el reloj.', () =>
      pushEvent({ type: 'resume', at: new Date().toISOString() })
    );
  };

  const activeHalf: 1 | 2 | null = summary.halfStarted[1] && !summary.halfEnded[1] ? 1 : summary.halfStarted[2] && !summary.halfEnded[2] ? 2 : null;

  // Cálculo del tiempo en vivo (resta pausas) para mostrar y para guardar en el evento
  const { elapsedMs: liveElapsedMs, running: clockCurrentlyRunning } = computeLiveElapsedMs(events, now);
  const timerMinutes = Math.floor(liveElapsedMs / 60000);
  const timerSeconds = Math.floor((liveElapsedMs / 1000) % 60);
  const timerFormatted = `${String(timerMinutes).padStart(2, '0')}:${String(timerSeconds).padStart(2, '0')}`;

  // Modal de acción (gol/tarjeta/penal)
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

  const confirmActionModal = async () => {
    if (!pendingAction) return;
    const player = selectedPlayer.trim();
    if (!player) return;

    const at = new Date().toISOString();
    let minute: number | undefined;
    let half: (1 | 2) | undefined;
    if (activeHalf && clockCurrentlyRunning) {
      minute = timerMinutes + 1;
      half = activeHalf;
    }

    if (pendingAction.type === 'goal') {
      // "team" siempre es el equipo del JUGADOR que la metió, no a quién se le acredita
      // el punto — en autogol, el jugador convocado elegido es del equipo RIVAL al
      // botón que se apretó (ver modalEligiblePlayers), así que el evento tiene que
      // reflejar ESE equipo, o summarizeEvents termina acreditando el gol al lado
      // contrario del que corresponde.
      const scorerTeam = ownGoalToggle ? (pendingAction.team === 'A' ? 'B' : 'A') : pendingAction.team;
      await pushEvent({ type: 'goal', team: scorerTeam, player, ownGoal: ownGoalToggle, at, minute, half });
    } else if (pendingAction.type === 'yellow_card') {
      await pushEvent({ type: 'yellow_card', team: pendingAction.team, player, at, minute, half });
    } else if (pendingAction.type === 'red_card') {
      await pushEvent({ type: 'red_card', team: pendingAction.team, player, at, minute, half });
    } else if (pendingAction.type === 'penalty') {
      await pushEvent({ type: 'penalty', team: pendingAction.team, player, scored: penaltyScoredToggle, at, minute, half });
    }

    closeActionModal();
  };

  const handleSubmit = () => {
    askConfirm(
      'Finalizar el partido',
      '¿Confirmas finalizar el partido? El resultado se hace oficial de inmediato y nadie va a poder seguir editándolo.',
      async () => {
        setSubmitting(true);
        try {
          await pb.send('/api/league-matches/submit', { method: 'POST', body: { matchId, code: codeRef.current } });
          Toast.show({ type: 'success', text1: 'Partido finalizado', text2: 'El resultado ya es oficial.' });
          navigation.replace('LeagueMatchDetail', { matchId });
        } catch (err: any) {
          Toast.show({ type: 'error', text1: 'No se pudo finalizar', text2: err?.data?.error || err?.message });
        } finally {
          setSubmitting(false);
        }
      },
      { confirmLabel: 'Finalizar' }
    );
  };

  const openNotesModal = () => {
    setNotesDraft(notes);
    setShowNotesModal(true);
  };
  const saveNotes = async () => {
    if (!codeRef.current) return;
    setSavingNotes(true);
    try {
      await pb.send('/api/league-matches/notes', { method: 'POST', body: { matchId, code: codeRef.current, notes: notesDraft } });
      setNotes(notesDraft);
      setShowNotesModal(false);
      Toast.show({ type: 'success', text1: 'Informe guardado' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'No se pudo guardar', text2: err?.data?.error || err?.message });
    } finally {
      setSavingNotes(false);
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
          {reportStatus === 'approved' ? '¡El informe fue aprobado — es el resultado oficial!' : 'Este partido ya tiene un resultado oficial.'}
        </Text>
      </View>
    );
  }

  if (needsCode) {
    return (
      <View style={styles.centerContainer}>
        <Feather name="lock" size={28} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
        <Text style={styles.mutedText}>
          Para arbitrar este partido necesitas su código — pídeselo a la liga.
        </Text>
        <TextInput
          style={styles.codeInput}
          placeholder="CÓDIGO"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          value={codeInput}
          onChangeText={(t) => setCodeInput(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        />
        <TouchableOpacity
          style={[styles.submitMainBtn, (joiningCode || codeInput.length !== 6) && styles.btnDisabled]}
          onPress={handleJoin}
          disabled={joiningCode || codeInput.length !== 6}
        >
          <Text style={styles.submitMainBtnText}>{joiningCode ? 'Verificando...' : 'Unirme'}</Text>
        </TouchableOpacity>
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
      modalEligiblePlayers = pendingAction.team === 'A' ? summary.lineupB : summary.lineupA;
    } else {
      modalEligiblePlayers = pendingAction.team === 'A' ? summary.lineupA : summary.lineupB;
    }
  }

  const canPause = activeHalf !== null && clockCurrentlyRunning;
  const canResume = activeHalf !== null && !clockCurrentlyRunning;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!synced && (
        <View style={styles.syncWarning}>
          <Text style={styles.syncWarningText}>Sin sincronizar con el servidor — los datos están respaldados en este dispositivo.</Text>
        </View>
      )}

      <View style={styles.codeBanner}>
        <Feather name="users" size={13} color={theme.colors.primary} style={{ marginRight: 6 }} />
        <Text style={styles.codeBannerText}>
          Código para compartir: <Text style={styles.codeBannerCode}>{code}</Text>
        </Text>
      </View>

      {/* Marcador Principal */}
      <View style={styles.scoreboardSection}>
        <View style={styles.scoreRow}>
          <View style={styles.teamScoreCol}>
            <Text style={styles.teamScoreName} numberOfLines={2}>{nameA}</Text>
            <Text style={styles.scoreNumber}>{summary.scoreA}</Text>
          </View>
          <Text style={styles.scoreDash}>-</Text>
          <View style={styles.teamScoreCol}>
            <Text style={styles.teamScoreName} numberOfLines={2}>{nameB}</Text>
            <Text style={styles.scoreNumber}>{summary.scoreB}</Text>
          </View>
        </View>

        <View style={styles.timerSection}>
          <Text style={styles.halfBadge}>
            {activeHalf && clockCurrentlyRunning
              ? `${activeHalf}° Tiempo en juego`
              : activeHalf && !clockCurrentlyRunning
              ? 'Pausado'
              : summary.halfEnded[2]
              ? 'Partido finalizado'
              : summary.halfEnded[1]
              ? 'Entretiempo'
              : 'Por iniciar'}
          </Text>
          <Text style={styles.largeTimerText}>{timerFormatted}</Text>
        </View>

        <View style={styles.halfControls}>
          {!summary.halfStarted[1] && (
            <TouchableOpacity style={styles.halfControlBtn} onPress={() => requestHalfStart(1)}>
              <Feather name="play" size={14} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.halfControlBtnText}>Iniciar partido</Text>
            </TouchableOpacity>
          )}
          {summary.halfStarted[1] && !summary.halfEnded[1] && (
            <TouchableOpacity style={[styles.halfControlBtn, styles.halfControlBtnStop]} onPress={() => requestHalfEnd(1)}>
              <Feather name="square" size={14} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={[styles.halfControlBtnText, { color: '#ffffff' }]}>Terminar 1° tiempo</Text>
            </TouchableOpacity>
          )}
          {summary.halfEnded[1] && !summary.halfStarted[2] && (
            <TouchableOpacity style={styles.halfControlBtn} onPress={() => requestHalfStart(2)}>
              <Feather name="play" size={14} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.halfControlBtnText}>Iniciar 2° tiempo</Text>
            </TouchableOpacity>
          )}
          {summary.halfStarted[2] && !summary.halfEnded[2] && (
            <TouchableOpacity style={[styles.halfControlBtn, styles.halfControlBtnStop]} onPress={() => requestHalfEnd(2)}>
              <Feather name="square" size={14} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={[styles.halfControlBtnText, { color: '#ffffff' }]}>Terminar partido</Text>
            </TouchableOpacity>
          )}
          {canPause && (
            <TouchableOpacity style={[styles.halfControlBtn, styles.halfControlBtnPause]} onPress={requestPause}>
              <Feather name="pause" size={14} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.halfControlBtnText}>Pausar</Text>
            </TouchableOpacity>
          )}
          {canResume && (
            <TouchableOpacity style={styles.halfControlBtn} onPress={requestResume}>
              <Feather name="play" size={14} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.halfControlBtnText}>Reanudar</Text>
            </TouchableOpacity>
          )}
        </View>
        {!clockCurrentlyRunning && activeHalf === null && summary.halfStarted[1] && !summary.halfEnded[2] && (
          <Text style={styles.pausedHint}>El reloj no está corriendo — no se pueden registrar goles, tarjetas ni penales.</Text>
        )}
        {activeHalf !== null && !clockCurrentlyRunning && (
          <Text style={styles.pausedHint}>Partido pausado — no se pueden registrar goles, tarjetas ni penales.</Text>
        )}
      </View>

      {/* Informe arbitral */}
      <TouchableOpacity style={styles.notesBtn} onPress={openNotesModal}>
        <Feather name="file-text" size={14} color={theme.colors.text} style={{ marginRight: 6 }} />
        <Text style={styles.notesBtnText}>{notes ? 'Ver / editar informe' : 'Agregar informe arbitral'}</Text>
      </TouchableOpacity>

      {/* Botonera de Acciones Rápidas */}
      <View style={styles.divider} />
      <Text style={styles.sectionHeader}>Registrar Incidencia</Text>
      <View style={styles.actionsGrid}>
        {(['A', 'B'] as Team[]).map((team) => (
          <View key={team} style={styles.actionsColumn}>
            <Text style={styles.actionsTeamTitle} numberOfLines={1}>{team === 'A' ? nameA : nameB}</Text>
            {([
              ['goal', 'goal', 'Gol'],
              ['penalty', 'penalty_scored', 'Penal'],
              ['yellow_card', 'yellow_card', 'Amarilla'],
              ['red_card', 'red_card', 'Roja'],
            ] as [ActionType, EventBadgeType, string][]).map(([actionType, badgeType, label]) => (
              <TouchableOpacity
                key={actionType}
                style={[styles.actionBtn, !clockCurrentlyRunning && styles.btnDisabled]}
                onPress={() => openActionModal(actionType, team)}
                disabled={!clockCurrentlyRunning}
              >
                <LeagueBadge type={badgeType} size="sm" />
                <Text style={styles.actionBtnLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      {/* Historial de Eventos, cada uno con su X */}
      <View style={styles.divider} />
      <Text style={styles.sectionHeader}>Historial de Eventos</Text>
      {events.filter((e) => e.type !== 'lineup').length === 0 ? (
        <Text style={styles.emptyEventsText}>Aún no se han registrado eventos en este partido.</Text>
      ) : (
        <View style={styles.eventsList}>
          {annotatedEvents.map(({ event: ev, index: idx, relativeMs }) => {
            if (ev.type === 'lineup') return null;

            const clockTime = formatClockTime(ev.at);

            if (ev.type === 'half_start' || ev.type === 'half_end' || ev.type === 'pause' || ev.type === 'resume') {
              const label =
                ev.type === 'half_start' ? `${ev.half}° Tiempo iniciado` :
                ev.type === 'half_end' ? `${ev.half}° Tiempo terminado` :
                ev.type === 'pause' ? 'Partido pausado' : 'Partido reanudado';
              const relativeLabel = relativeMs !== null ? `${Math.floor(relativeMs / 60000)}'` : null;
              return (
                <View key={`ev-${idx}`} style={styles.eventMarkerRow}>
                  <Text style={styles.eventMarkerText}>{label}</Text>
                  <View style={styles.eventTimeCol}>
                    {relativeLabel && <Text style={styles.eventMarkerRelative}>{relativeLabel}</Text>}
                    <Text style={styles.eventClockTime}>{clockTime}</Text>
                  </View>
                  {/* Los eventos de tiempo (inicio/fin/pausa/reanudación) no se pueden
                      eliminar — no tiene sentido borrar un límite del que dependen los
                      demás eventos. */}
                </View>
              );
            }

            const isA = ev.team === 'A';
            const teamName = isA ? nameA : nameB;
            let badgeType: EventBadgeType = 'goal';
            if (ev.type === 'goal') badgeType = ev.ownGoal ? 'own_goal' : 'goal';
            else if (ev.type === 'yellow_card') badgeType = 'yellow_card';
            else if (ev.type === 'red_card') badgeType = 'red_card';
            else if (ev.type === 'penalty') badgeType = ev.scored ? 'penalty_scored' : 'penalty_missed';

            return (
              <View key={`ev-${idx}`} style={styles.eventFeedRow}>
                <View style={styles.eventFeedLeft}>
                  <LeagueBadge type={badgeType} size="sm" />
                  <Text style={styles.eventFeedPlayer}>{ev.player}</Text>
                  <Text style={styles.eventFeedTeam}>({teamName})</Text>
                </View>
                <View style={styles.eventFeedRight}>
                  <View style={styles.eventTimeCol}>
                    {relativeMs !== null && <Text style={styles.eventFeedMinute}>{Math.floor(relativeMs / 60000)}'</Text>}
                    <Text style={styles.eventClockTime}>{clockTime}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteEventAt(idx)} style={styles.eventDeleteBtn}>
                    <Feather name="x" size={13} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Convocatoria */}
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
              <Text style={styles.lineupColTitle} numberOfLines={1}>{teamName} ({lineup.length})</Text>

              <Text style={styles.lineupSubLabel}>Plantel Registrado</Text>
              {registeredMembers.length === 0 ? (
                <Text style={styles.mutedTextSmall}>Sin miembros registrados en el equipo.</Text>
              ) : (
                registeredMembers.map((m) => {
                  const isChecked = lineup.includes(m.name);
                  return (
                    <TouchableOpacity key={m.id} style={styles.checklistRow} onPress={() => toggleMemberLineup(team, m.name)} activeOpacity={0.7}>
                      <View style={[styles.checkboxBox, isChecked && styles.checkboxBoxChecked]}>
                        {isChecked && <Feather name="check" size={11} color="#000000" />}
                      </View>
                      <Text style={[styles.checklistName, isChecked && styles.checklistNameChecked]} numberOfLines={1}>{m.name}</Text>
                    </TouchableOpacity>
                  );
                })
              )}

              <Text style={[styles.lineupSubLabel, { marginTop: 12 }]}>Agregados a mano ({manualList.length})</Text>
              {manualList.length === 0 ? (
                <Text style={styles.mutedTextSmall}>Ninguno</Text>
              ) : (
                manualList.map((player) => (
                  <View key={player} style={styles.manualPlayerRow}>
                    <Text style={styles.manualPlayerName} numberOfLines={1}>{player}</Text>
                    <TouchableOpacity onPress={() => removeManualPlayer(team, player)} style={styles.removePlayerBtn}>
                      <Feather name="x" size={13} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))
              )}

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

      {/* Envío final — solo se puede finalizar habiendo terminado el 2do tiempo */}
      <View style={styles.divider} />
      <TouchableOpacity
        style={[styles.submitMainBtn, (submitting || !summary.halfEnded[2]) && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting || !summary.halfEnded[2]}
      >
        <Text style={styles.submitMainBtnText}>{submitting ? 'Finalizando...' : 'Finalizar Partido'}</Text>
      </TouchableOpacity>
      {!summary.halfEnded[2] && (
        <Text style={[styles.mutedTextSmall, { textAlign: 'center', marginTop: 6 }]}>
          Hay que terminar el 2do tiempo para poder finalizar el partido.
        </Text>
      )}

      {/* Modal de Acción (Gol, Penal, Tarjetas) */}
      <Modal visible={!!pendingAction} transparent animationType="fade" onRequestClose={closeActionModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
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
              <Text style={styles.modalSubTitle}>{pendingAction?.team === 'A' ? nameA : nameB}</Text>
            </View>

            {pendingAction?.type === 'goal' && (
              <View style={styles.modalSwitchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>¿Fue autogol / gol en contra?</Text>
                  <Text style={styles.switchSubLabel}>{ownGoalToggle ? 'Se listan jugadores del rival' : 'Se listan jugadores del equipo'}</Text>
                </View>
                <Switch
                  value={ownGoalToggle}
                  onValueChange={(val) => { setOwnGoalToggle(val); setSelectedPlayer(''); }}
                  trackColor={{ false: '#222222', true: theme.colors.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            )}

            {pendingAction?.type === 'penalty' && (
              <View style={styles.penaltyToggleRow}>
                <TouchableOpacity style={[styles.penaltyOptionBtn, penaltyScoredToggle && styles.penaltyOptionBtnActive]} onPress={() => setPenaltyScoredToggle(true)}>
                  <LeagueBadge type="penalty_scored" size="sm" />
                  <Text style={[styles.penaltyOptionText, penaltyScoredToggle && styles.penaltyOptionTextActive]}>Anotado</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.penaltyOptionBtn, !penaltyScoredToggle && styles.penaltyOptionBtnActive]} onPress={() => setPenaltyScoredToggle(false)}>
                  <LeagueBadge type="penalty_missed" size="sm" />
                  <Text style={[styles.penaltyOptionText, !penaltyScoredToggle && styles.penaltyOptionTextActive]}>Fallado</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.modalPlayerListLabel}>Selecciona el jugador convocado:</Text>
            <ScrollView style={styles.modalPlayerScroll} contentContainerStyle={styles.modalPlayerScrollContent}>
              {modalEligiblePlayers.length === 0 ? (
                <View style={styles.modalEmptyBox}>
                  <Text style={styles.modalEmptyText}>No hay jugadores convocados en este equipo. Debes convocarlos primero.</Text>
                </View>
              ) : (
                modalEligiblePlayers.map((p) => {
                  const isSelected = selectedPlayer === p;
                  return (
                    <TouchableOpacity key={p} style={[styles.modalPlayerItem, isSelected && styles.modalPlayerItemSelected]} onPress={() => setSelectedPlayer(p)} activeOpacity={0.7}>
                      <Text style={[styles.modalPlayerItemText, isSelected && styles.modalPlayerItemTextSelected]}>{p}</Text>
                      {isSelected && <Feather name="check" size={14} color="#000000" />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeActionModal}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, !selectedPlayer && styles.btnDisabled]} onPress={confirmActionModal} disabled={!selectedPlayer}>
                <Text style={styles.modalConfirmBtnText}>Registrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal genérico de confirmación */}
      <Modal visible={!!confirmModal} transparent animationType="fade" onRequestClose={() => setConfirmModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmModalContainer}>
            <Text style={styles.modalTitle}>{confirmModal?.title}</Text>
            <Text style={styles.confirmModalMessage}>{confirmModal?.message}</Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmModal(null)} disabled={confirming}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, confirmModal?.danger && styles.modalConfirmBtnDanger, confirming && styles.btnDisabled]}
                onPress={runConfirm}
                disabled={confirming}
              >
                <Text style={styles.modalConfirmBtnText}>{confirming ? '...' : confirmModal?.confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal del informe arbitral */}
      <Modal visible={showNotesModal} transparent animationType="fade" onRequestClose={() => setShowNotesModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmModalContainer}>
            <Text style={styles.modalTitle}>Informe arbitral</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Observaciones del partido..."
              placeholderTextColor={theme.colors.textMuted}
              value={notesDraft}
              onChangeText={setNotesDraft}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowNotesModal(false)} disabled={savingNotes}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, savingNotes && styles.btnDisabled]} onPress={saveNotes} disabled={savingNotes}>
                <Text style={styles.modalConfirmBtnText}>{savingNotes ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 60 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, padding: theme.spacing.lg },
  mutedText: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center' },
  mutedTextSmall: { color: theme.colors.textMuted, fontSize: 11, fontStyle: 'italic', paddingVertical: 4 },
  syncWarning: { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: theme.colors.danger, borderRadius: 4, padding: theme.spacing.sm, marginBottom: theme.spacing.sm },
  syncWarningText: { color: theme.colors.text, fontSize: 12 },
  codeBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(56,189,248,0.1)', borderWidth: 1, borderColor: theme.colors.primary, borderRadius: 8, paddingVertical: 8, marginBottom: theme.spacing.sm },
  codeBannerText: { color: theme.colors.textMuted, fontSize: 12 },
  codeBannerCode: { color: theme.colors.primary, fontWeight: '800', letterSpacing: 2 },
  codeInput: { width: '100%', maxWidth: 220, backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 14, color: theme.colors.text, fontSize: 24, fontWeight: '800', letterSpacing: 6, textAlign: 'center', marginVertical: theme.spacing.lg },
  divider: { height: 1, backgroundColor: '#1e1e1e', marginVertical: theme.spacing.md },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  scoreboardSection: { alignItems: 'center', paddingVertical: theme.spacing.sm },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 10 },
  teamScoreCol: { flex: 1, alignItems: 'center' },
  teamScoreName: { color: '#cccccc', fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  scoreNumber: { color: '#ffffff', fontSize: 42, fontWeight: '800' },
  scoreDash: { color: '#666666', fontSize: 28, fontWeight: '700', marginHorizontal: 12 },
  timerSection: { alignItems: 'center', marginBottom: 12 },
  halfBadge: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  largeTimerText: { color: theme.colors.primary, fontSize: 32, fontWeight: '800' },
  halfControls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  halfControlBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  halfControlBtnText: { color: '#000000', fontSize: 12, fontWeight: '700' },
  halfControlBtnStop: { backgroundColor: theme.colors.danger },
  halfControlBtnPause: { backgroundColor: '#f59e0b' },
  pausedHint: { color: theme.colors.danger, fontSize: 11, textAlign: 'center', marginTop: 8 },
  notesBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingVertical: 10, marginTop: theme.spacing.md },
  notesBtnText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', gap: theme.spacing.md },
  actionsColumn: { flex: 1, gap: 6 },
  actionsTeamTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingVertical: 10 },
  actionBtnLabel: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  emptyEventsText: { color: theme.colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  eventsList: { gap: 2 },
  eventMarkerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.cardBg, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, marginVertical: 3 },
  eventMarkerText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  eventMarkerRelative: { color: theme.colors.primary, fontSize: 12, fontWeight: '800' },
  eventFeedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
  eventFeedLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  eventFeedRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventFeedPlayer: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  eventFeedTeam: { color: theme.colors.textMuted, fontSize: 11 },
  // El minuto relativo al tiempo es lo que de verdad importa en la cancha — se ve
  // claro; la hora normal (formatClockTime) es solo referencia, se ve sutil, debajo.
  eventTimeCol: { alignItems: 'flex-end' },
  eventFeedMinute: { color: theme.colors.primary, fontSize: 13, fontWeight: '800' },
  eventClockTime: { color: theme.colors.textMuted, fontSize: 9 },
  eventDeleteBtn: { padding: 6 },
  lineupRow: { flexDirection: 'row', gap: theme.spacing.md },
  lineupCol: { flex: 1 },
  lineupColTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  lineupSubLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  checkboxBox: { width: 16, height: 16, borderRadius: 3, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxBoxChecked: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  checklistName: { color: theme.colors.textMuted, fontSize: 13, flex: 1 },
  checklistNameChecked: { color: theme.colors.text, fontWeight: '600' },
  manualPlayerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  manualPlayerName: { color: theme.colors.text, fontSize: 13, flex: 1 },
  removePlayerBtn: { padding: 4 },
  manualInputRow: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' },
  manualTextInput: { flex: 1, backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: theme.colors.text, fontSize: 13 },
  addManualBtn: { backgroundColor: theme.colors.primary, borderRadius: 6, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  submitMainBtn: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  submitMainBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
  modalContainer: { width: '100%', maxWidth: 420, maxHeight: '85%', backgroundColor: theme.colors.cardBg, borderRadius: 14, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border },
  confirmModalContainer: { width: '100%', maxWidth: 380, backgroundColor: theme.colors.cardBg, borderRadius: 14, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border },
  modalHeader: { marginBottom: theme.spacing.md },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '800' },
  modalSubTitle: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  confirmModalMessage: { color: theme.colors.textMuted, fontSize: 13, marginTop: 8, marginBottom: theme.spacing.md, lineHeight: 18 },
  modalSwitchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: 8, padding: 10, marginBottom: 12 },
  switchLabel: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  switchSubLabel: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  penaltyToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  penaltyOptionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingVertical: 10 },
  penaltyOptionBtnActive: { borderColor: theme.colors.primary, backgroundColor: 'rgba(56,189,248,0.1)' },
  penaltyOptionText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  penaltyOptionTextActive: { color: theme.colors.primary },
  modalPlayerListLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  modalPlayerScroll: { maxHeight: 220 },
  modalPlayerScrollContent: { gap: 4 },
  modalEmptyBox: { padding: theme.spacing.md },
  modalEmptyText: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center' },
  modalPlayerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 4 },
  modalPlayerItemSelected: { borderColor: theme.colors.primary, backgroundColor: 'rgba(56,189,248,0.1)' },
  modalPlayerItemText: { color: theme.colors.text, fontSize: 14 },
  modalPlayerItemTextSelected: { fontWeight: '700' },
  modalButtonsRow: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md },
  modalCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  modalCancelBtnText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  modalConfirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8, backgroundColor: theme.colors.primary },
  modalConfirmBtnDanger: { backgroundColor: theme.colors.danger },
  modalConfirmBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  notesInput: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 12, color: theme.colors.text, fontSize: 14, minHeight: 140 },
});
