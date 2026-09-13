import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { LeagueMatch, MatchReport } from '../types/league';
import { Team, LineupEntry, MatchEvent, newEventId, rosterToLineupEntries, visibleEvents } from '../utils/matchEvents';
import { leagueService } from '../services/leagueService';
import { teamPlayersService, TeamPlayerRecord } from '../services/teamPlayersService';
import { matchDisplayName } from '../components/leagues/TeamCrest';
import { LeagueBadge, EventBadgeType } from '../components/leagues/LeagueBadge';
import { PlayerAvatar } from '../components/PlayerAvatar';

type Props = NativeStackScreenProps<RootStackParamList, 'LeagueMatchTeamResult'>;

// Este formulario es deliberadamente el mismo, simplificado, que usa la liga por link
// (GET /registrar-resultado en match_result.pb.js): solo goles y tarjetas, sin minuto ni
// convocatoria, y sin la casilla de "autogol" — un gol se agrega directo en la sección
// del equipo que lo anotó, con o sin jugador (ver comentario de cabecera de ese archivo).
// La diferencia con el link es solo CÓMO se autoriza: acá es la propia sesión del equipo
// asignado a arbitrar (league_matches.refereeTeams), no un token de un solo uso.
type RowType = 'goal' | 'yellow_card' | 'red_card';
interface ResultRow {
  rowId: string;
  team: Team;
  type: RowType;
  player: LineupEntry | null;
}

const BLANK_PLAYER: LineupEntry = { playerId: null, name: 'Sin jugador', photo: null };
const ROW_BADGE: Record<RowType, EventBadgeType> = { goal: 'goal', yellow_card: 'yellow_card', red_card: 'red_card' };
const ROW_LABEL: Record<RowType, string> = { goal: 'Gol', yellow_card: 'Amarilla', red_card: 'Roja' };

export const LeagueMatchTeamResultScreen: React.FC<Props> = ({ route, navigation }) => {
  const { matchId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<LeagueMatch | null>(null);
  const [rosterA, setRosterA] = useState<TeamPlayerRecord[]>([]);
  const [rosterB, setRosterB] = useState<TeamPlayerRecord[]>([]);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const [pendingRow, setPendingRow] = useState<{ team: Team; type: RowType } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<LineupEntry | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      let matchRecord: LeagueMatch | null = null;
      let report: MatchReport | null = null;
      try {
        [matchRecord, report] = await Promise.all([
          leagueService.getMatch(matchId, 'teamA,teamB'),
          leagueService.findReportForMatch(matchId),
        ]);
      } catch (err) {
        console.error('Error cargando el partido:', err);
      }

      if (!matchRecord) {
        setMatch(null);
        return;
      }
      setMatch(matchRecord);

      const [realRosterA, realRosterB] = await Promise.all([
        teamPlayersService.listTeamPlayers(matchRecord.teamA),
        teamPlayersService.listTeamPlayers(matchRecord.teamB),
      ]);
      setRosterA(realRosterA);
      setRosterB(realRosterB);

      // Precarga desde el informe ya guardado (recargar la pantalla, o corregir un
      // partido ya 'played') — mismo criterio que MATCH.existingEvents en
      // /registrar-resultado: un gol viejo con ownGoal:true se recoloca en la sección
      // del equipo que se benefició, sin jugador (era del OTRO equipo).
      const existingEvents = visibleEvents(report?.events);
      const preloadedRows: ResultRow[] = [];
      existingEvents.forEach((ev) => {
        // id existente preservado (no uno nuevo) — mismo criterio que `preset.id` en
        // /registrar-resultado: sin merge de por medio acá (este endpoint sobrescribe
        // entero), pero no hay motivo para descartar la identidad original del evento.
        if (ev.type === 'goal') {
          const scoringTeam: Team = ev.ownGoal ? (ev.team === 'A' ? 'B' : 'A') : ev.team;
          const player = ev.playerId || ev.player ? { playerId: ev.playerId || null, name: ev.player || 'Sin jugador', photo: null } : null;
          preloadedRows.push({ rowId: ev.id || newEventId(), team: scoringTeam, type: 'goal', player });
        } else if (ev.type === 'yellow_card' || ev.type === 'red_card') {
          const player = ev.playerId || ev.player ? { playerId: ev.playerId || null, name: ev.player || 'Sin jugador', photo: null } : null;
          preloadedRows.push({ rowId: ev.id || newEventId(), team: ev.team, type: ev.type, player });
        }
      });
      setRows(preloadedRows);
      setNotes(report?.notes || '');
    } catch (err) {
      console.error('Error cargando datos para cargar resultado:', err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const isAuthorized = !!user && !!match?.refereeTeams?.includes(user.id);
  // El primer resultado se puede cargar mientras está confirmed. Una vez played, los
  // dos equipos árbitro quedan bloqueados hasta que la liga abra UNA corrección.
  const canSubmit = !!match && (match.status === 'confirmed' || (match.status === 'played' && match.refereeResultReopen));

  const teamAName = matchDisplayName(match?.expand?.teamA, 'Equipo A');
  const teamBName = matchDisplayName(match?.expand?.teamB, 'Equipo B');

  const rosterEntries = (team: Team): LineupEntry[] => rosterToLineupEntries(team === 'A' ? rosterA : rosterB);

  const openAddRow = (team: Team, type: RowType) => {
    setSelectedPlayer(null);
    setPendingRow({ team, type });
  };

  const confirmAddRow = () => {
    if (!pendingRow || !selectedPlayer) return;
    const player = selectedPlayer === BLANK_PLAYER ? null : selectedPlayer;
    setRows((prev) => [...prev, { rowId: newEventId(), team: pendingRow.team, type: pendingRow.type, player }]);
    setPendingRow(null);
    setSelectedPlayer(null);
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const scoreA = rows.filter((r) => r.team === 'A' && r.type === 'goal').length;
  const scoreB = rows.filter((r) => r.team === 'B' && r.type === 'goal').length;

  const handleSubmit = async () => {
    if (submitting) return;
    setConfirmingSubmit(false);
    setSubmitting(true);
    try {
      const events: MatchEvent[] = rows.map((r) => {
        const base = { id: r.rowId, team: r.team, player: r.player?.name || undefined, playerId: r.player?.playerId || undefined };
        if (r.type === 'goal') return { ...base, type: 'goal', ownGoal: false };
        return { ...base, type: r.type };
      });
      const result = await leagueService.submitTeamResult(matchId, events, notes);
      Toast.show({ type: 'success', text1: 'Resultado guardado', text2: `${result.scoreA} - ${result.scoreB}` });
      // La pantalla también se abre desde el deep link /partidos/:matchId/resultado.
      // Ahí no necesariamente hay historial al cual volver, así que el resultado no
      // debe dejar al equipo atrapado en este formulario ya enviado.
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('LeagueMatchDetail', { matchId });
    } catch (err: any) {
      console.error('Error guardando resultado como equipo árbitro:', err);
      Toast.show({ type: 'error', text1: 'No se pudo guardar', text2: err?.data?.error || err?.message || '' });
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
        <Text style={styles.emptyTitle}>Partido no encontrado</Text>
      </View>
    );
  }

  if (!isAuthorized || !canSubmit) {
    return (
      <View style={styles.centerContainer}>
        <Feather name="alert-triangle" size={24} color={theme.colors.textMuted} style={{ marginBottom: 10 }} />
        <Text style={styles.emptyTitle}>No puedes cargar este resultado</Text>
        <Text style={styles.emptySub}>
          {!isAuthorized
            ? 'Tu equipo no está asignado a arbitrar este partido.'
            : 'El resultado ya está bloqueado. La liga debe habilitar una corrección para poder modificarlo.'}
        </Text>
      </View>
    );
  }

  const eligiblePlayers = pendingRow ? rosterEntries(pendingRow.team) : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Registra el resultado de este partido. Solo se cargan goles y tarjetas — sin minuto y sin autogol: un gol sin
        jugador cuenta igual para el equipo de esa sección.
      </Text>

      <View style={styles.scoreboardCard}>
        <View style={styles.scoreRow}>
          <Text style={styles.teamScoreName} numberOfLines={2}>{teamAName}</Text>
          <Text style={styles.scoreNumber}>{scoreA}</Text>
          <Text style={styles.scoreDash}>-</Text>
          <Text style={styles.scoreNumber}>{scoreB}</Text>
          <Text style={styles.teamScoreName} numberOfLines={2}>{teamBName}</Text>
        </View>
      </View>

      {(['A', 'B'] as Team[]).map((team) => (
        <View key={team} style={styles.teamCard}>
          <Text style={styles.teamCardTitle}>{team === 'A' ? teamAName : teamBName}</Text>

          {rows.filter((r) => r.team === team).length === 0 ? (
            <Text style={styles.emptyRowsText}>Sin goles ni tarjetas.</Text>
          ) : (
            rows
              .filter((r) => r.team === team)
              .map((r) => (
                <View key={r.rowId} style={styles.eventRow}>
                  <LeagueBadge type={ROW_BADGE[r.type]} size="sm" />
                  <Text style={[styles.eventRowPlayer, !r.player && styles.eventRowPlayerBlank]} numberOfLines={1}>
                    {r.player?.name || 'Sin jugador'}
                  </Text>
                  <TouchableOpacity onPress={() => removeRow(r.rowId)} style={styles.eventDeleteBtn}>
                    <Feather name="x" size={14} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
          )}

          <View style={styles.rowButtons}>
            <TouchableOpacity style={styles.addBtn} onPress={() => openAddRow(team, 'goal')}>
              <Text style={styles.addBtnText}>+ Agregar gol</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => openAddRow(team, 'yellow_card')}>
              <Text style={styles.addBtnText}>+ Amarilla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => openAddRow(team, 'red_card')}>
              <Text style={styles.addBtnText}>+ Roja</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.teamCard}>
        <Text style={styles.teamCardTitle}>Notas (opcional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Incidencias, observaciones, etc."
          placeholderTextColor={theme.colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.btnDisabled]}
        onPress={() => setConfirmingSubmit(true)}
        disabled={submitting}
      >
        <Text style={styles.submitBtnText}>{submitting ? 'Guardando...' : 'Guardar resultado'}</Text>
      </TouchableOpacity>

      <Modal visible={!!pendingRow} transparent animationType="fade" onRequestClose={() => setPendingRow(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalTitleRow}>
              {pendingRow && <LeagueBadge type={ROW_BADGE[pendingRow.type]} size="md" />}
              <Text style={styles.modalTitle}>{pendingRow ? ROW_LABEL[pendingRow.type] : ''}</Text>
            </View>
            <Text style={styles.modalSubTitle}>{pendingRow?.team === 'A' ? teamAName : teamBName}</Text>

            <Text style={styles.modalPlayerListLabel}>Selecciona el jugador (o déjalo en blanco):</Text>
            <ScrollView style={styles.modalPlayerScroll} contentContainerStyle={styles.modalPlayerScrollContent}>
              <TouchableOpacity
                style={[styles.modalPlayerItem, selectedPlayer === BLANK_PLAYER && styles.modalPlayerItemSelected]}
                onPress={() => setSelectedPlayer(BLANK_PLAYER)}
                activeOpacity={0.7}
              >
                <View style={styles.modalPlayerItemLeft}>
                  <Feather name="user-x" size={18} color={theme.colors.textMuted} />
                  <Text style={[styles.modalPlayerItemText, selectedPlayer === BLANK_PLAYER && styles.modalPlayerItemTextSelected]}>
                    Sin jugador
                  </Text>
                </View>
                {selectedPlayer === BLANK_PLAYER && <Feather name="check" size={14} color="#000000" />}
              </TouchableOpacity>

              {eligiblePlayers.length === 0 ? (
                <View style={styles.modalEmptyBox}>
                  <Text style={styles.modalEmptyText}>Este equipo todavía no agregó jugadores a su plantel.</Text>
                </View>
              ) : (
                eligiblePlayers.map((p, idx) => {
                  const isSelected =
                    selectedPlayer !== BLANK_PLAYER &&
                    (selectedPlayer?.playerId ? selectedPlayer.playerId === p.playerId : selectedPlayer?.name === p.name);
                  return (
                    <TouchableOpacity
                      key={p.playerId || `${p.name}-${idx}`}
                      style={[styles.modalPlayerItem, isSelected && styles.modalPlayerItemSelected]}
                      onPress={() => setSelectedPlayer(p)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.modalPlayerItemLeft}>
                        <PlayerAvatar player={{ id: p.playerId || undefined, collectionId: 'team_players', photo: p.photo || undefined }} size={24} />
                        <Text style={[styles.modalPlayerItemText, isSelected && styles.modalPlayerItemTextSelected]}>{p.name}</Text>
                      </View>
                      {isSelected && <Feather name="check" size={14} color="#000000" />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPendingRow(null)}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !selectedPlayer && styles.btnDisabled]}
                onPress={confirmAddRow}
                disabled={!selectedPlayer}
              >
                <Text style={styles.modalConfirmBtnText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* El permiso es compartido por ambos equipos árbitro. Esta advertencia evita que
          se guarde un marcador de prueba por accidente: después, solo la liga puede
          habilitar otra corrección puntual. */}
      <Modal visible={confirmingSubmit} transparent animationType="fade" onRequestClose={() => setConfirmingSubmit(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalTitleRow}>
              <Feather name="alert-triangle" size={20} color={theme.colors.primary} />
              <Text style={styles.modalTitle}>¿Guardar resultado?</Text>
            </View>
            <Text style={styles.modalWarningText}>
              Este envío bloqueará el marcador para ambos equipos árbitro. Solo la liga podrá habilitar una nueva corrección.
            </Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmingSubmit(false)} disabled={submitting}>
                <Text style={styles.modalCancelBtnText}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, submitting && styles.btnDisabled]} onPress={handleSubmit} disabled={submitting}>
                <Text style={styles.modalConfirmBtnText}>{submitting ? 'Guardando...' : 'Guardar y bloquear'}</Text>
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
  emptyTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 4, textAlign: 'center' },
  emptySub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  hint: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: theme.spacing.md, textAlign: 'center' },
  scoreboardCard: { backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  teamScoreName: { flex: 1, color: theme.colors.text, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  scoreNumber: { color: '#ffffff', fontSize: 26, fontWeight: '800', minWidth: 32, textAlign: 'center' },
  scoreDash: { color: '#666666', fontSize: 20, fontWeight: '700' },
  teamCard: { backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  teamCardTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  emptyRowsText: { color: theme.colors.textMuted, fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
  eventRowPlayer: { flex: 1, color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  eventRowPlayerBlank: { color: theme.colors.textMuted, fontStyle: 'italic', fontWeight: '400' },
  eventDeleteBtn: { padding: 6 },
  rowButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  addBtn: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  addBtnText: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },
  notesInput: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 12, color: theme.colors.text, fontSize: 14, minHeight: 90 },
  submitBtn: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: theme.spacing.sm },
  submitBtnText: { color: '#000000', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
  modalContainer: { width: '100%', maxWidth: 420, maxHeight: '85%', backgroundColor: theme.colors.cardBg, borderRadius: 14, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '800' },
  modalSubTitle: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 12 },
  modalWarningText: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 12 },
  modalPlayerListLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  modalPlayerScroll: { maxHeight: 260 },
  modalPlayerScrollContent: { gap: 4 },
  modalEmptyBox: { padding: theme.spacing.md },
  modalEmptyText: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center' },
  modalPlayerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 4 },
  modalPlayerItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  modalPlayerItemSelected: { borderColor: theme.colors.primary, backgroundColor: 'rgba(56,189,248,0.1)' },
  modalPlayerItemText: { color: theme.colors.text, fontSize: 14 },
  modalPlayerItemTextSelected: { fontWeight: '700' },
  modalButtonsRow: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md },
  modalCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  modalCancelBtnText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  modalConfirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8, backgroundColor: theme.colors.primary },
  modalConfirmBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
});
