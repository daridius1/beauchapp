import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { RootStackParamList } from '../types/navigation';
import {
  AvailabilityGrid,
  ScheduleLegend,
  scheduleWindowBlockCodes,
  hourLabel,
  MIN_LEVEL,
  LEVEL_LABELS,
  LEVEL_COLORS,
  LEVEL_TEXT_COLORS,
  canPlay,
} from '../components/schedule/AvailabilityGrid';

type Props = NativeStackScreenProps<RootStackParamList, 'TeamSchedule'>;

const DAY_LABELS_FULL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function matchBlockLabel(code: string): string {
  const hour = Number(code.slice(-2));
  const [y, m, d] = code.slice(0, -3).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayLabel = DAY_LABELS_FULL[(date.getDay() + 6) % 7];
  return `${dayLabel} ${d} ${MONTH_LABELS[m - 1]} · ${hourLabel(hour)}`;
}

export const TeamScheduleScreen: React.FC<Props> = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});
  const [blockedBlocks, setBlockedBlocks] = useState<Set<string>>(new Set());
  const [occupiedBlocks, setOccupiedBlocks] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Cualquier cuenta autenticada puede marcar su propia disponibilidad (jugadores
  // individuales igual que equipos) — solo las cuentas de equipo, además, pueden ver
  // la disponibilidad agregada de sus integrantes por bloque (rosterMode más abajo).
  const isTeamAccount = user?.type === 'organization' && user?.subtype === 'team';
  // Bloques sin calificar parten en el valor más bajo de la escala para ambos casos —
  // no tiene sentido asumir una disponibilidad mejor que la peor por defecto.
  const defaultLevel = MIN_LEVEL;

  // Para cuentas de equipo, tocar un bloque abre un modal donde se elige la nota (1-5)
  // Y se ve quién del equipo puede jugar en ese horario — a los que no pueden (o no
  // calificaron) simplemente no se les muestra, no tiene sentido listarlos acá.
  const [modalBlock, setModalBlock] = useState<string | null>(null);
  const [modalMembers, setModalMembers] = useState<{ memberId: string; memberName: string }[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const windowBlocks = scheduleWindowBlockCodes();

      const windowSet = new Set(windowBlocks);

      const [blockedRes, horarioMatchesRes, leagueMatchesRes] = await Promise.all([
        pb.collection('horario_blocked_slots').getFullList({ batch: 500 }),
        pb.collection('horario_matches').getFullList({ batch: 500, filter: 'status = "confirmed"' }),
        pb.collection('league_matches').getFullList({ batch: 500, filter: 'status = "confirmed" || status = "played"' }),
      ]);
      const blockedSet = new Set<string>(
        blockedRes.map((r: any) => r.blockCode as string).filter((b: string) => windowSet.has(b))
      );
      setBlockedBlocks(blockedSet);

      // "Ocupado" no es un toggle manual como los bloques cerrados por el admin — se
      // deriva de cualquier partido ya asignado (de horarios o de una liga), sea o no
      // este propio equipo uno de los que juega, porque el bloque completo queda tomado.
      const occupiedSet = new Set<string>(
        [...horarioMatchesRes, ...leagueMatchesRes]
          .map((r: any) => r.blockCode as string)
          .filter((b: string) => windowSet.has(b))
      );
      setOccupiedBlocks(occupiedSet);

      const validBlocks = windowBlocks.filter((b) => !blockedSet.has(b) && !occupiedSet.has(b));
      const defaults: Record<string, number> = {};
      validBlocks.forEach((b) => { defaults[b] = defaultLevel; });

      try {
        const existing = await pb.collection('horario_availability').getFirstListItem(`team = "${user.id}"`);
        setExistingRecordId(existing.id);
        // Solo se conservan las claves todavía vigentes (ventana + no bloqueadas) — lo
        // demás simplemente se descarta, ya sea porque quedó atrás en el calendario o
        // porque el admin cerró ese bloque después de que el equipo ya había enviado.
        const existingHappiness: Record<string, number> = existing.happiness || {};
        const merged: Record<string, number> = { ...defaults };
        validBlocks.forEach((b) => {
          if (existingHappiness[b] !== undefined) merged[b] = existingHappiness[b];
        });
        setValues(merged);
      } catch (err) {
        setExistingRecordId(null);
        setValues(defaults);
      }

      // "Tus partidos" solo tiene sentido para cuentas de equipo (horario_matches es
      // siempre equipo vs equipo) — a un jugador individual nunca le va a salir nada
      // ahí, así que ni vale la pena pedirlo.
      if (isTeamAccount) {
        const matchesRes = await pb.collection('horario_matches').getList(1, 50, {
          filter: `teamA = "${user.id}" || teamB = "${user.id}"`,
          sort: '-created',
          expand: 'teamA,teamB',
        });
        setMatches(matchesRes.items);
      }
    } catch (err) {
      console.error('Error cargando horarios:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const validBlocks = scheduleWindowBlockCodes().filter((b) => !blockedBlocks.has(b) && !occupiedBlocks.has(b));

  const openBlockModal = async (block: string) => {
    setModalBlock(block);
    setLoadingRoster(true);
    try {
      const data = await pb.send('/api/team-schedule/roster-availability', { method: 'GET', query: { blockCode: block } });
      const members: { memberId: string; memberName: string; happiness: number | null }[] = data.members || [];
      // Solo se muestra a quien SÍ puede — sin calificar cuenta como "no confirmado",
      // tampoco se muestra.
      setModalMembers(
        members
          .filter((m) => m.happiness !== null && canPlay(m.happiness))
          .map((m) => ({ memberId: m.memberId, memberName: m.memberName }))
      );
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'No se pudo cargar', text2: err?.data?.error || err?.message });
      setModalMembers([]);
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleChange = (block: string, nextLevel: number) => {
    if (isTeamAccount) {
      openBlockModal(block);
      return;
    }
    setValues((prev) => ({ ...prev, [block]: nextLevel }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const happiness: Record<string, number> = {};
      validBlocks.forEach((b) => { happiness[b] = values[b] ?? defaultLevel; });

      if (existingRecordId) {
        await pb.collection('horario_availability').update(existingRecordId, { happiness });
      } else {
        const created = await pb.collection('horario_availability').create({
          team: user.id,
          happiness,
        });
        setExistingRecordId(created.id);
      }
      Toast.show({ type: 'success', text1: 'Disponibilidad guardada' });
    } catch (err: any) {
      console.error('Error guardando disponibilidad:', err);
      Toast.show({ type: 'error', text1: 'No se pudo guardar', text2: err?.data?.message || err?.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScheduleLegend binary={!isTeamAccount} />

      <View style={styles.gridWrap}>
        <AvailabilityGrid
          values={values}
          onChange={handleChange}
          blockedBlocks={blockedBlocks}
          occupiedBlocks={occupiedBlocks}
          binary={!isTeamAccount}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar disponibilidad'}</Text>
      </TouchableOpacity>

      {isTeamAccount && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Tus partidos</Text>
          {matches.length === 0 ? (
            <Text style={styles.mutedText}>Todavía no tienes partidos confirmados.</Text>
          ) : (
            matches.map((m) => {
              const opponent = m.teamA === user?.id ? m.expand?.teamB : m.expand?.teamA;
              return (
                <View key={m.id} style={styles.matchRow}>
                  <Text style={styles.matchOpponent}>vs. {opponent?.name || 'Equipo'}</Text>
                  <Text style={styles.matchBlock}>{matchBlockLabel(m.blockCode)}</Text>
                </View>
              );
            })
          )}
        </>
      )}
    </ScrollView>

    <Modal visible={!!modalBlock} transparent animationType="fade" onRequestClose={() => setModalBlock(null)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{modalBlock ? matchBlockLabel(modalBlock) : ''}</Text>

          <Text style={styles.modalSubLabel}>Tu nota para este bloque</Text>
          <View style={styles.ratingRow}>
            {([1, 2, 3, 4, 5] as const).map((lvl) => {
              const active = modalBlock !== null && (values[modalBlock] ?? MIN_LEVEL) === lvl;
              return (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    styles.ratingBtn,
                    { backgroundColor: LEVEL_COLORS[lvl] },
                    active && styles.ratingBtnActive,
                  ]}
                  onPress={() => modalBlock && setValues((prev) => ({ ...prev, [modalBlock]: lvl }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.ratingBtnText, { color: LEVEL_TEXT_COLORS[lvl] }]}>{LEVEL_LABELS[lvl]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.modalSubLabel}>Pueden jugar en este horario</Text>
          {loadingRoster ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 20 }} />
          ) : modalMembers.length === 0 ? (
            <Text style={styles.mutedText}>Nadie del equipo confirmó poder jugar en este horario.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 220 }}>
              {modalMembers.map((m) => (
                <View key={m.memberId} style={styles.rosterRow}>
                  <Text style={styles.rosterName} numberOfLines={1}>{m.memberName}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalBlock(null)}>
            <Text style={styles.modalCloseBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.cardBg,
    borderRadius: 14,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: theme.spacing.md,
  },
  modalSubLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: theme.spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 6,
  },
  // `flexBasis: 0` (en vez de dejar que el ancho salga del contenido) es lo que
  // garantiza que las 5 opciones queden exactamente del mismo ancho pese a que sus
  // etiquetas tienen largos distintos ("Mala" vs "Excelente").
  ratingBtn: {
    flexBasis: 0,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ratingBtnActive: {
    borderColor: '#ffffff',
  },
  ratingBtnText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  rosterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rosterName: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  modalCloseBtn: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalCloseBtnText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  mutedText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  gridWrap: {
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  matchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  matchOpponent: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  matchBlock: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});
