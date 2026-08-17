import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../theme/theme';
import { pb } from '../services/pocketbase';
import { RootStackParamList } from '../types/navigation';
import { hourLabel } from '../components/schedule/AvailabilityGrid';

type Props = NativeStackScreenProps<RootStackParamList, 'LeagueDetail'>;

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Por jugar',
  played: 'Jugado',
  cancelled: 'Cancelado',
};

const DAY_LABELS_FULL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function matchBlockLabel(code: string): string {
  const hour = Number(code.slice(-2));
  const [y, m, d] = code.slice(0, -3).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayLabel = DAY_LABELS_FULL[(date.getDay() + 6) % 7];
  return `${dayLabel} ${d} ${MONTH_LABELS[m - 1]} · ${hourLabel(hour)}`;
}

export const LeagueDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { leagueId } = route.params;
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const teamsRes = await pb.collection('league_teams').getFullList({
        filter: `league = "${leagueId}"`,
        expand: 'team',
        sort: 'created',
      });
      setTeams(teamsRes);

      const matchesRes = await pb.collection('league_matches').getList(1, 100, {
        filter: `league = "${leagueId}"`,
        sort: '-created',
        expand: 'teamA,teamB',
      });
      setMatches(matchesRes.items);
    } catch (err) {
      console.error('Error cargando la liga:', err);
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Equipos</Text>
      {teams.length === 0 ? (
        <Text style={styles.mutedText}>Todavía no hay equipos en esta liga.</Text>
      ) : (
        teams.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={styles.teamRow}
            onPress={() => navigation.push('UserProfile', { userId: t.expand?.team?.id })}
          >
            <Text style={styles.teamName}>{t.expand?.team?.name || t.expand?.team?.username || 'Equipo'}</Text>
          </TouchableOpacity>
        ))
      )}

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Partidos</Text>
      {matches.length === 0 ? (
        <Text style={styles.mutedText}>Todavía no hay partidos.</Text>
      ) : (
        matches.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={styles.matchRow}
            onPress={() => navigation.push('LeagueMatchDetail', { matchId: m.id })}
          >
            <View style={styles.matchInfo}>
              <Text style={styles.matchTeams}>
                {m.expand?.teamA?.name || 'Equipo'}
                {m.status === 'played' ? ` ${m.scoreA} - ${m.scoreB} ` : ' vs '}
                {m.expand?.teamB?.name || 'Equipo'}
              </Text>
              <Text style={styles.matchStatus}>{STATUS_LABELS[m.status] || m.status}</Text>
            </View>
            <Text style={styles.matchBlock}>{matchBlockLabel(m.blockCode)}</Text>
          </TouchableOpacity>
        ))
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
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  teamRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  teamName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  matchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  matchInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  matchTeams: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  matchStatus: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  matchBlock: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});
