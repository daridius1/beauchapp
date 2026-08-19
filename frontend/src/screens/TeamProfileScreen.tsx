import React, { useCallback, useEffect, useState } from 'react';
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
import { Feather, FontAwesome } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';
import { PostCard } from '../components/PostCard';
import { EntityCommentBox } from '../components/EntityCommentBox';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TeamCrest, matchDisplayName } from '../components/leagues/TeamCrest';
import { LeagueMatchRow, LeagueMatchRowData } from '../components/leagues/LeagueMatchRow';
import { teamPlayersService, TeamPlayerRecord } from '../services/teamPlayersService';

type Props = NativeStackScreenProps<RootStackParamList, 'TeamProfile'>;

export const TeamProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { teamId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teamUser, setTeamUser] = useState<any>(null);
  const [players, setPlayers] = useState<TeamPlayerRecord[]>([]);
  const [matches, setMatches] = useState<LeagueMatchRowData[]>([]);
  const [comments, setComments] = useState<any[]>([]);

  const fetchData = useCallback(
    async (isPullRefresh = false) => {
      try {
        if (!isPullRefresh) setLoading(true);

        const [userRes, playersRes, matchesRes, commentsRes] = await Promise.all([
          pb.collection('users').getOne(teamId).catch(() => null),
          teamPlayersService.listTeamPlayers(teamId),
          pb.collection('league_matches').getList(1, 50, {
            filter: `(teamA = "${teamId}" || teamB = "${teamId}") && deleted = false`,
            sort: '-blockCode',
            expand: 'teamA,teamB,stage',
          }).catch(() => ({ items: [] })),
          pb.collection('posts').getList(1, 50, {
            filter: `targetType = "team" && targetId = "${teamId}" && actionType = "comment" && deleted = false`,
            sort: '+created',
            expand: 'author',
          }).catch(() => ({ items: [] })),
        ]);

        setTeamUser(userRes);
        setPlayers(playersRes);
        setMatches(matchesRes.items as LeagueMatchRowData[]);
        setComments(commentsRes.items);
      } catch (err) {
        console.error('Error cargando el perfil del equipo:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [teamId]
  );

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Botón de refrescar del navbar — el header lo muestra para 'TeamProfile' (App.tsx),
  // pero solo funciona si la pantalla escucha este evento (mismo patrón que el resto de
  // pantallas de liga).
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await fetchData(true);
      setLoading(false);
    });
    return () => sub.remove();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchData(true), 400);
  }, [fetchData]);

  const teamName = matchDisplayName(teamUser, 'Equipo');

  // Citar equipo al feed
  const handleShareTeamToFeed = () => {
    if (!teamUser) return;
    if (!user) {
      Toast.show({ type: 'info', text1: 'Inicia sesión', text2: 'Debes iniciar sesión para citar.' });
      return;
    }

    navigation.navigate('Home', {
      quoteTargetType: 'team',
      quoteTargetId: teamId,
      quoteTargetMeta: {
        name: teamUser.name,
        matchAlias: teamUser.matchAlias,
        username: teamUser.username,
        matchPhoto: teamUser.matchPhoto,
        avatar: teamUser.avatar,
      },
    });
  };

  // Publicar comentario sobre el equipo
  const handleSendComment = async (content: string, photo: File | null, pollOptions: string[] | null) => {
    if (!user) return;
    try {
      const postData: any = {
        author: user.id,
        actionType: 'comment',
        targetType: 'team',
        targetId: teamId,
        content: content.trim() || ' ',
        targetMeta: {
          name: teamUser?.name,
          matchAlias: teamUser?.matchAlias,
          username: teamUser?.username,
          matchPhoto: teamUser?.matchPhoto,
          avatar: teamUser?.avatar,
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

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

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
      {/* Cabecera del equipo — lleva al perfil de cuenta beauchapp del equipo */}
      <TouchableOpacity
        style={styles.headerSection}
        activeOpacity={0.7}
        onPress={() => navigation.push('UserProfile', { userId: teamId })}
      >
        <TeamCrest team={teamUser} size={80} />
        <View style={styles.headerInfo}>
          <Text style={styles.teamName}>{teamName}</Text>
          {!!teamUser?.username && <Text style={styles.teamHandle}>@{teamUser.username}</Text>}
        </View>
      </TouchableOpacity>

      {/* Sección de Jugadores */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Jugadores ({players.length})</Text>
        {players.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Este equipo todavía no tiene jugadores en su plantel.</Text>
          </View>
        ) : (
          players.map((player, idx) => {
            const linkedUserId = player.user;
            return (
              <TouchableOpacity
                key={player.id}
                style={[styles.playerRow, idx === players.length - 1 && styles.playerRowLast]}
                activeOpacity={linkedUserId ? 0.7 : 1}
                disabled={!linkedUserId}
                onPress={() => linkedUserId && navigation.push('UserProfile', { userId: linkedUserId })}
              >
                <PlayerAvatar player={player} size={44} />
                <Text style={styles.playerName}>{player.name}</Text>
                {!!linkedUserId && <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Sección de Partidos */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Partidos ({matches.length})</Text>
        {matches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Este equipo todavía no tiene partidos programados.</Text>
          </View>
        ) : (
          matches.map((m, idx) => (
            <LeagueMatchRow
              key={m.id}
              match={m}
              isLast={idx === matches.length - 1}
              onPress={() => navigation.push('LeagueMatchDetail', { matchId: m.id })}
            />
          ))
        )}
      </View>

      {/* Sección de Comentarios y Citar equipo */}
      <View style={styles.commentsSection}>
        <View style={styles.commentsHeaderRow}>
          <Text style={styles.sectionHeader}>Comentarios ({comments.length})</Text>

          <TouchableOpacity
            style={styles.quoteHeaderBtn}
            activeOpacity={0.7}
            onPress={handleShareTeamToFeed}
          >
            <FontAwesome name="quote-left" size={11} color={theme.colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.quoteHeaderBtnText}>Citar</Text>
          </TouchableOpacity>
        </View>

        {user && (
          <EntityCommentBox
            placeholder="Comenta sobre este equipo..."
            style={{ marginHorizontal: -theme.spacing.md }}
            onSendComment={handleSendComment}
          />
        )}

        {comments.length === 0 ? (
          <View style={styles.emptyCommentsContainer}>
            <Feather name="message-square" size={24} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyTitle}>Aún no hay comentarios</Text>
            <Text style={styles.emptySub}>Sé la primera persona en comentar sobre este equipo.</Text>
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
    paddingVertical: 24,
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
    alignItems: 'center',
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerInfo: {
    flex: 1,
  },
  teamName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  teamHandle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },

  section: {
    marginTop: 20,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Lista de jugadores
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
    marginTop: 8,
  },
  playerRowLast: {
    borderBottomWidth: 0,
  },
  playerName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
