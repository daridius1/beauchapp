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
import { CommentsHeader } from '../components/CommentsHeader';
import { SectionHeading } from '../components/SectionHeading';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';
import { summarizeEvents, computeLiveElapsedMs, computeLiveStatus, computeTopScorers, MatchEvent } from '../utils/matchEvents';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';
import { EntityCommentBox } from '../components/EntityCommentBox';
import { LeagueMatchRowData, LiveMatchInfo } from '../components/leagues/LeagueMatchRow';
import { PagedMatchList } from '../components/leagues/PagedMatchList';
import { LeagueStandingsTable } from '../components/leagues/LeagueStandingsTable';
import { TeamCrest, matchDisplayName } from '../components/leagues/TeamCrest';

type Props = NativeStackScreenProps<RootStackParamList, 'LeagueDetail'>;

type TabType = 'matches' | 'standings' | 'scorers' | 'teams';

// blockCode = "YYYY-MM-DD-HH" — usado solo para ordenar por cercanía a hoy, no para
// mostrarse (el formato de fecha visible vive en LeagueMatchRow/LeagueMatchDetailScreen).
function blockCodeTimestamp(code: string): number {
  if (!code || code.length < 13) return NaN;
  const hour = Number(code.slice(-2));
  const [y, m, d] = code.slice(0, -3).split('-').map(Number);
  return new Date(y, m - 1, d, hour).getTime();
}

export const LeagueDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { leagueId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leagueUser, setLeagueUser] = useState<any>(null);
  const [stages, setStages] = useState<{ id: string; name: string; type: 'groups' | 'knockout'; teams: string[] }[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<LeagueMatchRowData[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<TabType>('matches');

  const fetchData = useCallback(
    async (isPullRefresh = false) => {
      try {
        if (!isPullRefresh) setLoading(true);

        const [userRes, stagesRes, teamsRes, matchesRes, reportsRes, commentsRes] = await Promise.all([
          pb.collection('users').getOne(leagueId).catch(() => null),
          pb.collection('league_stages').getFullList({
            filter: `league = "${leagueId}" && deleted = false`,
            sort: 'order,created',
          }).catch(() => []),
          pb.collection('league_teams').getFullList({
            filter: `league = "${leagueId}" && deleted = false`,
            expand: 'team',
            sort: 'created',
          }).catch(() => []),
          pb.collection('league_matches').getList(1, 200, {
            filter: `league = "${leagueId}" && deleted = false`,
            sort: '-created',
            expand: 'teamA,teamB,stage',
          }).catch(() => ({ items: [] })),
          // Estado en vivo de partidos siendo arbitrados ahora mismo — lectura pública
          // para cualquier autenticado (el código solo protege ESCRIBIR, no mirar).
          pb.collection('match_reports').getFullList({
            filter: `match.league = "${leagueId}" && deleted = false`,
          }).catch(() => []),
          pb.collection('posts').getList(1, 50, {
            filter: `targetType = "league" && targetId = "${leagueId}" && actionType = "comment" && deleted = false`,
            sort: '+created',
            expand: 'author',
          }).catch(() => ({ items: [] })),
        ]);

        setLeagueUser(userRes);
        setStages((stagesRes as any[]).map((s) => ({
          id: s.id,
          name: s.name || 'Etapa',
          type: s.type === 'knockout' ? 'knockout' : 'groups',
          // Participantes explícitos de la etapa (vacío en etapas anteriores al campo).
          teams: Array.isArray(s.teams) ? s.teams : [],
        })));
        setTeams(teamsRes);
        setMatches(matchesRes.items as LeagueMatchRowData[]);
        setReports(reportsRes as any[]);
        setComments(commentsRes.items);
      } catch (err) {
        console.error('Error cargando los datos de la liga:', err);
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

  // Solo para refrescar el minuto en vivo mostrado — no dispara ningún fetch.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(interval);
  }, []);

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

  // Citar liga al feed
  const handleShareLeagueToFeed = () => {
    if (!leagueUser && !leagueName) return;
    if (!user) {
      Toast.show({ type: 'info', text1: 'Inicia sesión', text2: 'Debes iniciar sesión para citar.' });
      return;
    }

    navigation.navigate('Home', {
      quoteTargetType: 'league',
      quoteTargetId: leagueId,
      quoteTargetMeta: {
        name: leagueName,
        username: leagueUser?.username,
        avatar: leagueUser?.avatar,
        bio: leagueUser?.bio,
      },
    });
  };

  // Publicar comentario en la liga
  const handleSendComment = async (content: string, photo: File | null, pollOptions: string[] | null) => {
    if (!user) return;
    try {
      const postData: any = {
        author: user.id,
        actionType: 'comment',
        targetType: 'league',
        targetId: leagueId,
        content: content.trim() || ' ',
        targetMeta: {
          name: leagueName,
          username: leagueUser?.username,
          avatar: leagueUser?.avatar,
        },
      };
      if (photo) postData.photo = photo;
      if (pollOptions && pollOptions.length >= 2) postData.pollOptions = pollOptions;

      const created = await pb.collection('posts').create(postData, { expand: 'author' });
      setComments((prev) => [...prev, created]);
      Toast.show({ type: 'success', text1: 'Comentario publicado' });
    } catch (err) {
      console.error('Error enviando comentario:', err);
      Toast.show({ type: 'error', text1: 'Error al enviar comentario' });
      throw err;
    }
  };

  const toggleCommentLike = async (post: any) => {
    if (!user) return;
    try {
      const likes = post.likes || [];
      const hasLiked = likes.includes(user.id);
      const updatedLikes = hasLiked ? likes.filter((id: string) => id !== user.id) : [...likes, user.id];
      setComments((prev) => prev.map((c) => (c.id === post.id ? { ...c, likes: updatedLikes } : c)));
      await pb.collection('posts').update(post.id, { likes: updatedLikes });
    } catch (err) {
      console.error('Error actualizando like:', err);
      fetchData(true);
    }
  };

  const handleDeleteComment = async (postId: string) => {
    try {
      setComments((prev) => prev.filter((c) => c.id !== postId));
      await pb.collection('posts').update(postId, { deleted: true });
      Toast.show({ type: 'success', text1: 'Comentario eliminado' });
    } catch (err) {
      console.error('Error eliminando comentario:', err);
      fetchData(true);
    }
  };

  // Estado en vivo por partido — se deriva siempre de los eventos del informe, nunca de
  // un campo guardado suelto (mismo criterio que el resto del sistema de arbitraje).
  // Un partido está "en vivo" mientras siga 'confirmed' y ya se haya marcado el inicio
  // del 1er tiempo — apenas termina el 2do tiempo el partido pasa a 'played' de
  // inmediato (se hace oficial ahí mismo), así que nunca queda "en vivo" ya terminado.
  const liveInfoByMatch = useMemo(() => {
    const reportByMatch: Record<string, any> = {};
    reports.forEach((r) => { reportByMatch[r.match] = r; });

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
  }, [matches, reports, now]);

  // Orden: 1º estado del partido (en vivo, luego pendientes, luego jugados, cancelados/
  // suspendidos al final), 2º fecha del bloque — del más cercano a hoy al más lejano.
  // Para pendientes eso es el próximo primero (ascendente); para jugados, el más
  // reciente primero (ya que "cercano a hoy" hacia atrás es descendente) — una sola
  // regla de "distancia a ahora" cubre ambos casos sin tener que tratarlos aparte.
  const matchPriority = useCallback(
    (m: LeagueMatchRowData) => {
      if (liveInfoByMatch[m.id]) return 0;
      if (m.status === 'confirmed') return 1;
      if (m.status === 'played') return 2;
      return 3;
    },
    [liveInfoByMatch]
  );

  // Mismo criterio de orden (estado, luego cercanía a hoy) reusado tanto para "Partidos"
  // (todos los partidos juntos) como para el listado de cada etapa knockout dentro de
  // "Posiciones" — son la misma noción de "orden natural de partidos", no dos reglas
  // distintas.
  const sortMatchesForDisplay = useCallback(
    (list: LeagueMatchRowData[]) => {
      const nowMs = Date.now();
      return [...list].sort((a, b) => {
        const priorityDiff = matchPriority(a) - matchPriority(b);
        if (priorityDiff !== 0) return priorityDiff;
        return Math.abs(blockCodeTimestamp(a.blockCode) - nowMs) - Math.abs(blockCodeTimestamp(b.blockCode) - nowMs);
      });
    },
    [matchPriority]
  );

  // Todos los partidos, sin filtrar — primero en vivo, luego pendientes, luego jugados.
  const filteredMatches = useMemo(() => sortMatchesForDisplay(matches), [matches, sortMatchesForDisplay]);

  const stageIdOf = useCallback((m: LeagueMatchRowData) => m.expand?.stage?.id || (m as any).stage, []);

  // Tabla de goleadores — se deriva de las bitácoras de arbitraje que ya están
  // cargadas para el estado en vivo, así que no cuesta ninguna petición extra.
  // Solo cuentan los partidos con informe aprobado (resultado oficial): un partido en
  // curso todavía puede cambiar, y sus goles se sumarían y restarían en vivo.
  const topScorers = useMemo(() => {
    const matchById: Record<string, LeagueMatchRowData> = {};
    matches.forEach((m) => { matchById[m.id] = m; });

    const entries = reports
      .filter((r) => r.status === 'approved')
      .map((r) => {
        const m = matchById[r.match];
        if (!m) return null;
        return {
          events: (r.events || []) as MatchEvent[],
          teamAId: m.expand?.teamA?.id || (m as any).teamA,
          teamBId: m.expand?.teamB?.id || (m as any).teamB,
        };
      })
      .filter(Boolean) as { events: MatchEvent[]; teamAId: string; teamBId: string }[];

    return computeTopScorers(entries);
  }, [reports, matches]);

  // Nombre y escudo de cada equipo, para poder mostrarlos junto al goleador sin
  // recorrer la lista de equipos en cada fila.
  const teamById = useMemo(() => {
    const map: Record<string, any> = {};
    teams.forEach((t) => {
      const team = t.expand?.team;
      if (team?.id) map[team.id] = team;
    });
    return map;
  }, [teams]);

  // "Posiciones" muestra TODAS las etapas, cada una con su propio encabezado — una de
  // grupos trae su tabla de posiciones (con solo los equipos que jugaron esa etapa); una
  // de eliminatoria directa no tiene tabla, solo su listado de partidos (mismo orden que
  // "Partidos") y nada más.
  const stagesWithData = useMemo(() => {
    return stages.map((s) => {
      const stageMatches = matches.filter((m) => stageIdOf(m) === s.id);
      if (s.type === 'knockout') {
        return { ...s, matches: sortMatchesForDisplay(stageMatches), teams: [] as typeof teams };
      }
      // Unión de los participantes declarados por la liga y de quienes efectivamente
      // jugaron. Los declarados hacen que un grupo recién armado ya muestre su tabla
      // (con todos en cero) en vez de verse vacío hasta el primer partido; los
      // derivados de partidos evitan que alguien que sí jugó desaparezca de la tabla
      // por no estar marcado.
      const participantIds = new Set<string>(s.teams);
      stageMatches.forEach((m) => {
        const aId = m.expand?.teamA?.id || (m as any).teamA;
        const bId = m.expand?.teamB?.id || (m as any).teamB;
        if (aId) participantIds.add(aId);
        if (bId) participantIds.add(bId);
      });
      const stageTeams = teams.filter((t) => participantIds.has(t.expand?.team?.id));
      return { ...s, matches: stageMatches, teams: stageTeams };
    });
  }, [stages, matches, teams, stageIdOf, sortMatchesForDisplay]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const leagueName = leagueUser?.name || leagueUser?.username || 'Liga';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      {/* Cabecera Principal de la Liga.
          La fila es un View y no un TouchableOpacity: el botón de la polla vive en la
          misma línea, y anidar un táctil dentro de otro deja ambiguo cuál responde. */}
      <View style={styles.headerSection}>
        <TouchableOpacity
          style={styles.headerMain}
          activeOpacity={0.7}
          onPress={() => navigation.push('UserProfile', { userId: leagueId })}
        >
          <Avatar user={leagueUser || { name: leagueName }} size={56} />
          <View style={styles.headerInfo}>
            <Text style={styles.leagueName}>{leagueName}</Text>
            {!!leagueUser?.username && (
              <Text style={styles.leagueHandle}>@{leagueUser.username}</Text>
            )}
            {!!leagueUser?.bio && (
              <Text style={styles.leagueBio} numberOfLines={2}>
                {leagueUser.bio}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Solo si la liga habilitó su Beaupolla. */}
        {!!leagueUser?.pollaEnabled && (
          <TouchableOpacity
            style={styles.pollaBtn}
            activeOpacity={0.7}
            onPress={() => navigation.push('Polla', { leagueId })}
          >
            <Text style={styles.pollaBtnText}>Polla</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Selector de Pestañas Planas */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'matches' && styles.tabItemActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>
            Partidos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'standings' && styles.tabItemActive]}
          onPress={() => setActiveTab('standings')}
        >
          <Text style={[styles.tabText, activeTab === 'standings' && styles.tabTextActive]}>
            Etapas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'scorers' && styles.tabItemActive]}
          onPress={() => setActiveTab('scorers')}
        >
          <Text style={[styles.tabText, activeTab === 'scorers' && styles.tabTextActive]}>
            Goleadores
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'teams' && styles.tabItemActive]}
          onPress={() => setActiveTab('teams')}
        >
          <Text style={[styles.tabText, activeTab === 'teams' && styles.tabTextActive]}>
            Equipos
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENIDO SEGÚN PESTAÑA */}

      {/* 1. PESTAÑA: PARTIDOS (FIXTURE) */}
      {activeTab === 'matches' && (
        <View style={styles.tabContent}>
          {/* Listado de Partidos — por tandas: una liga acumula todos sus partidos */}
          <PagedMatchList
            matches={filteredMatches}
            liveInfoByMatch={liveInfoByMatch}
            emptyText="No hay partidos con los filtros seleccionados."
            onPressMatch={(matchId) => navigation.push('LeagueMatchDetail', { matchId })}
          />
        </View>
      )}

      {/* 2. PESTAÑA: POSICIONES — todas las etapas, cada una con su encabezado; tabla
          de puntos si es de grupos, o solo el listado de partidos si es eliminatoria */}
      {activeTab === 'standings' && (
        <View style={styles.tabContent}>
          {stagesWithData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Todavía no hay etapas.</Text>
            </View>
          ) : (
            stagesWithData.map((s, sIdx) => (
              <View
                key={s.id}
                style={[styles.stageSection, sIdx === stagesWithData.length - 1 && styles.stageSectionLast]}
              >
                <SectionHeading title={s.name} />
                {s.type === 'knockout' ? (
                  <PagedMatchList
                    matches={s.matches}
                    liveInfoByMatch={liveInfoByMatch}
                    emptyText="Todavía no hay partidos en esta etapa."
                    hideStage
                    onPressMatch={(matchId) => navigation.push('LeagueMatchDetail', { matchId })}
                  />
                ) : (
                  <LeagueStandingsTable
                    teams={s.teams}
                    matches={s.matches}
                    onPressTeam={(teamId) => navigation.push('TeamProfile', { teamId })}
                  />
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* 3. PESTAÑA: GOLEADORES — tabla del campeonato, solo partidos ya oficiales */}
      {activeTab === 'scorers' && (
        <View style={styles.tabContent}>
          {topScorers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Todavía no hay goles registrados en partidos finalizados.
              </Text>
            </View>
          ) : (
            topScorers.map((scorer, idx) => {
              const team = scorer.teamId ? teamById[scorer.teamId] : null;
              const isLast = idx === topScorers.length - 1;
              // El podio se marca solo por posición, no por cantidad: si hay empate en
              // goles, ambos comparten el destaque igual que en cualquier tabla.
              const isTop = idx === 0;

              return (
                <View
                  key={scorer.key}
                  style={[styles.scorerRow, isLast && styles.scorerRowLast]}
                >
                  <Text style={[styles.scorerPos, isTop && styles.scorerPosTop]}>{idx + 1}</Text>

                  <PlayerAvatar
                    player={{
                      id: scorer.playerId || undefined,
                      collectionId: 'team_players',
                      photo: scorer.photo || undefined,
                    }}
                    size={30}
                  />

                  <View style={styles.scorerInfo}>
                    <Text style={[styles.scorerName, isTop && styles.scorerNameTop]} numberOfLines={1}>
                      {scorer.name}
                    </Text>
                    {!!team && (
                      <Text style={styles.scorerTeam} numberOfLines={1}>
                        {matchDisplayName(team, 'Equipo')}
                      </Text>
                    )}
                  </View>

                  {!!team && (
                    <TeamCrest
                      team={{
                        id: team.id,
                        collectionId: 'users',
                        avatar: team.avatar,
                        matchPhoto: team.matchPhoto,
                        name: team.name,
                        username: team.username,
                      }}
                      size={20}
                    />
                  )}

                  <Text style={[styles.scorerGoals, isTop && styles.scorerGoalsTop]}>{scorer.goals}</Text>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* 4. PESTAÑA: EQUIPOS */}
      {activeTab === 'teams' && (
        <View style={styles.tabContent}>
          {teams.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay equipos inscritos en esta liga aún.</Text>
            </View>
          ) : (
            teams.map((item, idx) => {
              const team = item.expand?.team;
              const name = matchDisplayName(team, 'Equipo');
              const isLast = idx === teams.length - 1;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.teamItemRow, isLast && styles.teamItemRowLast]}
                  onPress={() => {
                    if (team?.id) {
                      navigation.push('TeamProfile', { teamId: team.id });
                    }
                  }}
                  activeOpacity={0.7}
                  disabled={!team?.id}
                >
                  <View style={styles.teamRowLeft}>
                    <TeamCrest
                      team={{
                        id: team?.id,
                        collectionId: 'users',
                        avatar: team?.avatar,
                        matchPhoto: team?.matchPhoto,
                        name: team?.name,
                        username: team?.username,
                      }}
                      size={36}
                    />
                    <View style={styles.teamRowInfo}>
                      <Text style={styles.teamRowName}>{name}</Text>
                      {!!team?.username && (
                        <Text style={styles.teamRowUsername}>@{team.username}</Text>
                      )}
                    </View>
                  </View>

                  <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {/* Sección de Comentarios y Citar Liga al final */}
      <View style={styles.commentsSection}>
        <CommentsHeader count={comments.length} onQuote={handleShareLeagueToFeed} />

        {/* Caja para publicar comentarios */}
        {user && (
          <EntityCommentBox
            placeholder="Comenta sobre esta liga..."
            style={{ marginHorizontal: -theme.spacing.md }}
            onSendComment={handleSendComment}
          />
        )}

        {/* Listado de comentarios */}
        {comments.length === 0 ? (
          <View style={styles.emptyCommentsContainer}>
            <Feather name="message-square" size={24} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyTitle}>Aún no hay comentarios</Text>
            <Text style={styles.emptySub}>Sé la primera persona en comentar sobre este torneo.</Text>
          </View>
        ) : (
          comments.map((comment) => (
            <View key={comment.id} style={{ marginHorizontal: -theme.spacing.md }}>
              <PostCard
                post={comment}
                currentUser={user}
                hideTargetContext={true}
                onPress={() => navigation.push('PostDetail', { postId: comment.id })}
                onLikePress={() => toggleCommentLike(comment)}
                onDeletePress={() => handleDeleteComment(comment.id)}
                onAuthorPress={() => navigation.push('UserProfile', { userId: comment.author })}
              />
            </View>
          ))
        )}
      </View>

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
    paddingBottom: 60,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Cabecera
  headerSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  pollaBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  pollaBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  leagueName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  leagueHandle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  leagueBio: {
    color: '#aaaaaa',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
    marginVertical: 12,
  },
  tabItem: {
    paddingVertical: 10,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#ffffff',
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#ffffff',
  },

  // Sin paddingBottom: el divisor de <CommentsHeader> ya trae su propio margen
  // superior, y sumados dejaban un hueco enorme entre el contenido y los comentarios.
  tabContent: {
    paddingTop: 4,
  },
  stageSection: {
    marginBottom: 20,
  },
  // La última etapa no agrega separación extra por abajo, por el mismo motivo.
  stageSectionLast: {
    marginBottom: 0,
  },

  // Tabla de goleadores
  scorerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  scorerRowLast: {
    borderBottomWidth: 0,
  },
  scorerPos: {
    width: 20,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  scorerPosTop: {
    color: '#ffffff',
  },
  scorerInfo: {
    flex: 1,
  },
  scorerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dddddd',
  },
  scorerNameTop: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scorerTeam: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  scorerGoals: {
    minWidth: 24,
    fontSize: 15,
    fontWeight: '700',
    color: '#dddddd',
    textAlign: 'right',
  },
  scorerGoalsTop: {
    color: '#ffffff',
  },

  // Lista de Equipos
  teamItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  teamItemRowLast: {
    borderBottomWidth: 0,
  },
  teamRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  teamRowInfo: {
    flex: 1,
  },
  teamRowName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  teamRowUsername: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },

  // Sección de Comentarios
  // Sin borde propio: el separador de la sección lo pone <CommentsHeader>, uno solo
  // para todas las vistas (antes acá se sumaba un segundo borde).
  commentsSection: {},
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyCommentsContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginVertical: theme.spacing.sm,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
