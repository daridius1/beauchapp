import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, RefreshControl, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../theme/theme';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';
import { LeagueMatch } from '../types/league';
import { Avatar } from '../components/Avatar';
import { TeamCrest, matchDisplayName } from '../components/leagues/TeamCrest';
import { LoadMoreButton, usePagedList } from '../components/LoadMoreButton';
import { pollaService, PollaBet } from '../services/pollaService';
import { PICK_LABELS, PollaPick, outcomeOf, pickPoints, computePollaLeaderboard, cardOutcome } from '../utils/polla';
import { formatBlockCode } from '../utils/blockCode';

type Props = NativeStackScreenProps<RootStackParamList, 'PollaUserBets'>;

// Lo que apostó una persona en esta liga.
//
// Solo aparecen los partidos cuyas apuestas ya dejaron de ser secretas: el recorte lo
// hace el SERVIDOR con la regla de `polla_bets`, no un filtro de esta pantalla. Las
// apuestas todavía secretas simplemente no vienen en la respuesta — así que no hay
// forma de inferirlas desde acá ni desde la API.
export const PollaUserBetsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { leagueId, userId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [bets, setBets] = useState<PollaBet[]>([]);

  const fetchData = useCallback(
    async (isPullRefresh = false) => {
      try {
        if (!isPullRefresh) setLoading(true);
        const [profileRes, matchesRes, betsRes] = await Promise.all([
          pb.collection('users').getOne(userId).catch(() => null),
          pb.collection('league_matches').getFullList<LeagueMatch>({
            filter: `league = "${leagueId}" && deleted = false`,
            expand: 'teamA,teamB',
            batch: 500,
          }).catch(() => []),
          pollaService.listUserBets(leagueId, userId),
        ]);
        setProfile(profileRes);
        setMatches(matchesRes as LeagueMatch[]);
        setBets(betsRes);
      } catch (err) {
        console.error('Error cargando las apuestas de esa persona:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leagueId, userId]
  );

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Botón de actualizar de la cabecera. A diferencia del pull-to-refresh (que usa el
  // indicador nativo de arriba y deja el contenido visible), acá se muestra el spinner
  // central con un mínimo de 400ms: es lo que hace que el refresco se sienta como una
  // acción y no como un parpadeo. Ver PRINCIPLES.md §6.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchData(true), 400);
      setLoading(false);
    });
    return () => sub.remove();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchData(true), 400);
  }, [fetchData]);

  const matchById = useMemo(() => {
    const map: Record<string, LeagueMatch> = {};
    matches.forEach((m) => { map[m.id] = m; });
    return map;
  }, [matches]);

  // Solo las apuestas cuyo partido conocemos, más recientes primero.
  const rows = useMemo(() => {
    return bets
      .map((b) => ({ bet: b, match: matchById[b.match] }))
      .filter((r) => !!r.match)
      .sort((a, b) => new Date(b.match!.bettingClosesAt || 0).getTime() - new Date(a.match!.bettingClosesAt || 0).getTime());
  }, [bets, matchById]);

  const totals = useMemo(() => {
    const board = computePollaLeaderboard(matches as any, bets);
    return board[0] || { points: 0, hits: 0, resolved: 0 };
  }, [matches, bets]);

  const { visible, remaining, loadMore } = usePagedList(rows, 12);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const isMe = user?.id === userId;
  const displayName = profile?.name || profile?.username || 'Alguien';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      {/* La cabecera lleva al perfil de la persona en la app */}
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.7}
        onPress={() => navigation.push('UserProfile', { userId })}
      >
        <Avatar user={profile || { name: displayName }} size={48} />
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{displayName}</Text>
          {!!profile?.username && <Text style={styles.handle}>@{profile.username}</Text>}
        </View>
        <View style={styles.headerPoints}>
          <Text style={styles.pointsValue}>{totals.points}</Text>
          <Text style={styles.pointsLabel}>{totals.points === 1 ? 'punto' : 'puntos'}</Text>
        </View>
      </TouchableOpacity>

      {rows.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {isMe ? 'Todavía no tienes apuestas visibles.' : 'Sin apuestas visibles todavía.'}
          </Text>
        </View>
      ) : (
        <>
          {visible.map(({ bet, match }) => {
            const m = match!;
            const played = m.status === 'played';
            const result: PollaPick | null = played ? outcomeOf(m.scoreA, m.scoreB) : null;
            const points = played ? pickPoints(bet.pick, m.scoreA, m.scoreB) : 0;
            const outcome = cardOutcome(bet.pick, result);

            return (
              <TouchableOpacity
                key={bet.id}
                style={[
                  styles.betRow,
                  outcome === 'hit' && styles.betRowHit,
                  outcome === 'miss' && styles.betRowMiss,
                ]}
                activeOpacity={0.7}
                onPress={() => navigation.push('PollaMatch', { leagueId, matchId: m.id })}
              >
                <Text style={styles.betDate}>{formatBlockCode(m.blockCode)}</Text>

                <View style={styles.betMatch}>
                  <View style={styles.betTeamSide}>
                    <TeamCrest team={m.expand?.teamA} size={18} />
                    <Text style={styles.betTeamName} numberOfLines={1}>
                      {matchDisplayName(m.expand?.teamA, 'Local')}
                    </Text>
                  </View>
                  <Text style={styles.betScore}>
                    {played ? `${m.scoreA ?? 0}-${m.scoreB ?? 0}` : 'vs'}
                  </Text>
                  <View style={[styles.betTeamSide, styles.betTeamSideRight]}>
                    <Text style={[styles.betTeamName, styles.textRight]} numberOfLines={1}>
                      {matchDisplayName(m.expand?.teamB, 'Visita')}
                    </Text>
                    <TeamCrest team={m.expand?.teamB} size={18} />
                  </View>
                </View>

                <View style={styles.betResultRow}>
                  <Text
                    style={[
                      styles.betPick,
                      played && (outcome === 'hit' ? styles.betPickHit : styles.betPickMiss),
                    ]}
                  >
                    {PICK_LABELS[bet.pick]}
                  </Text>
                  {points > 0 && <Text style={styles.betPointsWin}>+{points}</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          <LoadMoreButton remaining={remaining} onPress={loadMore} label="apuestas" />
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 60 },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    marginBottom: 8,
  },
  headerInfo: { flex: 1 },
  name: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  handle: { fontSize: 13, color: theme.colors.textMuted, marginTop: 1 },
  headerPoints: { alignItems: 'flex-end' },
  pointsValue: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  pointsLabel: { fontSize: 10, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },

  betRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1c1c1c',
    borderRadius: 6,
    backgroundColor: '#0b0b0b',
  },
  betRowHit: { borderColor: '#2d4a34' },
  betRowMiss: { borderColor: '#4a2d2d' },
  betDate: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 9,
  },
  betMatch: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // minWidth: 0 — sin esto un nombre largo descentra el marcador.
  betTeamSide: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  betTeamSideRight: { justifyContent: 'flex-end' },
  betTeamName: { flex: 1, minWidth: 0, fontSize: 12, color: '#cccccc' },
  textRight: { textAlign: 'right' },
  betScore: { fontSize: 13, fontWeight: '700', color: '#ffffff', minWidth: 40, textAlign: 'center' },

  betResultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  betPick: { flex: 1, fontSize: 13, fontWeight: '700', color: '#dddddd' },
  betPickHit: { color: '#4ade80' },
  betPickMiss: { color: '#f87171' },
  betPointsWin: { fontSize: 13, fontWeight: '800', color: '#4ade80' },

  emptyContainer: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyText: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
