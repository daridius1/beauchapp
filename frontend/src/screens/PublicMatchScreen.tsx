import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../theme/theme';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';
import { summarizeEvents, computeLiveElapsedMs, computeLiveStatus, MatchEvent } from '../utils/matchEvents';
import { PublicShell } from '../components/PublicShell';
import { matchDisplayName } from '../components/leagues/TeamCrest';
import { formatBlockCode } from '../utils/blockCode';
import { LeagueMatchScoreboard } from '../components/leagues/LeagueMatchScoreboard';
import { LeagueMatchStats } from '../components/leagues/LeagueMatchStats';
import { LeagueMatchTimeline } from '../components/leagues/LeagueMatchTimeline';
import { LeagueMatchLineups } from '../components/leagues/LeagueMatchLineups';
import { BeaumarketProbabilityBar } from '../components/leagues/BeaumarketProbabilityBar';
import { publicLeagueService, PublicMatchData, PublicMatchBeaumarket } from '../services/publicLeagueService';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicMatch'>;

// Un partido visto sin cuenta. Misma información que la vista normal salvo los
// comentarios: solo el marcador, las estadísticas, la cronología y la convocatoria.
// El botón de arbitrar sigue estando — pide el código del partido, que es la
// autorización real.
export const PublicMatchScreen: React.FC<Props> = ({ route, navigation }) => {
  const { matchId } = route.params;
  const [data, setData] = useState<PublicMatchData | null>(null);
  const [beaumarket, setBeaumarket] = useState<PublicMatchBeaumarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const fetchData = useCallback(async () => {
    try {
      setData(await publicLeagueService.getMatch(matchId));
    } catch (err) {
      console.error('Error cargando el partido:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    try {
      setBeaumarket(await publicLeagueService.getMatchBeaumarket(matchId));
    } catch (err) {
      console.error('Error cargando la predicción de Beaumarket:', err);
    }
  }, [matchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await withMinimumDelay(fetchData, 400);
  }, [fetchData]);

  const match = data?.match;
  const report = data?.report;
  const events: MatchEvent[] = report?.events || [];
  const summary = useMemo(() => summarizeEvents(events), [events]);

  const isPlayed = match?.status === 'played';
  const isLive = match?.status === 'confirmed' && summary.halfStarted[1];

  const live = useMemo(() => {
    if (!isLive) return undefined;
    const { elapsedMs, running } = computeLiveElapsedMs(events, now);
    const { minuteLabel, isHalftime } = computeLiveStatus(summary, elapsedMs, running);
    return { scoreA: summary.scoreA, scoreB: summary.scoreB, running, isHalftime, minuteLabel };
  }, [isLive, events, now, summary]);

  const teamAName = matchDisplayName(match?.expand?.teamA, 'Local');
  const teamBName = matchDisplayName(match?.expand?.teamB, 'Visita');

  return (
    <PublicShell title="Partido" onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={onRefresh}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : !match ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No se pudo cargar el partido.</Text></View>
      ) : (
        <>
          {/* El encabezado con liga y etapa se muestra arriba del marcador, igual que
              en la vista con sesión. */}
          <Text style={styles.context}>
            {(data?.league?.name || 'Liga') + (data?.stageName ? ' · ' + data.stageName : '')}
          </Text>

          <LeagueMatchScoreboard
            match={match as any}
            live={live}
            formattedDate={formatBlockCode(match.blockCode)}
            onPressTeamA={match.expand?.teamA?.id ? () => navigation.navigate('PublicTeam', { teamId: match.expand!.teamA!.id }) : undefined}
            onPressTeamB={match.expand?.teamB?.id ? () => navigation.navigate('PublicTeam', { teamId: match.expand!.teamB!.id }) : undefined}
            // Arbitrar no necesita cuenta: lo que se pide es el código del partido.
            onPressArbitrate={
              match.status === 'confirmed' || match.status === 'played'
                ? () => navigation.navigate('LeagueMatchArbitrator', { matchId })
                : undefined
            }
          />

          {beaumarket?.hasMarket && (
            <BeaumarketProbabilityBar
              prices={beaumarket.prices}
              winningOutcomeIndex={beaumarket.winningOutcomeIndex}
              status={beaumarket.status}
            />
          )}

          {(isPlayed || isLive) && (
            <View style={styles.section}>
              <LeagueMatchStats summary={summary} teamAName={teamAName} teamBName={teamBName} />

              <Text style={styles.sectionHeader}>Cronología</Text>
              <LeagueMatchTimeline events={events} teamAName={teamAName} teamBName={teamBName} />

              <Text style={styles.sectionHeader}>Convocatoria</Text>
              <LeagueMatchLineups
                lineupA={summary.lineupA}
                lineupB={summary.lineupB}
                teamAName={teamAName}
                teamBName={teamBName}
                events={events}
              />

              {isPlayed && !!report?.notes && (
                <>
                  <Text style={styles.sectionHeader}>Informe del árbitro</Text>
                  <Text style={styles.notes}>{report.notes}</Text>
                </>
              )}
            </View>
          )}
        </>
      )}
    </PublicShell>
  );
};

const styles = StyleSheet.create({
  context: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 10,
  },
  section: { marginTop: 8 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
    textAlign: 'center',
  },
  notes: { color: theme.colors.text, fontSize: 13, lineHeight: 19 },
  empty: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyText: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
});
