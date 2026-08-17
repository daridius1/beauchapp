import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { RootStackParamList } from '../types/navigation';
import { MatchEvent, Team, summarizeEvents } from '../utils/matchEvents';

type Props = NativeStackScreenProps<RootStackParamList, 'LeagueMatchArbitrator'>;

const storageKey = (matchId: string, userId: string) => `arbitration_events_${matchId}_${userId}`;

type PendingAction = { type: 'goal' | 'yellow_card' | 'red_card' | 'penalty'; team: Team } | null;
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
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [playerInput, setPlayerInput] = useState('');
  const [ownGoalToggle, setOwnGoalToggle] = useState(false);
  const [scoredToggle, setScoredToggle] = useState(true);
  const [lineupInputA, setLineupInputA] = useState('');
  const [lineupInputB, setLineupInputB] = useState('');
  const [now, setNow] = useState(Date.now());
  const [membersA, setMembersA] = useState<{ id: string; name: string }[]>([]);
  const [membersB, setMembersB] = useState<{ id: string; name: string }[]>([]);

  const eventsRef = useRef<MatchEvent[]>([]);
  eventsRef.current = events;

  // Solo redibuja el cronómetro en vivo — el tiempo real se recalcula siempre desde el
  // timestamp del último "half_start" en `events`, nunca se guarda un contador aparte.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      const record = await pb.collection('league_matches').getOne(matchId, { expand: 'teamA,teamB' });
      setMatch(record);

      // Integrantes de cada equipo — se ofrecen como sugerencia lista para agregar a
      // la convocatoria, pero no reemplazan el texto libre (un equipo puede convocar a
      // alguien sin cuenta en la app).
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

      // El informe es SIEMPRE el propio (match+referee=yo) — cualquier otra persona
      // puede tener el suyo en paralelo para el mismo partido, sin pisarse.
      let report: any = null;
      if (user) {
        try {
          report = await pb.collection('match_reports').getFirstListItem(
            `match = "${matchId}" && referee = "${user.id}"`
          );
        } catch (err) {
          report = null; // todavía no existe — se crea solo al guardar el primer evento
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
      // El arreglo es siempre append-only en el uso normal (un solo dispositivo
      // arbitrando) — el más largo es, por construcción, superset del más corto. Si
      // el local es más largo, hay cambios sin sincronizar; se reintenta enviar abajo.
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

  // Toda acción pasa por acá: se guarda local ANTES de intentar el servidor (si la app
  // se cierra justo después, no se pierde nada), y siempre se manda el arreglo COMPLETO
  // (no un delta) — así cualquier envío fallido anterior se corrige solo en el próximo.
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

  const openAction = (type: 'goal' | 'yellow_card' | 'red_card' | 'penalty', team: Team) => {
    setPendingAction({ type, team });
    setPlayerInput('');
    setOwnGoalToggle(false);
    setScoredToggle(true);
  };

  const confirmAction = async () => {
    if (!pendingAction || !playerInput.trim()) return;
    const at = new Date().toISOString();
    const player = playerInput.trim();
    if (pendingAction.type === 'goal') {
      await pushEvent({ type: 'goal', team: pendingAction.team, player, ownGoal: ownGoalToggle, at });
    } else if (pendingAction.type === 'yellow_card') {
      await pushEvent({ type: 'yellow_card', team: pendingAction.team, player, at });
    } else if (pendingAction.type === 'red_card') {
      await pushEvent({ type: 'red_card', team: pendingAction.team, player, at });
    } else if (pendingAction.type === 'penalty') {
      await pushEvent({ type: 'penalty', team: pendingAction.team, player, scored: scoredToggle, at });
    }
    setPendingAction(null);
  };

  const addLineupPlayer = async (team: Team, nameOverride?: string) => {
    const input = team === 'A' ? lineupInputA : lineupInputB;
    const name = (nameOverride ?? input).trim();
    if (!name) return;
    const currentLineup = team === 'A' ? summary.lineupA : summary.lineupB;
    if (currentLineup.includes(name)) return;
    await pushEvent({ type: 'lineup', team, players: [...currentLineup, name], at: new Date().toISOString() });
    if (!nameOverride) {
      if (team === 'A') setLineupInputA(''); else setLineupInputB('');
    }
  };

  const removeLineupPlayer = async (team: Team, name: string) => {
    const currentLineup = team === 'A' ? summary.lineupA : summary.lineupB;
    await pushEvent({ type: 'lineup', team, players: currentLineup.filter((p) => p !== name), at: new Date().toISOString() });
  };

  const toggleHalf = async (half: 1 | 2, action: 'half_start' | 'half_end') => {
    await pushEvent({ type: action, half, at: new Date().toISOString() });
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

  const nameA = match.expand?.teamA?.name || 'Equipo A';
  const nameB = match.expand?.teamB?.name || 'Equipo B';

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
            : 'Este partido ya tiene un resultado oficial (de otro informe).'}
        </Text>
      </View>
    );
  }

  if (reportStatus === 'submitted') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.scoreText}>
          {nameA} {summary.scoreA} - {summary.scoreB} {nameB}
        </Text>
        <Text style={[styles.mutedText, { marginTop: theme.spacing.md }]}>
          Ya enviaste tu informe de este partido. Está esperando la aprobación del administrador de la liga —
          otras personas también pueden haber enviado el suyo, solo uno se hace oficial.
        </Text>
      </View>
    );
  }

  const activeHalfStart = [...events].reverse().find((ev) => ev.type === 'half_start') as any;
  const activeHalfEndedAfter = activeHalfStart
    ? events.some((ev, i) => ev.type === 'half_end' && (ev as any).half === activeHalfStart.half && events.indexOf(activeHalfStart) < i)
    : false;
  const liveElapsedMs = activeHalfStart && !activeHalfEndedAfter ? now - new Date(activeHalfStart.at).getTime() : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!synced && (
        <View style={styles.syncWarning}>
          <Text style={styles.syncWarningText}>⚠ Sin sincronizar con el servidor — se reintenta con la próxima acción. Los datos están seguros en este celular.</Text>
        </View>
      )}

      <Text style={styles.scoreText}>
        {nameA} {summary.scoreA} - {summary.scoreB} {nameB}
      </Text>
      <Text style={styles.cardsText}>
        🟨 {summary.cardsA.yellow} / {summary.cardsB.yellow} · 🟥 {summary.cardsA.red} / {summary.cardsB.red}
      </Text>

      <View style={styles.halfControls}>
        {!summary.halfStarted[1] && (
          <TouchableOpacity style={styles.halfBtn} onPress={() => toggleHalf(1, 'half_start')}>
            <Text style={styles.halfBtnText}>Iniciar 1er tiempo</Text>
          </TouchableOpacity>
        )}
        {summary.halfStarted[1] && !summary.halfEnded[1] && (
          <TouchableOpacity style={styles.halfBtn} onPress={() => toggleHalf(1, 'half_end')}>
            <Text style={styles.halfBtnText}>Terminar 1er tiempo</Text>
          </TouchableOpacity>
        )}
        {summary.halfEnded[1] && !summary.halfStarted[2] && (
          <TouchableOpacity style={styles.halfBtn} onPress={() => toggleHalf(2, 'half_start')}>
            <Text style={styles.halfBtnText}>Iniciar 2do tiempo</Text>
          </TouchableOpacity>
        )}
        {summary.halfStarted[2] && !summary.halfEnded[2] && (
          <TouchableOpacity style={styles.halfBtn} onPress={() => toggleHalf(2, 'half_end')}>
            <Text style={styles.halfBtnText}>Terminar 2do tiempo</Text>
          </TouchableOpacity>
        )}
      </View>
      {liveElapsedMs !== null && (
        <Text style={styles.timerText}>
          {activeHalfStart.half}er tiempo · {Math.floor(liveElapsedMs / 60000)}:{String(Math.floor((liveElapsedMs / 1000) % 60)).padStart(2, '0')}
        </Text>
      )}

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Convocatoria</Text>
      <View style={styles.lineupRow}>
        {(['A', 'B'] as Team[]).map((team) => {
          const lineup = team === 'A' ? summary.lineupA : summary.lineupB;
          const members = team === 'A' ? membersA : membersB;
          const suggestions = members.filter((m) => !lineup.includes(m.name));
          return (
            <View key={team} style={styles.lineupCol}>
              <Text style={styles.lineupTeamName}>{team === 'A' ? nameA : nameB}</Text>
              {lineup.map((p) => (
                <TouchableOpacity key={p} style={styles.lineupPlayerRow} onPress={() => removeLineupPlayer(team, p)}>
                  <Text style={styles.lineupPlayerText}>{p} ✕</Text>
                </TouchableOpacity>
              ))}

              {suggestions.length > 0 && (
                <>
                  <Text style={styles.lineupSuggestLabel}>Integrantes del equipo</Text>
                  {suggestions.map((m) => (
                    <TouchableOpacity key={m.id} style={styles.lineupSuggestRow} onPress={() => addLineupPlayer(team, m.name)}>
                      <Text style={styles.lineupSuggestText}>+ {m.name}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              <View style={styles.lineupInputRow}>
                <TextInput
                  style={styles.lineupInput}
                  placeholder="Otro nombre"
                  placeholderTextColor={theme.colors.textMuted}
                  value={team === 'A' ? lineupInputA : lineupInputB}
                  onChangeText={team === 'A' ? setLineupInputA : setLineupInputB}
                  onSubmitEditing={() => addLineupPlayer(team)}
                />
                <TouchableOpacity style={styles.lineupAddBtn} onPress={() => addLineupPlayer(team)}>
                  <Text style={styles.lineupAddBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Acciones</Text>
      <View style={styles.actionsRow}>
        {(['A', 'B'] as Team[]).map((team) => (
          <View key={team} style={styles.actionsCol}>
            <Text style={styles.lineupTeamName}>{team === 'A' ? nameA : nameB}</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openAction('goal', team)}>
              <Text style={styles.actionBtnText}>⚽ Gol</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openAction('penalty', team)}>
              <Text style={styles.actionBtnText}>🎯 Penal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openAction('yellow_card', team)}>
              <Text style={styles.actionBtnText}>🟨 Amarilla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openAction('red_card', team)}>
              <Text style={styles.actionBtnText}>🟥 Roja</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {pendingAction && (
        <View style={styles.actionForm}>
          <Text style={styles.actionFormTitle}>
            {pendingAction.type === 'goal' && 'Gol'}
            {pendingAction.type === 'yellow_card' && 'Tarjeta amarilla'}
            {pendingAction.type === 'red_card' && 'Tarjeta roja'}
            {pendingAction.type === 'penalty' && 'Penal'}
            {' — '}
            {pendingAction.team === 'A' ? nameA : nameB}
          </Text>
          {(() => {
            const teamLineup = pendingAction.team === 'A' ? summary.lineupA : summary.lineupB;
            if (teamLineup.length === 0) {
              return (
                <Text style={styles.mutedText}>
                  No hay nadie convocado en este equipo todavía. Agrega jugadores a la convocatoria arriba primero.
                </Text>
              );
            }
            return (
              <View style={styles.playerPicker}>
                {teamLineup.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.playerChip, playerInput === p && styles.playerChipSelected]}
                    onPress={() => setPlayerInput(p)}
                  >
                    <Text style={[styles.playerChipText, playerInput === p && styles.playerChipTextSelected]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}
          {pendingAction.type === 'goal' && (
            <TouchableOpacity style={styles.toggleRow} onPress={() => setOwnGoalToggle((v) => !v)}>
              <View style={[styles.checkbox, ownGoalToggle && styles.checkboxChecked]} />
              <Text style={styles.toggleLabel}>Fue autogol (jugador de este equipo, a favor del rival)</Text>
            </TouchableOpacity>
          )}
          {pendingAction.type === 'penalty' && (
            <TouchableOpacity style={styles.toggleRow} onPress={() => setScoredToggle((v) => !v)}>
              <View style={[styles.checkbox, scoredToggle && styles.checkboxChecked]} />
              <Text style={styles.toggleLabel}>Fue gol</Text>
            </TouchableOpacity>
          )}
          <View style={styles.actionFormButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPendingAction(null)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, !playerInput.trim() && styles.saveBtnDisabled]} onPress={confirmAction} disabled={!playerInput.trim()}>
              <Text style={styles.confirmBtnText}>Agregar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={[styles.undoBtn, events.length === 0 && styles.saveBtnDisabled]} onPress={undoLast} disabled={events.length === 0}>
        <Text style={styles.undoBtnText}>Deshacer última acción</Text>
      </TouchableOpacity>

      <View style={styles.divider} />
      <TouchableOpacity style={[styles.submitBtn, submitting && styles.saveBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.submitBtnText}>{submitting ? 'Enviando...' : 'Finalizar y enviar a revisión'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 60 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, padding: theme.spacing.lg },
  mutedText: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center' },
  syncWarning: { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: theme.colors.danger, borderRadius: 8, padding: theme.spacing.sm, marginBottom: theme.spacing.sm },
  syncWarningText: { color: theme.colors.text, fontSize: 12 },
  scoreText: { color: theme.colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  cardsText: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 },
  halfControls: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: theme.spacing.md, flexWrap: 'wrap' },
  halfBtn: { backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  halfBtnText: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },
  timerText: { color: theme.colors.primary, fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.lg },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: theme.spacing.sm },
  lineupRow: { flexDirection: 'row', gap: theme.spacing.md },
  lineupCol: { flex: 1 },
  lineupTeamName: { color: theme.colors.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  lineupPlayerRow: { paddingVertical: 4 },
  lineupPlayerText: { color: theme.colors.textMuted, fontSize: 13 },
  lineupInputRow: { flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' },
  lineupInput: { flex: 1, backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: theme.colors.text, fontSize: 13 },
  lineupAddBtn: { backgroundColor: theme.colors.primary, borderRadius: 6, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  lineupAddBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  lineupSuggestLabel: { color: theme.colors.textMuted, fontSize: 10, marginTop: 8, marginBottom: 2, textTransform: 'uppercase' },
  lineupSuggestRow: { paddingVertical: 4 },
  lineupSuggestText: { color: theme.colors.primary, fontSize: 13 },
  playerPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  playerChip: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  playerChipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  playerChipText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  playerChipTextSelected: { color: '#000' },
  actionsRow: { flexDirection: 'row', gap: theme.spacing.md },
  actionsCol: { flex: 1, gap: 6 },
  actionBtn: { backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  actionForm: { backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: theme.spacing.md, marginTop: theme.spacing.md },
  actionFormTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  actionFormInput: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, color: theme.colors.text, fontSize: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: theme.colors.border },
  checkboxChecked: { backgroundColor: theme.colors.primary },
  toggleLabel: { color: theme.colors.textMuted, fontSize: 12, flex: 1 },
  actionFormButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  cancelBtnText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  confirmBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: theme.colors.primary },
  confirmBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  undoBtn: { marginTop: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.danger, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  undoBtnText: { color: theme.colors.danger, fontSize: 13, fontWeight: '700' },
  submitBtn: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  saveBtnDisabled: { opacity: 0.4 },
});
