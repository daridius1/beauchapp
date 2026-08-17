import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather, FontAwesome } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';
import { EntityCommentBox } from '../components/EntityCommentBox';
import { LeagueMatchRow, LeagueMatchRowData } from '../components/leagues/LeagueMatchRow';
import { LeagueStandingsTable } from '../components/leagues/LeagueStandingsTable';

type Props = NativeStackScreenProps<RootStackParamList, 'LeagueDetail'>;

type TabType = 'matches' | 'standings' | 'teams';
type MatchStatusFilter = 'all' | 'upcoming' | 'played';

export const LeagueDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { leagueId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leagueUser, setLeagueUser] = useState<any>(null);
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<LeagueMatchRowData[]>([]);
  const [comments, setComments] = useState<any[]>([]);

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<TabType>('matches');

  // Filtros como selectores
  const [selectedStageId, setSelectedStageId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<MatchStatusFilter>('all');

  // Modales de selección
  const [showStageModal, setShowStageModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const fetchData = useCallback(
    async (isPullRefresh = false) => {
      try {
        if (!isPullRefresh) setLoading(true);

        const [userRes, stagesRes, teamsRes, matchesRes, commentsRes] = await Promise.all([
          pb.collection('users').getOne(leagueId).catch(() => null),
          pb.collection('league_stages').getFullList({
            filter: `league = "${leagueId}"`,
            sort: 'created',
          }).catch(() => []),
          pb.collection('league_teams').getFullList({
            filter: `league = "${leagueId}"`,
            expand: 'team',
            sort: 'created',
          }).catch(() => []),
          pb.collection('league_matches').getList(1, 200, {
            filter: `league = "${leagueId}"`,
            sort: '-created',
            expand: 'teamA,teamB,stage',
          }).catch(() => ({ items: [] })),
          pb.collection('posts').getList(1, 50, {
            filter: `targetType = "league" && targetId = "${leagueId}" && actionType = "comment" && deleted = false`,
            sort: '+created',
            expand: 'author',
          }).catch(() => ({ items: [] })),
        ]);

        setLeagueUser(userRes);
        setStages((stagesRes as any[]).map((s) => ({ id: s.id, name: s.name || 'Etapa' })));
        setTeams(teamsRes);
        setMatches(matchesRes.items as LeagueMatchRowData[]);
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

  // Partidos filtrados
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // Filtro por etapa
      if (selectedStageId !== 'all') {
        const matchStageId = m.expand?.stage?.id || m.stage;
        if (matchStageId !== selectedStageId) return false;
      }

      // Filtro por estado
      if (statusFilter === 'upcoming') return m.status === 'confirmed';
      if (statusFilter === 'played') return m.status === 'played';

      return true;
    });
  }, [matches, selectedStageId, statusFilter]);

  const playedCount = useMemo(() => matches.filter((m) => m.status === 'played').length, [matches]);
  const upcomingCount = useMemo(() => matches.filter((m) => m.status === 'confirmed').length, [matches]);

  const selectedStageName = useMemo(() => {
    if (selectedStageId === 'all') return 'Todas las etapas';
    const found = stages.find((s) => s.id === selectedStageId);
    return found?.name || 'Etapa';
  }, [selectedStageId, stages]);

  const selectedStatusName = useMemo(() => {
    if (statusFilter === 'all') return 'Todos';
    if (statusFilter === 'upcoming') return 'Por jugar';
    if (statusFilter === 'played') return 'Finalizados';
    return 'Todos';
  }, [statusFilter]);

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
      {/* Cabecera Principal de la Liga */}
      <TouchableOpacity
        style={styles.headerSection}
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
            Posiciones
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
          {/* Fila de Selectores (Etapa + Estado) */}
          <View style={styles.selectorsRow}>
            {/* Selector de Etapa */}
            <TouchableOpacity
              style={styles.selectorBtn}
              onPress={() => setShowStageModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.selectorBtnContent}>
                <Text style={styles.selectorLabel}>Etapa</Text>
                <Text style={styles.selectorValue} numberOfLines={1}>
                  {selectedStageName}
                </Text>
              </View>
              <Feather name="chevron-down" size={14} color={theme.colors.textMuted} />
            </TouchableOpacity>

            {/* Selector de Estado */}
            <TouchableOpacity
              style={styles.selectorBtn}
              onPress={() => setShowStatusModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.selectorBtnContent}>
                <Text style={styles.selectorLabel}>Estado</Text>
                <Text style={styles.selectorValue} numberOfLines={1}>
                  {selectedStatusName}
                </Text>
              </View>
              <Feather name="chevron-down" size={14} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Listado de Partidos */}
          {filteredMatches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay partidos con los filtros seleccionados.</Text>
            </View>
          ) : (
            filteredMatches.map((m, idx) => (
              <LeagueMatchRow
                key={m.id}
                match={m}
                isLast={idx === filteredMatches.length - 1}
                onPress={() => navigation.push('LeagueMatchDetail', { matchId: m.id })}
                onPressTeamA={
                  m.expand?.teamA
                    ? () => navigation.push('UserProfile', { userId: m.expand!.teamA!.id })
                    : undefined
                }
                onPressTeamB={
                  m.expand?.teamB
                    ? () => navigation.push('UserProfile', { userId: m.expand!.teamB!.id })
                    : undefined
                }
              />
            ))
          )}
        </View>
      )}

      {/* 2. PESTAÑA: POSICIONES */}
      {activeTab === 'standings' && (
        <View style={styles.tabContent}>
          <LeagueStandingsTable
            teams={teams}
            matches={matches}
            onPressTeam={(teamId) => navigation.push('UserProfile', { userId: teamId })}
          />
        </View>
      )}

      {/* 3. PESTAÑA: EQUIPOS */}
      {activeTab === 'teams' && (
        <View style={styles.tabContent}>
          {teams.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay equipos inscritos en esta liga aún.</Text>
            </View>
          ) : (
            teams.map((item, idx) => {
              const team = item.expand?.team;
              const name = team?.name || team?.username || 'Equipo';
              const isLast = idx === teams.length - 1;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.teamItemRow, isLast && styles.teamItemRowLast]}
                  onPress={() => {
                    if (team?.id) {
                      navigation.push('UserProfile', { userId: team.id });
                    }
                  }}
                  activeOpacity={0.7}
                  disabled={!team?.id}
                >
                  <View style={styles.teamRowLeft}>
                    <Avatar
                      user={{
                        id: team?.id,
                        collectionId: 'users',
                        avatar: team?.avatar,
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
        <View style={styles.commentsHeaderRow}>
          <Text style={styles.sectionHeader}>Comentarios ({comments.length})</Text>

          <TouchableOpacity
            style={styles.quoteHeaderBtn}
            activeOpacity={0.7}
            onPress={handleShareLeagueToFeed}
          >
            <FontAwesome name="quote-left" size={11} color={theme.colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.quoteHeaderBtnText}>Citar</Text>
          </TouchableOpacity>
        </View>

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

      {/* Modal Selector de Etapa */}
      <Modal
        visible={showStageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStageModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowStageModal(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalHeaderTitle}>Filtrar por Etapa</Text>

            <TouchableOpacity
              style={[
                styles.modalOptionRow,
                selectedStageId === 'all' && styles.modalOptionRowActive,
              ]}
              onPress={() => {
                setSelectedStageId('all');
                setShowStageModal(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  selectedStageId === 'all' && styles.modalOptionTextActive,
                ]}
              >
                Todas las etapas
              </Text>
              {selectedStageId === 'all' && (
                <Feather name="check" size={15} color="#000000" />
              )}
            </TouchableOpacity>

            {stages.map((stg) => {
              const isSelected = selectedStageId === stg.id;
              return (
                <TouchableOpacity
                  key={stg.id}
                  style={[
                    styles.modalOptionRow,
                    isSelected && styles.modalOptionRowActive,
                  ]}
                  onPress={() => {
                    setSelectedStageId(stg.id);
                    setShowStageModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isSelected && styles.modalOptionTextActive,
                    ]}
                  >
                    {stg.name}
                  </Text>
                  {isSelected && (
                    <Feather name="check" size={15} color="#000000" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Selector de Estado */}
      <Modal
        visible={showStatusModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalHeaderTitle}>Filtrar por Estado</Text>

            <TouchableOpacity
              style={[
                styles.modalOptionRow,
                statusFilter === 'all' && styles.modalOptionRowActive,
              ]}
              onPress={() => {
                setStatusFilter('all');
                setShowStatusModal(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  statusFilter === 'all' && styles.modalOptionTextActive,
                ]}
              >
                Todos los partidos ({matches.length})
              </Text>
              {statusFilter === 'all' && (
                <Feather name="check" size={15} color="#000000" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalOptionRow,
                statusFilter === 'upcoming' && styles.modalOptionRowActive,
              ]}
              onPress={() => {
                setStatusFilter('upcoming');
                setShowStatusModal(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  statusFilter === 'upcoming' && styles.modalOptionTextActive,
                ]}
              >
                Por jugar ({upcomingCount})
              </Text>
              {statusFilter === 'upcoming' && (
                <Feather name="check" size={15} color="#000000" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalOptionRow,
                statusFilter === 'played' && styles.modalOptionRowActive,
              ]}
              onPress={() => {
                setStatusFilter('played');
                setShowStatusModal(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  statusFilter === 'played' && styles.modalOptionTextActive,
                ]}
              >
                Finalizados ({playedCount})
              </Text>
              {statusFilter === 'played' && (
                <Feather name="check" size={15} color="#000000" />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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

  tabContent: {
    paddingTop: 4,
    paddingBottom: 16,
  },

  // Fila de Selectores
  selectorsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  selectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectorBtnContent: {
    flex: 1,
    marginRight: 6,
  },
  selectorLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  selectorValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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

  // Modales de Selección
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: theme.spacing.md,
  },
  modalHeaderTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 4,
  },
  modalOptionRowActive: {
    backgroundColor: '#ffffff',
  },
  modalOptionText: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOptionTextActive: {
    color: '#000000',
    fontWeight: '800',
  },

  // Sección de Comentarios
  commentsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  commentsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  quoteHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  quoteHeaderBtnText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
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
