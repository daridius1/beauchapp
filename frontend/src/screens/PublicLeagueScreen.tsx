import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';
import { LeagueMatch } from '../types/league';
import { summarizeEvents, computeLiveElapsedMs, computeLiveStatus, computeTopScorers, MatchEvent } from '../utils/matchEvents';
import { Avatar } from '../components/Avatar';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PublicShell } from '../components/PublicShell';
import { SectionHeading } from '../components/SectionHeading';
import { LiveMatchInfo } from '../components/leagues/LeagueMatchRow';
import { PagedMatchList } from '../components/leagues/PagedMatchList';
import { LeagueStandingsTable } from '../components/leagues/LeagueStandingsTable';
import { TeamCrest, matchDisplayName } from '../components/leagues/TeamCrest';
import { publicLeagueService, PublicLeagueData } from '../services/publicLeagueService';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicLeague'>;
type TabType = 'matches' | 'standings' | 'scorers' | 'teams';

function blockCodeTimestamp(code: string): number {
  if (!code || code.length < 13) return NaN;
  const hour = Number(code.slice(-2));
  const [y, m, d] = code.slice(0, -3).split('-').map(Number);
  return new Date(y, m - 1, d, hour).getTime();
}

// La liga vista sin cuenta: partidos, etapas, goleadores y equipos.
//
// Es la misma información que ve alguien logueado, con las mismas piezas visuales —
// lo que NO está es todo lo que implique interactuar: nada de comentarios, citas,
// likes ni Beaupolla.
export const PublicLeagueScreen: React.FC<Props> = ({ route, navigation }) => {
  const { leagueId } = route.params;
  const [data, setData] = useState<PublicLeagueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('matches');
  const [now, setNow] = useState(Date.now());

  const fetchData = useCallback(async () => {
    try {
      setData(await publicLeagueService.getLeague(leagueId));
    } catch (err) {
      console.error('Error cargando la liga:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leagueId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await withMinimumDelay(fetchData, 400);
  }, [fetchData]);

  const matches = data?.matches || [];
  const stages = data?.stages || [];
  const teams = data?.teams || [];

  const liveInfoByMatch = useMemo(() => {
    const reportByMatch: Record<string, any> = {};
    (data?.reports || []).forEach((r) => { reportByMatch[r.match] = r; });

    const map: Record<string, LiveMatchInfo> = {};
    matches.forEach((m) => {
      if (m.status !== 'confirmed') return;
      const report = reportByMatch[m.id];
      if (!report) return;
      const events: MatchEvent[] = report.events || [];
      const summary = summarizeEvents(events);
      if (!summary.halfStarted[1]) return;
      const { elapsedMs, running } = computeLiveElapsedMs(events, now);
      const { minuteLabel, isHalftime } = computeLiveStatus(summary, elapsedMs, running);
      map[m.id] = { scoreA: summary.scoreA, scoreB: summary.scoreB, running, isHalftime, minuteLabel };
    });
    return map;
  }, [matches, data, now]);

  const sortedMatches = useMemo(() => {
    const nowMs = Date.now();
    const priority = (m: LeagueMatch) => {
      if (liveInfoByMatch[m.id]) return 0;
      if (m.status === 'confirmed') return 1;
      if (m.status === 'played') return 2;
      return 3;
    };
    return [...matches].sort((a, b) => {
      const diff = priority(a) - priority(b);
      if (diff !== 0) return diff;
      return Math.abs(blockCodeTimestamp(a.blockCode) - nowMs) - Math.abs(blockCodeTimestamp(b.blockCode) - nowMs);
    });
  }, [matches, liveInfoByMatch]);

  const stagesWithData = useMemo(() => {
    return stages.map((s) => {
      const stageMatches = matches.filter((m) => (m as any).stage === s.id);
      if (s.type === 'knockout') return { ...s, matches: stageMatches, teams: [] as typeof teams };
      const ids = new Set<string>(s.teams);
      stageMatches.forEach((m) => { if (m.teamA) ids.add(m.teamA); if (m.teamB) ids.add(m.teamB); });
      return { ...s, matches: stageMatches, teams: teams.filter((t) => ids.has(t.expand?.team?.id || t.team)) };
    });
  }, [stages, matches, teams]);

  const topScorers = useMemo(() => {
    const matchById: Record<string, LeagueMatch> = {};
    matches.forEach((m) => { matchById[m.id] = m; });
    const entries = (data?.reports || [])
      .filter((r) => r.status === 'approved')
      .map((r) => {
        const m = matchById[r.match];
        if (!m) return null;
        return { events: r.events || [], teamAId: m.teamA, teamBId: m.teamB };
      })
      .filter(Boolean) as { events: MatchEvent[]; teamAId: string; teamBId: string }[];
    return computeTopScorers(entries);
  }, [data, matches]);

  const teamById = useMemo(() => {
    const map: Record<string, any> = {};
    teams.forEach((t) => { if (t.expand?.team?.id) map[t.expand.team.id] = t.expand.team; });
    return map;
  }, [teams]);

  const leagueName = data?.league?.name || data?.league?.username || 'Liga';

  return (
    <PublicShell
      title={leagueName}
      onBack={() => navigation.goBack()}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : !data ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No se pudo cargar la liga.</Text></View>
      ) : (
        <>
          <View style={styles.header}>
            <Avatar user={data.league} size={52} />
            <View style={styles.headerInfo}>
              <Text style={styles.leagueName}>{leagueName}</Text>
              {!!data.league.username && <Text style={styles.handle}>@{data.league.username}</Text>}
              {!!data.bio && <Text style={styles.bio} numberOfLines={2}>{data.bio}</Text>}
            </View>
          </View>

          <View style={styles.tabBar}>
            {([
              ['matches', 'Partidos'],
              ['standings', 'Etapas'],
              ['scorers', 'Goleadores'],
              ['teams', 'Equipos'],
            ] as [TabType, string][]).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.tabItem, activeTab === key && styles.tabItemActive]}
                onPress={() => setActiveTab(key)}
              >
                <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'matches' && (
            <PagedMatchList
              matches={sortedMatches}
              liveInfoByMatch={liveInfoByMatch}
              emptyText="Esta liga todavía no tiene partidos."
              onPressMatch={(matchId) => navigation.navigate('PublicMatch', { matchId })}
            />
          )}

          {activeTab === 'standings' && (
            stagesWithData.length === 0 ? (
              <View style={styles.empty}><Text style={styles.emptyText}>Todavía no hay etapas.</Text></View>
            ) : (
              stagesWithData.map((s, idx) => (
                <View key={s.id} style={idx === stagesWithData.length - 1 ? undefined : styles.stageSection}>
                  <SectionHeading title={s.name} />
                  {s.type === 'knockout' ? (
                    <PagedMatchList
                      matches={s.matches}
                      liveInfoByMatch={liveInfoByMatch}
                      emptyText="Todavía no hay partidos en esta etapa."
                      hideStage
                      onPressMatch={(matchId) => navigation.navigate('PublicMatch', { matchId })}
                    />
                  ) : (
                    <LeagueStandingsTable
                      teams={s.teams}
                      matches={s.matches as any}
                      onPressTeam={(teamId) => navigation.navigate('PublicTeam', { teamId })}
                    />
                  )}
                </View>
              ))
            )
          )}

          {activeTab === 'scorers' && (
            topScorers.length === 0 ? (
              <View style={styles.empty}><Text style={styles.emptyText}>Todavía no hay goles en partidos finalizados.</Text></View>
            ) : (
              topScorers.map((s, idx) => {
                const team = s.teamId ? teamById[s.teamId] : null;
                return (
                  <View key={s.key} style={[styles.scorerRow, idx === topScorers.length - 1 && styles.scorerRowLast]}>
                    <Text style={[styles.scorerPos, idx === 0 && styles.scorerPosTop]}>{idx + 1}</Text>
                    <PlayerAvatar player={{ id: s.playerId || undefined, collectionId: 'team_players', photo: s.photo || undefined }} size={30} />
                    <View style={styles.scorerInfo}>
                      <Text style={[styles.scorerName, idx === 0 && styles.scorerNameTop]} numberOfLines={1}>{s.name}</Text>
                      {!!team && <Text style={styles.scorerTeam} numberOfLines={1}>{matchDisplayName(team, 'Equipo')}</Text>}
                    </View>
                    {!!team && <TeamCrest team={team} size={20} />}
                    <Text style={[styles.scorerGoals, idx === 0 && styles.scorerGoalsTop]}>{s.goals}</Text>
                  </View>
                );
              })
            )
          )}

          {activeTab === 'teams' && (
            teams.length === 0 ? (
              <View style={styles.empty}><Text style={styles.emptyText}>No hay equipos inscritos.</Text></View>
            ) : (
              teams.map((item, idx) => {
                const team = item.expand?.team;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.teamRow, idx === teams.length - 1 && styles.teamRowLast]}
                    activeOpacity={0.7}
                    disabled={!team?.id}
                    onPress={() => team?.id && navigation.navigate('PublicTeam', { teamId: team.id })}
                  >
                    <TeamCrest team={team} size={36} />
                    <View style={styles.info}>
                      <Text style={styles.teamName}>{matchDisplayName(team, 'Equipo')}</Text>
                      {!!team?.username && <Text style={styles.handle}>@{team.username}</Text>}
                    </View>
                    <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                );
              })
            )
          )}
        </>
      )}
    </PublicShell>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14 },
  headerInfo: { flex: 1, minWidth: 0 },
  leagueName: { fontSize: 19, fontWeight: '800', color: '#ffffff' },
  handle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  bio: { fontSize: 12, color: theme.colors.textMuted, marginTop: 5 },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1e1e1e', marginBottom: 12 },
  tabItem: { paddingVertical: 10, marginRight: 18 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#ffffff', marginBottom: -1 },
  tabText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  tabTextActive: { color: '#ffffff' },

  stageSection: { marginBottom: 20 },

  scorerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#161616' },
  scorerRowLast: { borderBottomWidth: 0 },
  scorerPos: { width: 20, fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, textAlign: 'center' },
  scorerPosTop: { color: '#ffffff' },
  scorerInfo: { flex: 1, minWidth: 0 },
  scorerName: { fontSize: 14, fontWeight: '600', color: '#dddddd' },
  scorerNameTop: { color: '#ffffff', fontWeight: '700' },
  scorerTeam: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  scorerGoals: { minWidth: 24, fontSize: 15, fontWeight: '700', color: '#dddddd', textAlign: 'right' },
  scorerGoalsTop: { color: '#ffffff' },

  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#161616' },
  teamRowLast: { borderBottomWidth: 0 },
  info: { flex: 1, minWidth: 0 },
  teamName: { fontSize: 15, fontWeight: '600', color: '#ffffff' },

  empty: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyText: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
});
