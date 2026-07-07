import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb, getFileUrl } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { ImageViewer } from '../components/ImageViewer';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuth();
  
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);

  const isFirstLoad = useRef(true);

  const fetchPosts = async (hideLoading = false) => {
    if (!user) return;
    try {
      if (!hideLoading) setLoading(true);
      const postsRes = await pb.collection('posts').getList(1, 50, {
        filter: `author = "${user.id}"`,
        sort: '-created',
        expand: 'author,replyTo.author'
      });
      setPosts(postsRes.items);
    } catch (err) {
      console.error('Error fetching user posts', err);
    } finally {
      if (!hideLoading) setLoading(false);
    }
  };

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', () => {
      fetchPosts(false);
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPosts(!isFirstLoad.current);
      isFirstLoad.current = false;
    }, [])
  );

  const toggleLike = async (post: any) => {
    if (!user) return;
    try {
      const currentLikes = post.likes || [];
      let newLikes = [...currentLikes];
      if (newLikes.includes(user.id)) {
        newLikes = newLikes.filter((id: string) => id !== user.id);
      } else {
        newLikes.push(user.id);
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

  const handleLogout = () => {
    logout();
    navigation.navigate('Home');
  };

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.noPostsText}>Inicia sesión para ver tu perfil.</Text>
        <TouchableOpacity style={{ backgroundColor: theme.colors.primary, padding: 12, borderRadius: 4 }} onPress={() => navigation.navigate('Login')}>
          <Text style={{ color: '#000', fontWeight: 'bold' }}>Iniciar Sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <ScrollView style={styles.feedList} contentContainerStyle={styles.feedContent}>
        
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileUsername}>@{user.username}</Text>
            {user.type === 'organization' ? (
              <View style={styles.orgBadge}>
                <Text style={styles.orgBadgeText}>
                  {user.subtype === 'center' ? 'Centro de Estudiantes' :
                   user.subtype === 'team' ? 'Equipo Oficial' :
                   user.subtype === 'community' ? 'Comunidad libre' :
                   'Organización'}
                </Text>
              </View>
            ) : (
              <Text style={styles.profileCareer}>Estudiante</Text>
            )}
          </View>
          <Text style={styles.statsText}>{posts.length} Publicaciones</Text>
        </View>

        <View style={styles.divider} />

        {/* User Posts */}
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
        ) : posts.length === 0 ? (
          <Text style={styles.noPostsText}>Aún no has publicado nada.</Text>
        ) : (
          posts.map(post => {
            const isLiked = (post.likes || []).includes(user.id);
            const author = post.expand?.author;
            const repliesCount = post.commentCount || 0;
            
            return (
              <TouchableOpacity 
                key={post.id} 
                style={styles.postCard} 
                activeOpacity={0.7}
                onPress={() => navigation.push('PostDetail', { postId: post.id })}
              >
                <View style={styles.postHeader}>
                  <TouchableOpacity 
                    onPress={() => navigation.push('UserProfile', { userId: post.author })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.avatarMini}>
                      <Text style={styles.avatarMiniText}>{author?.name ? author.name.charAt(0).toUpperCase() : 'U'}</Text>
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
                
                {!!post.photo && (
                  <TouchableOpacity 
                    activeOpacity={0.8} 
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
                
                {post.tags && post.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {post.tags.map((t: string, i: number) => (
                      <View key={i} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>#{t}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.postActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post)}>
                    <Text style={styles.actionIcon}>{isLiked ? '❤️' : '🤍'}</Text>
                    <Text style={[styles.actionCount, isLiked && styles.actionIconActive]}>
                      {(post.likes || []).length}
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

      <ImageViewer 
        visible={viewerVisible}
        imageUrl={viewerImageUrl}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centerContainer: { flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  backBtn: { width: 60 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  
  feedList: { flex: 1 },
  feedContent: { paddingBottom: theme.spacing.xl },
  
  profileHeader: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.cardBg,
  },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 8,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarLargeText: { color: '#000', fontSize: 36, fontWeight: '800' },
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
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  orgBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  profileUsername: { fontSize: 15, color: theme.colors.textMuted, marginBottom: 8 },
  profileEmail: { fontSize: 14, color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
  statsContainer: { fontSize: 14, color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
  statsText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  
  logoutButton: {
    marginTop: theme.spacing.lg,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 4,
  },
  logoutButtonText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 13,
  },

  divider: { height: 1, backgroundColor: theme.colors.border },
  
  noPostsText: { padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textMuted, fontStyle: 'italic' },
  
  postCard: { padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  avatarMini: { width: 40, height: 40, borderRadius: 4, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: theme.spacing.sm },
  avatarMiniText: { color: '#000', fontSize: 18, fontWeight: '700' },
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
