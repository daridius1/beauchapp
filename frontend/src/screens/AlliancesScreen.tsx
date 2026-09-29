import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ALLIANCES, AllianceId } from '../constants/alliances';
import { AllianceNameText } from '../components/AllianceNameText';
import { allianceService, AllianceDiscipline } from '../services/allianceService';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Alliances'>;

const ALLIANCE_COLORS: Record<AllianceId, string> = {
  urbana: '#f59e0b',
  pop: '#ec4899',
  gotico: '#a78bfa',
  hiphop: '#22c55e',
  punk: '#ef4444',
  rock: '#38bdf8',
};

const PLACE_COLORS: Record<number, string> = {
  1: '#f5c451',
  2: '#b9c2cf',
  3: '#c88b5a',
};

export const AlliancesScreen: React.FC<Props> = ({ navigation }) => {
  const [disciplines, setDisciplines] = useState<AllianceDiscipline[]>([]);
  const [myAlliance, setMyAlliance] = useState<AllianceId | null>(null);
  const [canChooseAlliance, setCanChooseAlliance] = useState(false);
  const [savingAlliance, setSavingAlliance] = useState<AllianceId | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDisciplines = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      setError('');
      const state = await allianceService.getDisciplines();
      setDisciplines(state.disciplines);
      setMyAlliance(state.myAlliance);
      setCanChooseAlliance(state.canChooseAlliance);
    } catch (err) {
      console.error('Error cargando disciplinas de alianzas:', err);
      setError('No se pudieron cargar las disciplinas.');
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    loadDisciplines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => loadDisciplines(true));
      setLoading(false);
    });
    return () => subscription.remove();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => loadDisciplines(true));
  };

  const chooseAlliance = async (alliance: AllianceId) => {
    if (savingAlliance !== null || myAlliance === alliance) return;
    setSavingAlliance(alliance);
    setError('');
    try {
      const result = await withMinimumDelay(() => allianceService.chooseAlliance(alliance), 400);
      setMyAlliance(result.alliance);
    } catch (err: any) {
      setError(err?.response?.error || err?.message || 'No se pudo guardar tu alianza.');
    } finally {
      setSavingAlliance(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        )}
      >
        <View style={styles.allianceSection}>
          {canChooseAlliance ? (
            <>
              <Text style={styles.allianceTitle}>{myAlliance ? 'Tu alianza' : 'Elige tu alianza'}</Text>
              {!myAlliance && <Text style={styles.allianceHelp}>Se usará en todos los juegos de Alianzas.</Text>}
              <View style={styles.allianceGrid}>
                {ALLIANCES.map((alliance) => {
                  const selected = myAlliance === alliance.id;
                  return (
                    <TouchableOpacity
                      key={alliance.id}
                      style={[
                        styles.allianceButton,
                        {
                          borderColor: ALLIANCE_COLORS[alliance.id],
                          opacity: selected ? 1 : 0.58,
                        },
                        selected && [
                          styles.allianceButtonSelected,
                          { backgroundColor: `${ALLIANCE_COLORS[alliance.id]}18` },
                        ],
                      ]}
                      activeOpacity={0.7}
                      disabled={savingAlliance !== null || selected}
                      onPress={() => chooseAlliance(alliance.id)}
                    >
                      {savingAlliance === alliance.id ? (
                        <ActivityIndicator color={ALLIANCE_COLORS[alliance.id]} />
                      ) : (
                        <AllianceNameText
                          alliance={alliance.id}
                          style={[styles.allianceButtonText, { color: ALLIANCE_COLORS[alliance.id] }]}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.allianceHelp}>Solo las cuentas de estudiante pueden competir por una alianza.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Disciplinas</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!error && disciplines.length === 0 ? (
          <Text style={styles.emptyText}>Todavía no hay disciplinas publicadas.</Text>
        ) : disciplines.map((discipline) => (
          <View key={discipline.id} style={styles.disciplineRow}>
            <Text style={styles.disciplineName}>{discipline.name}</Text>
            {discipline.placements.length === 0 ? (
              <Text style={styles.pendingText}>Resultados pendientes</Text>
            ) : (
              <View style={styles.placements}>
                {discipline.placements.map((placement) => (
                  <View key={placement.alliance} style={styles.placementRow}>
                    <View
                      style={[
                        styles.placeBadge,
                        { borderColor: PLACE_COLORS[placement.place] || theme.colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.place,
                          { color: PLACE_COLORS[placement.place] || theme.colors.textMuted },
                        ]}
                      >
                        #{placement.place}
                      </Text>
                    </View>
                    <AllianceNameText alliance={placement.alliance} style={styles.allianceName} />
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Juegos</Text>
        <TouchableOpacity
          style={styles.gameRow}
          activeOpacity={0.7}
          onPress={() => navigation.push('NikitaJump')}
        >
          <Text style={styles.gameTitle}>Nikita Jump</Text>
          <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.gameRow}
          activeOpacity={0.7}
          onPress={() => navigation.push('AllianceProfessors')}
        >
          <Text style={styles.gameTitle}>Cazaprofes</Text>
          <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: 40 },
  allianceSection: {
    paddingBottom: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  allianceTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '800', marginBottom: 5 },
  allianceHelp: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  allianceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.md },
  allianceButton: {
    width: '31%',
    minWidth: 96,
    flexGrow: 1,
    minHeight: 58,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  allianceButtonSelected: { borderWidth: 2 },
  allianceButtonText: { fontSize: 16 },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  disciplineRow: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  disciplineName: { color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  placements: { gap: 8 },
  placementRow: { flexDirection: 'row', alignItems: 'center', minHeight: 30 },
  placeBadge: {
    width: 34,
    height: 24,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  place: { fontSize: 12, fontWeight: '800' },
  allianceName: { color: theme.colors.text, fontSize: 14 },
  pendingText: { color: theme.colors.textMuted, fontSize: 13 },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  errorText: { color: theme.colors.error, fontSize: 13, paddingVertical: theme.spacing.md },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  gameTitle: { flex: 1, color: theme.colors.text, fontSize: 16, fontWeight: '600' },
});
