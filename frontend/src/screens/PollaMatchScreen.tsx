import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, RefreshControl, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';
import { LeagueMatch } from '../types/league';
import { TeamCrest, matchDisplayName } from '../components/leagues/TeamCrest';
import { pollaService, PollaBet } from '../services/pollaService';
import { PICK_LABELS, PollaPick, isBettingClosed, outcomeOf } from '../utils/polla';
import { formatBlockCode } from '../utils/blockCode';

type Props = NativeStackScreenProps<RootStackParamList, 'PollaMatch'>;

// Un partido visto desde la polla: qué apostó cada persona.
//
// Mientras las apuestas siguen abiertas esta vista está casi vacía a propósito — el
// servidor no manda las apuestas ajenas y no hay nada que mostrar. Ese vacío ES la
// información: todavía es secreto.
export const PollaMatchScreen: React.FC<Props> = ({ route, navigation }) => {
  const { leagueId, matchId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [match, setMatch] = useState<LeagueMatch | null>(null);
  const [bets, setBets] = useState<PollaBet[]>([]);

  const fetchData = useCallback(
    async (isPullRefresh = false) => {
      try {
        if (!isPullRefresh) setLoading(true);
        const [matchRes, betsRes] = await Promise.all([
          pb.collection('league_matches').getOne<LeagueMatch>(matchId, { expand: 'teamA,teamB' }).catch(() => null),
          pollaService.listMatchBets(matchId),
        ]);
        setMatch(matchRes);
        setBets(betsRes);
      } catch (err) {
        console.error('Error cargando el partido de la polla:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [matchId]
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

  const closed = isBettingClosed(match?.bettingClosesAt);
  const played = match?.status === 'played';
  const result: PollaPick | null = played ? outcomeOf(match?.scoreA, match?.scoreB) : null;

  // Agrupadas por lo que apostó cada quien: se lee de una cuál fue la opinión mayoritaria.
  const byPick = useMemo(() => {
    const map: Record<PollaPick, PollaBet[]> = { home: [], draw: [], away: [] };
    bets.forEach((b) => {
      if (map[b.pick]) map[b.pick].push(b);
    });
    return map;
  }, [bets]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptySub}>No se encontró el partido.</Text>
      </View>
    );
  }

  const nameA = matchDisplayName(match.expand?.teamA, 'Local');
  const nameB = matchDisplayName(match.expand?.teamB, 'Visita');

  const pickColumn = (pick: PollaPick) => {
    const list = byPick[pick];
    const isResult = result === pick;
    return (
      <View key={pick} style={styles.pickCol}>
        <Text style={[styles.pickColTitle, isResult && styles.pickColTitleResult]}>
          {PICK_LABELS[pick]}
        </Text>
        <Text style={[styles.pickColCount, isResult && styles.pickColCountResult]}>{list.length}</Text>

        <View style={styles.pickColList}>
          {list.map((b) => {
            // Siempre el nombre, también el propio: la lista se lee como un listado de
            // gente, y un "Tú" en el medio rompe esa lectura.
            const isMe = user?.id === b.user;
            return (
              <TouchableOpacity
                key={b.id}
                activeOpacity={0.7}
                onPress={() => navigation.push('PollaUserBets', { leagueId, userId: b.user })}
              >
                <Text style={[styles.betterName, isMe && styles.betterNameMe]} numberOfLines={1}>
                  {b.expand?.user?.name || b.expand?.user?.username || 'Alguien'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      <Text style={styles.date}>{formatBlockCode(match.blockCode)}</Text>

      {/* Cabecera: lleva al partido real de la liga */}
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.7}
        onPress={() => navigation.push('LeagueMatchDetail', { matchId })}
      >
        <View style={styles.headerSide}>
          <TeamCrest team={match.expand?.teamA} size={30} />
          <Text style={styles.headerTeam} numberOfLines={1}>{nameA}</Text>
        </View>
        <Text style={styles.headerScore}>
          {played ? `${match.scoreA ?? 0} - ${match.scoreB ?? 0}` : 'vs'}
        </Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <Text style={[styles.headerTeam, styles.textRight]} numberOfLines={1}>{nameB}</Text>
          <TeamCrest team={match.expand?.teamB} size={30} />
        </View>
      </TouchableOpacity>

      {!closed ? (
        <View style={styles.emptyContainer}>
          <Feather name="eye-off" size={22} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>Apuestas en secreto</Text>
        </View>
      ) : bets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptySub}>Nadie apostó en este partido.</Text>
        </View>
      ) : (
        <View style={styles.picksRow}>
          {pickColumn('home')}
          <View style={styles.colDivider} />
          {pickColumn('draw')}
          <View style={styles.colDivider} />
          {pickColumn('away')}
        </View>
      )}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 60 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },

  date: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    marginBottom: 18,
  },
  // minWidth: 0 — sin esto un nombre largo descentra el marcador.
  headerSide: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSideRight: { justifyContent: 'flex-end' },
  headerTeam: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '600', color: '#ffffff' },
  textRight: { textAlign: 'right' },
  headerScore: { fontSize: 18, fontWeight: '800', color: '#ffffff', minWidth: 52, textAlign: 'center' },

  picksRow: { flexDirection: 'row', alignItems: 'flex-start' },
  pickCol: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  // Línea vertical entre columnas, como en los planteles del detalle del partido: sin
  // cajas, la separación la da el trazo y no un contenedor.
  colDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#1f1f1f',
    marginHorizontal: 8,
  },
  pickColTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.4 },
  pickColTitleResult: { color: '#4ade80' },
  pickColCount: { fontSize: 22, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginTop: 4 },
  pickColCountResult: { color: '#4ade80' },
  pickColList: { marginTop: 10, gap: 6 },

  betterName: { fontSize: 12, color: '#bbbbbb', textAlign: 'center' },
  betterNameMe: { color: '#ffffff', fontWeight: '700' },


  emptyContainer: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  emptySub: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },
});
