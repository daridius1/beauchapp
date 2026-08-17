import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { RootStackParamList } from '../types/navigation';
import { AvailabilityGrid, ScheduleLegend, scheduleWindowBlockCodes, hourLabel } from '../components/schedule/AvailabilityGrid';

type Props = NativeStackScreenProps<RootStackParamList, 'TeamSchedule'>;

// Default para bloques que el equipo todavía no calificó: "Regular", ni tan bajo como
// para tentar a dejarlo así por pereza, ni tan alto como para inflar de entrada el
// puntaje sin haber elegido nada realmente.
const DEFAULT_LEVEL = 2;

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

  const isTeam = user?.type === 'organization' && user?.subtype === 'team';

  const fetchData = useCallback(async () => {
    if (!user || !isTeam) {
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
      validBlocks.forEach((b) => { defaults[b] = DEFAULT_LEVEL; });

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

      const matchesRes = await pb.collection('horario_matches').getList(1, 50, {
        filter: `teamA = "${user.id}" || teamB = "${user.id}"`,
        sort: '-created',
        expand: 'teamA,teamB',
      });
      setMatches(matchesRes.items);
    } catch (err) {
      console.error('Error cargando horarios:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isTeam]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const validBlocks = scheduleWindowBlockCodes().filter((b) => !blockedBlocks.has(b) && !occupiedBlocks.has(b));

  const handleChange = (block: string, nextLevel: number) => {
    setValues((prev) => ({ ...prev, [block]: nextLevel }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const happiness: Record<string, number> = {};
      validBlocks.forEach((b) => { happiness[b] = values[b] ?? DEFAULT_LEVEL; });

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

  if (!isTeam) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.mutedText}>Esta sección es solo para cuentas de equipo.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.introText}>
        Toca un bloque para cambiar qué tan buena es tu disponibilidad para jugar en ese horario.
      </Text>
      <ScheduleLegend />

      <View style={styles.gridWrap}>
        <AvailabilityGrid values={values} onChange={handleChange} blockedBlocks={blockedBlocks} occupiedBlocks={occupiedBlocks} />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar disponibilidad'}</Text>
      </TouchableOpacity>

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
    paddingBottom: 40,
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
  introText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: theme.spacing.sm,
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
