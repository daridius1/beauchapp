import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  DeviceEventEmitter,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';
import { LeagueMatch } from '../types/league';
import { Avatar } from '../components/Avatar';
import { InfoModal } from '../components/InfoModal';
import { TeamCrest, matchDisplayName } from '../components/leagues/TeamCrest';
import { LoadMoreButton, usePagedList } from '../components/LoadMoreButton';
import { SectionHeading } from '../components/SectionHeading';
import { pollaService, PollaBet } from '../services/pollaService';
import { PollaPick, PICKS, PICK_LABELS, isBettingClosed, outcomeOf, computePollaLeaderboard, pickVisual, cardOutcome } from '../utils/polla';
import { formatBlockCode } from '../utils/blockCode';

// Las reglas viven en el modal de ayuda, no repartidas por la pantalla: la vista muestra
// partidos y puntos, y quien necesite el detalle lo abre.
const INFO_SECTIONS = [
  {
    title: '¿Cómo se juega?',
    body: 'Para cada partido de la liga marcas quién crees que gana: local, empate o visita. Puedes cambiar tu apuesta todas las veces que quieras hasta que se cierre.',
  },
  {
    title: 'Puntos',
    body: 'Acertar el ganador da 1 punto. Acertar el empate da 2, porque es el resultado más difícil de predecir y el que menos gente marca.',
  },
  {
    title: 'Cuándo se cierra',
    body: 'Las apuestas de un partido se cierran 10 minutos antes de su horario, o apenas el partido arranca en la vista de arbitraje — lo que pase primero.',
  },
  {
    title: 'El secreto',
    body: 'Hasta que se cierra, nadie puede ver lo que apostaste, y tú no puedes ver lo que apostaron los demás. Cuando se cierra, todas las apuestas de ese partido quedan a la vista.',
  },
  {
    title: 'Desempate',
    body: 'Si dos personas tienen los mismos puntos, queda arriba la que tenga más aciertos totales: acertar más partidos vale más que acertar pocos empates.',
  },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Polla'>;

type TabType = 'matches' | 'leaderboard';

export const PollaScreen: React.FC<Props> = ({ route, navigation }) => {
  const { leagueId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [league, setLeague] = useState<any>(null);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [bets, setBets] = useState<PollaBet[]>([]);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('matches');
  const [infoVisible, setInfoVisible] = useState(false);

  const fetchData = useCallback(
    async (isPullRefresh = false) => {
      try {
        if (!isPullRefresh) setLoading(true);
        const [leagueRes, matchesRes, betsRes] = await Promise.all([
          pb.collection('users').getOne(leagueId).catch(() => null),
          pb.collection('league_matches').getFullList<LeagueMatch>({
            filter: `league = "${leagueId}" && deleted = false && status != "cancelled"`,
            expand: 'teamA,teamB',
            batch: 500,
          }).catch(() => []),
          pollaService.listVisibleBets(leagueId),
        ]);
        setLeague(leagueRes);
        setMatches(matchesRes as LeagueMatch[]);
        setBets(betsRes);
      } catch (err) {
        console.error('Error cargando la polla:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leagueId]
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

  // Mi apuesta por partido — la única que se puede ver antes del cierre.
  const myPickByMatch = useMemo(() => {
    const map: Record<string, PollaPick> = {};
    if (!user) return map;
    bets.forEach((b) => {
      if (b.user === user.id) map[b.match] = b.pick;
    });
    return map;
  }, [bets, user]);

  const usersById = useMemo(() => {
    const map: Record<string, any> = {};
    bets.forEach((b) => {
      if (b.expand?.user) map[b.user] = b.expand.user;
    });
    return map;
  }, [bets]);

  const leaderboard = useMemo(
    () => computePollaLeaderboard(matches as any, bets, usersById),
    [matches, bets, usersById]
  );

  // Primero los que todavía se pueden apostar (más cercano primero), después los
  // cerrados (más reciente primero) — el orden en que uno los necesita.
  // Dos grupos, no una lista plana: lo que todavía se puede apostar es lo urgente y va
  // completo arriba; lo cerrado se acumula sin techo, así que va por tandas abajo.
  const { openMatches, closedMatches } = useMemo(() => {
    const nowMs = Date.now();
    const open: LeagueMatch[] = [];
    const closed: LeagueMatch[] = [];
    matches.forEach((m) => (isBettingClosed(m.bettingClosesAt, nowMs) ? closed : open).push(m));

    const byCloseTime = (a: LeagueMatch, b: LeagueMatch) =>
      new Date(a.bettingClosesAt || 0).getTime() - new Date(b.bettingClosesAt || 0).getTime();

    // Abiertos: el que cierra antes primero (es el que hay que apostar ya).
    open.sort(byCloseTime);
    // Cerrados: el más reciente primero.
    closed.sort((a, b) => byCloseTime(b, a));

    return { openMatches: open, closedMatches: closed };
  }, [matches]);

  const { visible: visibleClosed, remaining, loadMore } = usePagedList(closedMatches, 12);

  const handlePick = async (match: LeagueMatch, pick: PollaPick) => {
    if (!user) {
      Toast.show({ type: 'info', text1: 'Inicia sesión', text2: 'Debes iniciar sesión para apostar.' });
      return;
    }
    if (isBettingClosed(match.bettingClosesAt)) {
      Toast.show({ type: 'error', text1: 'Apuestas cerradas', text2: 'Este partido ya no acepta apuestas.' });
      return;
    }
    setSavingMatchId(match.id);
    const previous = myPickByMatch[match.id];
    try {
      const saved = await pollaService.savePick(leagueId, match.id, user.id, pick);
      setBets((prev) => {
        const rest = prev.filter((b) => !(b.match === match.id && b.user === user.id));
        return [...rest, saved];
      });
    } catch (err: any) {
      console.error('Error guardando la apuesta:', err);
      Toast.show({
        type: 'error',
        text1: 'No se pudo guardar',
        text2: err?.data?.message || (previous ? 'Se mantuvo tu apuesta anterior.' : 'Intenta de nuevo.'),
      });
    } finally {
      setSavingMatchId(null);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const pollaEnabled = Boolean(league?.pollaEnabled);
  const leagueName = league?.name || league?.username || 'Liga';

  if (!pollaEnabled) {
    return (
      <View style={styles.centerContainer}>
        <Feather name="slash" size={28} color={theme.colors.textMuted} style={{ marginBottom: 10 }} />
        <Text style={styles.emptyTitle}>La polla no está habilitada</Text>
        <Text style={styles.emptySub}>{leagueName} todavía no abrió su Beaupolla.</Text>
      </View>
    );
  }

  const renderMatch = (match: LeagueMatch) => {
    const closed = isBettingClosed(match.bettingClosesAt);
    const played = match.status === 'played';
    const myPick = myPickByMatch[match.id];
    const result: PollaPick | null = played ? outcomeOf(match.scoreA, match.scoreB) : null;
    const outcome = cardOutcome(myPick, result);

    return (
      <View
        key={match.id}
        style={[
          styles.matchCard,
          outcome === 'hit' && styles.matchCardHit,
          outcome === 'miss' && styles.matchCardMiss,
        ]}
      >
        {/* Toda la fila del partido lleva a la vista de la polla de ese partido */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.push('PollaMatch', { leagueId, matchId: match.id })}
        >
          <Text style={styles.matchDate}>{formatBlockCode(match.blockCode)}</Text>

          <View style={styles.matchTeams}>
            <View style={styles.matchTeamSide}>
              <TeamCrest team={match.expand?.teamA} size={22} />
              <Text style={styles.matchTeamName} numberOfLines={1}>
                {matchDisplayName(match.expand?.teamA, 'Local')}
              </Text>
            </View>
            <View style={styles.matchCenter}>
              <Text style={styles.matchScore}>
                {played ? `${match.scoreA ?? 0} - ${match.scoreB ?? 0}` : 'vs'}
              </Text>
            </View>
            <View style={[styles.matchTeamSide, styles.matchTeamSideRight]}>
              <Text style={[styles.matchTeamName, styles.textRight]} numberOfLines={1}>
                {matchDisplayName(match.expand?.teamB, 'Visita')}
              </Text>
              <TeamCrest team={match.expand?.teamB} size={22} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Los tres botones cargan TODO el estado, solo con color:
            blanco = mi apuesta (aún secreta) · verde lleno = acerté
            rojo = fallé · verde borde = el resultado, que no aposté */}
        <View style={styles.pickRow}>
          {PICKS.map((p) => {
            const visual = pickVisual(p, myPick, result, closed);
            return (
              <TouchableOpacity
                key={p}
                style={[styles.pickBtn, PICK_BTN_STYLES[visual]]}
                onPress={() => handlePick(match, p)}
                disabled={closed || savingMatchId === match.id}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickBtnText, PICK_TEXT_STYLES[visual]]}>{PICK_LABELS[p]}</Text>
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
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Beaupolla</Text>
          <Text style={styles.subtitle}>{leagueName}</Text>
        </View>
        <TouchableOpacity style={styles.infoButton} activeOpacity={0.7} onPress={() => setInfoVisible(true)}>
          <Feather name="info" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'matches' && styles.tabItemActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>Partidos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'leaderboard' && styles.tabItemActive]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>
            Tabla
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'matches' && (
        <View style={styles.tabContent}>
          {matches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Esta liga todavía no tiene partidos para apostar.</Text>
            </View>
          ) : (
            <>
              {openMatches.length > 0 && (
                <>
                  <SectionHeading title="Apuestas abiertas" size="lg" marginTop={0} />
                  {openMatches.map(renderMatch)}
                </>
              )}

              {closedMatches.length > 0 && (
                <>
                  <SectionHeading title="Apuestas cerradas" size="lg" />
                  {visibleClosed.map(renderMatch)}
                  <LoadMoreButton remaining={remaining} onPress={loadMore} label="partidos" />
                </>
              )}
            </>
          )}
        </View>
      )}

      {activeTab === 'leaderboard' && (
        <View style={styles.tabContent}>
          {leaderboard.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Todavía no hay apuestas registradas.</Text>
            </View>
          ) : (
            leaderboard.map((row, idx) => (
              <TouchableOpacity
                key={row.userId}
                style={[styles.lbRow, idx === leaderboard.length - 1 && styles.lbRowLast]}
                activeOpacity={0.7}
                onPress={() => navigation.push('PollaUserBets', { leagueId, userId: row.userId })}
              >
                <Text style={[styles.lbPos, idx === 0 && styles.lbPosTop]}>{idx + 1}</Text>
                <Avatar user={usersById[row.userId] || { name: row.name || '?' }} size={30} />
                <Text style={[styles.lbName, idx === 0 && styles.lbNameTop]} numberOfLines={1}>
                  {row.name || row.username || 'Alguien'}
                </Text>
                <Text style={[styles.lbPoints, idx === 0 && styles.lbPointsTop]}>{row.points}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
      <InfoModal
        visible={infoVisible}
        title="Beaupolla"
        sections={INFO_SECTIONS}
        onClose={() => setInfoVisible(false)}
      />
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
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInfo: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, marginTop: 2 },
  infoButton: { padding: 6 },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
    marginVertical: 12,
  },
  tabItem: { paddingVertical: 10, marginRight: 20 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#ffffff', marginBottom: -1 },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.colors.textMuted },
  tabTextActive: { color: '#ffffff' },
  tabContent: { paddingTop: 4 },

  // Partido
  matchCard: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1c1c1c',
    borderRadius: 6,
    backgroundColor: '#0b0b0b',
  },
  // El borde de la tarjeta repite el mismo estado, legible de un vistazo sin leer los
  // botones. Solo aparece cuando aposté: si no jugué ese partido, queda neutro.
  matchCardHit: { borderColor: '#2d4a34' },
  matchCardMiss: { borderColor: '#4a2d2d' },
  matchDate: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 10,
  },
  matchTeams: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // minWidth: 0 — sin esto un nombre largo descentra el marcador.
  matchTeamSide: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchTeamSideRight: { justifyContent: 'flex-end' },
  matchTeamName: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '600', color: '#dddddd' },
  textRight: { textAlign: 'right' },
  matchCenter: { minWidth: 52, alignItems: 'center' },
  matchScore: { fontSize: 15, fontWeight: '700', color: '#ffffff', textAlign: 'center' },

  pickRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pickBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#242424',
    backgroundColor: '#111111',
  },
  // Mi apuesta, todavía secreta.
  pickNeutral: {},
  pickMine: { borderColor: '#ffffff', backgroundColor: '#1f1f1f' },
  // Acerté: verde LLENO. Es lo único que se ve así.
  pickHit: { borderColor: '#4ade80', backgroundColor: '#14301d' },
  // Fallé: rojo. Su sola presencia distingue "jugué y perdí" de "no jugué".
  pickMiss: { borderColor: '#f87171', backgroundColor: '#2a1416' },
  // El resultado que yo no aposté: verde, pero solo borde y más apagado que 'hit'.
  pickResult: { borderColor: '#3d5a44', backgroundColor: 'transparent' },
  pickDim: { opacity: 0.3 },

  pickBtnText: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  pickTextNeutral: {},
  pickTextMine: { color: '#ffffff', fontWeight: '700' },
  pickTextHit: { color: '#4ade80', fontWeight: '800' },
  pickTextMiss: { color: '#f87171', fontWeight: '700' },
  pickTextResult: { color: '#6d8f76' },
  pickTextDim: {},


  // Tabla
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  lbRowLast: { borderBottomWidth: 0 },
  lbPos: { width: 20, fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, textAlign: 'center' },
  lbPosTop: { color: '#ffffff' },
  lbName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#dddddd' },
  lbNameTop: { color: '#ffffff', fontWeight: '700' },
  lbPoints: { minWidth: 28, fontSize: 16, fontWeight: '700', color: '#dddddd', textAlign: 'right' },
  lbPointsTop: { color: '#ffffff' },

  emptyContainer: { padding: theme.spacing.lg, alignItems: 'center' },
  emptyText: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  emptySub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
});

// Estado visual -> estilo. Están acá y no inline para que agregar un caso nuevo obligue
// a definir su color en un solo lugar.
const PICK_BTN_STYLES = {
  neutral: styles.pickNeutral,
  mine: styles.pickMine,
  hit: styles.pickHit,
  miss: styles.pickMiss,
  result: styles.pickResult,
  dim: styles.pickDim,
} as const;

const PICK_TEXT_STYLES = {
  neutral: styles.pickTextNeutral,
  mine: styles.pickTextMine,
  hit: styles.pickTextHit,
  miss: styles.pickTextMiss,
  result: styles.pickTextResult,
  dim: styles.pickTextDim,
} as const;
