import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../theme/theme';
import { pb } from '../services/pocketbase';
import { RootStackParamList } from '../types/navigation';
import { summarizeEvents } from '../utils/matchEvents';
import { hourLabel } from '../components/schedule/AvailabilityGrid';

type Props = NativeStackScreenProps<RootStackParamList, 'LeagueMatchDetail'>;

const DAY_LABELS_FULL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function matchBlockLabel(code: string): string {
  const hour = Number(code.slice(-2));
  const [y, m, d] = code.slice(0, -3).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayLabel = DAY_LABELS_FULL[(date.getDay() + 6) % 7];
  return `${dayLabel} ${d} ${MONTH_LABELS[m - 1]} · ${hourLabel(hour)}`;
}

export const LeagueMatchDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { matchId } = route.params;
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<any>(null);
  const [approvedEvents, setApprovedEvents] = useState<any[]>([]);

  const fetchMatch = useCallback(async () => {
    try {
      setLoading(true);
      const record = await pb.collection('league_matches').getOne(matchId, { expand: 'teamA,teamB' });
      setMatch(record);

      // El resumen de un partido jugado viene del informe que se aprobó como oficial
      // (puede haber varios informes distintos para el mismo partido — solo uno queda
      // aprobado).
      if (record.status === 'played') {
        try {
          const report = await pb.collection('match_reports').getFirstListItem(
            `match = "${matchId}" && status = "approved"`
          );
          setApprovedEvents(report.events || []);
        } catch (err) {
          setApprovedEvents([]);
        }
      }
    } catch (err) {
      console.error('Error cargando el partido:', err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useFocusEffect(
    useCallback(() => {
      fetchMatch();
    }, [fetchMatch])
  );

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

  const teamA = match.expand?.teamA;
  const teamB = match.expand?.teamB;
  const summary = summarizeEvents(approvedEvents);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.teamsRow}>
        <TouchableOpacity onPress={() => navigation.push('UserProfile', { userId: teamA?.id })} style={styles.teamCol}>
          <Text style={styles.teamName}>{teamA?.name || 'Equipo A'}</Text>
        </TouchableOpacity>
        <Text style={styles.vsText}>
          {match.status === 'played' ? `${match.scoreA} - ${match.scoreB}` : 'vs'}
        </Text>
        <TouchableOpacity onPress={() => navigation.push('UserProfile', { userId: teamB?.id })} style={styles.teamCol}>
          <Text style={styles.teamName}>{teamB?.name || 'Equipo B'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.blockText}>{matchBlockLabel(match.blockCode)}</Text>

      <View style={styles.divider} />

      {match.status === 'confirmed' && (
        <View>
          <Text style={styles.mutedText}>
            Este partido todavía no se ha jugado. Cualquier persona puede arbitrarlo — incluso puede haber varios
            informes en paralelo, el administrador de la liga aprueba uno solo como oficial.
          </Text>
          <TouchableOpacity
            style={styles.arbitrateBtn}
            onPress={() => navigation.push('LeagueMatchArbitrator', { matchId })}
          >
            <Text style={styles.arbitrateBtnText}>Arbitrar</Text>
          </TouchableOpacity>
        </View>
      )}

      {match.status === 'cancelled' && <Text style={styles.mutedText}>Este partido fue cancelado.</Text>}

      {match.status === 'played' && (
        <View>
          <Text style={styles.sectionTitle}>Resumen</Text>
          <Text style={styles.summaryLine}>
            🟨 {teamA?.name}: {summary.cardsA.yellow} · {teamB?.name}: {summary.cardsB.yellow}
          </Text>
          <Text style={styles.summaryLine}>
            🟥 {teamA?.name}: {summary.cardsA.red} · {teamB?.name}: {summary.cardsB.red}
          </Text>

          {summary.goals.length > 0 && (
            <>
              <Text style={styles.subTitle}>Goles</Text>
              {summary.goals.map((g, i) => (
                <Text key={i} style={styles.eventLine}>
                  ⚽ {g.player} ({g.team === 'A' ? teamA?.name : teamB?.name}){g.ownGoal ? ' — autogol' : ''}
                </Text>
              ))}
            </>
          )}

          {summary.penalties.length > 0 && (
            <>
              <Text style={styles.subTitle}>Penales</Text>
              {summary.penalties.map((p, i) => (
                <Text key={i} style={styles.eventLine}>
                  🎯 {p.player} ({p.team === 'A' ? teamA?.name : teamB?.name}) — {p.scored ? 'gol' : 'errado'}
                </Text>
              ))}
            </>
          )}

          {summary.cards.length > 0 && (
            <>
              <Text style={styles.subTitle}>Tarjetas</Text>
              {summary.cards.map((c, i) => (
                <Text key={i} style={styles.eventLine}>
                  {c.type === 'yellow_card' ? '🟨' : '🟥'} {c.player} ({c.team === 'A' ? teamA?.name : teamB?.name})
                </Text>
              ))}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, padding: theme.spacing.lg },
  mutedText: { color: theme.colors.textMuted, fontSize: 14, marginBottom: theme.spacing.md },
  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamCol: { flex: 1 },
  teamName: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  vsText: { color: theme.colors.textMuted, fontSize: 16, fontWeight: '700', marginHorizontal: theme.spacing.sm },
  blockText: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.lg },
  arbitrateBtn: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  arbitrateBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: theme.spacing.sm },
  subTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '700', marginTop: theme.spacing.md, marginBottom: 4 },
  summaryLine: { color: theme.colors.textMuted, fontSize: 13, marginBottom: 2 },
  eventLine: { color: theme.colors.textMuted, fontSize: 13, marginBottom: 2 },
});
