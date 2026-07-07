import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb, getFileUrl } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { ImageViewer } from '../components/ImageViewer';
import { Avatar } from '../components/Avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile' | 'UserProfile'>;

export const ProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user: currentUser } = useAuth();
  
  // Si no hay userId en los parámetros, usamos el id del usuario actual logueado
  const routeParams = route.params as any;
  const targetUserId = routeParams?.userId || currentUser?.id;

  const [profileUser, setProfileUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);

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
        filter: `author = "${targetUserId}"`,
        sort: '-created',
        expand: 'author,replyTo.author'
      });
      setPosts(postsRes.items);
    } catch (err) {
      console.error('Error fetching profile and posts', err);
    } finally {
      if (!hideLoading) setLoading(false);
    }
  };

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', () => {
      fetchProfileAndPosts(true);
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr.replace(' ', 'T'));
    return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute:'2-digit' });
  };

  if (loading && isFirstLoad.current) {
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
      <ScrollView style={styles.feedList} contentContainerStyle={styles.feedContent}>
        
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
          <Text style={styles.statsText}>{posts.length} Publicaciones</Text>
        </View>

        <View style={styles.divider} />

        {/* User Posts */}
        {posts.length === 0 ? (
          <Text style={styles.noPostsText}>Este usuario aún no ha publicado nada.</Text>
        ) : (
          posts.map(post => {
            const isLiked = currentUser && (post.likes || []).includes(currentUser.id);
            const author = post.expand?.author;
            const repliesCount = post.commentCount || 0;
            
            return (
              <TouchableOpacity 
                key={post.id} 
                style={styles.postCard} 
                activeOpacity={0.7}
                onPress={() => navigation.push('PostDetail', { postId: post.id })}
              >
                <View style={styles.postHeaderRow}>
                  <TouchableOpacity 
                    onPress={() => navigation.push('UserProfile', { userId: post.author })}
                    activeOpacity={0.7}
                  >
                    <View style={{ marginRight: theme.spacing.sm }}>
                      <Avatar user={author} size={40} />
                    </View>
                  </TouchableOpacity>
                  <View style={styles.postMeta}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity 
                        onPress={() => navigation.push('UserProfile', { userId: post.author })}
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                      >
                        <Text style={styles.postAuthor}>{author?.name || 'Usuario'}</Text>
                        {author?.username ? <Text style={styles.postUsername}> @{author.username}</Text> : null}
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.postDate}>{formatDate(post.created)}</Text>
                  </View>
                </View>
                
                {post.replyTo && post.expand?.replyTo?.expand?.author ? (
                  <Text style={styles.replyContextText}>
                    En respuesta a @{post.expand.replyTo.expand.author.username}
                  </Text>
                ) : null}
                
                <Text style={styles.postContent}>{post.content}</Text>
                
                {post.photo && (
                  <TouchableOpacity 
                    activeOpacity={0.9}
                    onPress={() => {
                      setViewerImageUrl(getFileUrl(post, post.photo));
                      setViewerVisible(true);
                    }}
                  >
                    <Image 
                      source={{ uri: getFileUrl(post, post.photo) }} 
                      style={styles.postImage}
                    />
                  </TouchableOpacity>
                )}
                
                <View style={styles.postActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post)}>
                    <Text style={[styles.actionIcon, isLiked && styles.actionIconActive]}>
                      {isLiked ? '❤️' : '🤍'}
                    </Text>
                    <Text style={styles.actionCount}>
                      {post.likes?.length || 0}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.actionBtn}>
                    <Text style={styles.actionIcon}>💬</Text>
                    <Text style={styles.actionCount}>{repliesCount}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {viewerImageUrl && (
        <ImageViewer 
          visible={viewerVisible} 
          imageUrl={viewerImageUrl} 
          onClose={() => {
            setViewerVisible(false);
            setViewerImageUrl(null);
          }} 
        />
      )}
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
  profileName: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  profileInfo: { alignItems: 'center' },
  profileCareer: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 4,
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
  profileUsername: { fontSize: 15, color: theme.colors.textMuted, marginBottom: 8 },
  profileBio: {
    fontSize: 14,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    lineHeight: 20,
  },
  statsText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginTop: theme.spacing.md },
  
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
  
  postCard: { padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
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
    resizeMode: 'cover',
  },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.sm },
  tagChip: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8, marginBottom: 8 },
  tagChipText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  
  postActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.lg },
  actionIcon: { fontSize: 14, marginRight: 6 },
  actionIconActive: { color: theme.colors.primary },
  actionCount: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '500' },
});
