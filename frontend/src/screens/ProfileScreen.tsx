import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image, DeviceEventEmitter, Alert, Platform, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb, getFileUrl } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { Feather } from '@expo/vector-icons';
import { PostCard } from '../components/PostCard';
import { QuoteModal } from '../components/QuoteModal';
import { withMinimumDelay } from '../utils/refresh';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile' | 'UserProfile'>;

export const ProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user: currentUser } = useAuth();
  
  // State para QuoteModal
  const [quoteModalVisible, setQuoteModalVisible] = useState(false);
  const [quoteTargetType, setQuoteTargetType] = useState<string | null>(null);
  const [quoteTargetId, setQuoteTargetId] = useState<string | null>(null);
  const [quoteTargetMeta, setQuoteTargetMeta] = useState<any | null>(null);
  const [quoteTargetRecord, setQuoteTargetRecord] = useState<any | null>(null);
  
  // Si no hay userId en los parámetros, usamos el id del usuario actual logueado
  const routeParams = route.params as any;
  const targetUserId = routeParams?.userId || currentUser?.id;

  const [profileUser, setProfileUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchProfileAndPosts(true));
    setRefreshing(false);
  }, [targetUserId]);

  const isFirstLoad = useRef(true);

  const fetchProfileAndPosts = async (hideLoading = false) => {
    if (!targetUserId) return;
    try {
      if (!hideLoading) setLoading(true);
      
      // 1. Obtener datos del usuario del perfil
      const userRes = await pb.collection('users').getOne(targetUserId);
      setProfileUser(userRes);

      // 2. Obtener publicaciones del usuario
      const postsRes = await pb.collection('posts').getList(1, 50, {
        filter: `author = "${targetUserId}" && deleted = false`,
        sort: '-created',
        expand: 'author,replyTo.author'
      });
      setPosts(postsRes.items);

      // 3. Obtener contadores de seguidores/siguiendo
      const followersRes = await pb.collection('follows').getList(1, 1, {
        filter: `following = "${targetUserId}"`
      });
      setFollowersCount(followersRes.totalItems);

      if (userRes.type === 'student') {
        const followingRes = await pb.collection('follows').getList(1, 1, {
          filter: `follower = "${targetUserId}"`
        });
        setFollowingCount(followingRes.totalItems);
      } else {
        setFollowingCount(0);
      }

      // 4. Verificar si el usuario actual sigue a este perfil
      if (currentUser && currentUser.id !== targetUserId) {
        const isFollowingRes = await pb.collection('follows').getList(1, 1, {
          filter: `follower = "${currentUser.id}" && following = "${targetUserId}"`
        });
        setIsFollowing(isFollowingRes.totalItems > 0);
      } else {
        setIsFollowing(false);
      }
    } catch (err) {
      console.error('Error fetching profile and posts', err);
    } finally {
      if (!hideLoading) setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser || !targetUserId || currentUser.id === targetUserId) return;
    try {
      setFollowLoading(true);
      if (isFollowing) {
        // Dejar de seguir (Delete record)
        const followRecordRes = await pb.collection('follows').getList(1, 1, {
          filter: `follower = "${currentUser.id}" && following = "${targetUserId}"`
        });
        if (followRecordRes.items.length > 0) {
          await pb.collection('follows').delete(followRecordRes.items[0].id);
          setIsFollowing(false);
          setFollowersCount(prev => Math.max(0, prev - 1));
        }
      } else {
        // Seguir (Create record)
        await pb.collection('follows').create({
          follower: currentUser.id,
          following: targetUserId
        });
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error toggling follow status', err);
    } finally {
      setFollowLoading(false);
    }
  };

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchProfileAndPosts(true));
      setLoading(false);
    });
    return () => sub.remove();
  }, [targetUserId]);

  useFocusEffect(
    useCallback(() => {
      fetchProfileAndPosts(!isFirstLoad.current);
      isFirstLoad.current = false;
    }, [targetUserId])
  );

  const toggleLike = async (post: any) => {
    if (!currentUser) return;
    try {
      const currentLikes = post.likes || [];
      let newLikes = [...currentLikes];
      if (newLikes.includes(currentUser.id)) {
        newLikes = newLikes.filter((id: string) => id !== currentUser.id);
      } else {
        newLikes.push(currentUser.id);
      }
      await pb.collection('posts').update(post.id, { likes: newLikes });
      
      setPosts(posts.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));
    } catch (err) {
      console.error('Error liking post', err);
      setPosts(posts.map(p => p.id === post.id ? { ...p, likes: post.likes || [] } : p));
    }
  };

  const performDelete = async (postId: string) => {
    try {
      setPosts(currentPosts => currentPosts.filter(p => p.id !== postId));
      await pb.collection('posts').update(postId, { deleted: true });
      DeviceEventEmitter.emit('onGlobalRefresh');
    } catch (err) {
      console.error('Error soft-deleting post', err);
      fetchProfileAndPosts(true);
    }
  };

  const handleRepost = (targetPost: any) => {
    if (!currentUser) {
      Toast.show({ type: 'info', text1: 'Autenticación requerida', text2: 'Inicia sesión para repostear.' });
      return;
    }
    setQuoteTargetType('post');
    setQuoteTargetId(targetPost.id);
    setQuoteTargetMeta({
      authorName: targetPost.expand?.author?.name || 'Usuario',
      authorUsername: targetPost.expand?.author?.username || '',
      authorAvatar: targetPost.expand?.author?.avatar || '',
      content: targetPost.content,
      photo: targetPost.photo,
    });
    setQuoteTargetRecord(targetPost);
    setQuoteModalVisible(true);
  };

  const handleTargetPress = (targetType?: string, targetId?: string) => {
    if (!targetType || !targetId) return;
    if (targetType === 'post') {
      navigation.push('PostDetail', { postId: targetId });
    } else if (targetType === 'problem') {
      navigation.push('ProblemDetail', { problemId: targetId });
    } else if (targetType === 'match') {
      navigation.push('LadderMatchDetail', { matchId: targetId });
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr.replace(' ', 'T'));
    return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute:'2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.noPostsText}>Usuario no encontrado.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.feedList} 
        contentContainerStyle={styles.feedContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={{ marginBottom: theme.spacing.md }}>
            <Avatar user={profileUser} size={80} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profileUser.name}</Text>
            {!!profileUser.username && <Text style={styles.profileUsername}>@{profileUser.username}</Text>}
            
            {profileUser.type === 'organization' ? (
              <View style={styles.orgBadge}>
                <Text style={styles.orgBadgeText}>
                  {profileUser.subtype === 'center' ? 'Centro de Estudiantes' :
                   profileUser.subtype === 'team' ? 'Equipo Oficial' :
                   profileUser.subtype === 'community' ? 'Comunidad libre' :
                   'Organización'}
                </Text>
              </View>
            ) : (
              <Text style={styles.profileCareer}>Estudiante</Text>
            )}

            {!!profileUser.description && (
              <Text style={styles.profileBio}>{profileUser.description}</Text>
            )}
          </View>

          {currentUser && currentUser.id !== targetUserId && currentUser.type !== 'organization' && (
            <TouchableOpacity 
              style={[
                styles.followBtn, 
                isFollowing ? styles.followBtnActive : styles.followBtnInactive
              ]} 
              onPress={handleFollowToggle}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? theme.colors.text : '#000000'} />
              ) : (
                <Text style={[
                  styles.followBtnText, 
                  isFollowing ? styles.followBtnTextActive : styles.followBtnTextInactive
                ]}>
                  {isFollowing ? 'Siguiendo' : 'Seguir'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statCount}>{posts.length}</Text>
              <Text style={styles.statLabel}>Publicaciones</Text>
            </View>
            <TouchableOpacity 
              style={styles.statBox}
              activeOpacity={0.7}
              onPress={() => navigation.push('FollowList', { userId: targetUserId, type: 'followers', username: profileUser.username })}
            >
              <Text style={styles.statCount}>{followersCount}</Text>
              <Text style={styles.statLabel}>Seguidores</Text>
            </TouchableOpacity>
            {profileUser.type === 'student' && (
              <TouchableOpacity 
                style={styles.statBox}
                activeOpacity={0.7}
                onPress={() => navigation.push('FollowList', { userId: targetUserId, type: 'following', username: profileUser.username })}
              >
                <Text style={styles.statCount}>{followingCount}</Text>
                <Text style={styles.statLabel}>Siguiendo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* User Posts */}
        {posts.length === 0 ? (
          <Text style={styles.noPostsText}>Este usuario aún no ha publicado nada.</Text>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onPress={() => navigation.push('PostDetail', { postId: post.id })}
              onLikePress={() => toggleLike(post)}
              onDeletePress={() => setDeleteConfirmPostId(post.id)}
              onAuthorPress={() => navigation.push('UserProfile', { userId: post.author })}
              onRepostPress={() => handleRepost(post)}
              onTargetPress={() => handleTargetPress(post.targetType, post.targetId)}
            />
          ))
        )}
      </ScrollView>

      {/* Modal de confirmación de eliminación customizado */}
      {deleteConfirmPostId !== null && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Feather name="alert-triangle" size={24} color={theme.colors.error} style={{ marginRight: 10 }} />
              <Text style={styles.modalTitle}>¿Eliminar publicación?</Text>
            </View>
            <Text style={styles.modalBody}>
              Esta acción es permanente para los demás usuarios. El contenido y archivos adjuntos se ocultarán, pero el hilo y sus comentarios se mantendrán para preservar la conversación.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnCancel]} 
                onPress={() => setDeleteConfirmPostId(null)}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnDelete]} 
                onPress={() => {
                  if (deleteConfirmPostId) {
                    performDelete(deleteConfirmPostId);
                    setDeleteConfirmPostId(null);
                  }
                }}
              >
                <Text style={styles.modalBtnDeleteText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <QuoteModal
        visible={quoteModalVisible}
        targetType={quoteTargetType}
        targetId={quoteTargetId}
        targetMeta={quoteTargetMeta}
        targetRecord={quoteTargetRecord}
        onClose={() => setQuoteModalVisible(false)}
        onSuccess={() => fetchProfileAndPosts(true)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  feedList: { flex: 1 },
  feedContent: { paddingBottom: theme.spacing.xl },
  
  profileHeader: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.cardBg,
  },
  profileName: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 4, textAlign: 'center' },
  profileInfo: { alignItems: 'center', width: '100%' },
  profileCareer: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  orgBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 8,
  },
  orgBadgeText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  profileUsername: { fontSize: 15, color: theme.colors.textMuted, marginBottom: 8, textAlign: 'center' },
  profileBio: {
    fontSize: 14,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
    width: 280,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statCount: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  followBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    minWidth: 100,
    borderWidth: 1,
  },
  followBtnInactive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  followBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  followBtnTextInactive: {
    color: '#000000',
  },
  followBtnTextActive: {
    color: theme.colors.text,
  },
  
  backBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.md,
    marginTop: 20,
  },
  backBtnText: {
    color: '#000000',
    fontWeight: 'bold',
  },

  divider: { height: 1, backgroundColor: theme.colors.border },
  
  noPostsText: { padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textMuted, fontStyle: 'italic' },
  
  postCard: { padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border, position: 'relative' },
  postHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  postMeta: { justifyContent: 'center' },
  postAuthor: { color: theme.colors.text, fontWeight: '700', fontSize: 15 },
  postUsername: { color: theme.colors.textMuted, fontSize: 13 },
  postDate: { color: theme.colors.textMuted, fontSize: 12 },
  replyContextText: { color: theme.colors.textMuted, fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  postContent: { color: theme.colors.text, fontSize: 15, lineHeight: 22, marginBottom: theme.spacing.sm },
  
  postImage: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.sm },
  tagChip: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8, marginBottom: 8 },
  tagChipText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  
  postActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.lg },
  actionIcon: { fontSize: 14, marginRight: 6 },
  actionIconActive: { color: theme.colors.primary },
  actionCount: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '500' },
  dropdownMenu: {
    position: 'absolute',
    right: 16,
    top: 48,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 4,
    zIndex: 1000,
    minWidth: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  dropdownItemText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  modalCard: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: theme.colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 95,
  },
  modalBtnCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalBtnCancelText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  modalBtnDelete: {
    backgroundColor: theme.colors.error,
  },
  modalBtnDeleteText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
