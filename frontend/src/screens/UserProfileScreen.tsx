import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { theme } from './HomeScreen';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export const UserProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userId } = route.params;
  const { user: currentUser } = useAuth();
  
  const [profileUser, setProfileUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isFirstLoad = useRef(true);

  const fetchProfileAndPosts = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      // 1. Fetch user data
      const userRes = await pb.collection('users').getOne(userId);
      setProfileUser(userRes);

      // 2. Fetch their posts
      const postsRes = await pb.collection('posts').getList(1, 50, {
        filter: `author = "${userId}"`,
        sort: '-created',
        expand: 'author,replyTo.author,posts_via_replyTo'
      });
      setPosts(postsRes.items);
    } catch (err) {
      console.error('Error fetching user profile', err);
    } finally {
      if (!hideLoading) setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfileAndPosts(!isFirstLoad.current);
      isFirstLoad.current = false;
    }, [userId])
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
      
      // Update local state without full reload
      setPosts(posts.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));
    } catch (err) {
      console.error('Error liking post', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute:'2-digit' });
  };

  if (loading || !profileUser) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil de Usuario</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.feedList} contentContainerStyle={styles.feedContent}>
        
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {profileUser.name ? profileUser.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <Text style={styles.profileName}>{profileUser.name || 'Usuario'}</Text>
          {profileUser?.username ? <Text style={styles.profileUsername}>@{profileUser.username}</Text> : null}
          {currentUser && currentUser.id === profileUser.id && (
            <Text style={styles.profileEmail}>{profileUser.email}</Text>
          )}
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
            const repliesCount = post.expand?.posts_via_replyTo ? post.expand.posts_via_replyTo.length : 0;
            
            return (
              <TouchableOpacity 
                key={post.id} 
                style={styles.postCard} 
                activeOpacity={0.7}
                onPress={() => navigation.push('PostDetail', { postId: post.id })}
              >
                <View style={styles.postHeader}>
                  <View style={styles.avatarMini}>
                    <Text style={styles.avatarMiniText}>{author?.name ? author.name.charAt(0).toUpperCase() : 'U'}</Text>
                  </View>
                  <View style={styles.postMeta}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.postAuthor}>{author?.name || 'Usuario'}</Text>
                      {author?.username ? <Text style={styles.postUsername}> @{author.username}</Text> : null}
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
  backBtnText: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '600' },
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
  profileUsername: { fontSize: 15, color: theme.colors.textMuted, marginBottom: 8 },
  profileEmail: { fontSize: 14, color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
  statsText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  
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
  
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.sm },
  tagChip: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8, marginBottom: 8 },
  tagChipText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  
  postActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.lg },
  actionIcon: { fontSize: 14, marginRight: 6 },
  actionIconActive: { color: '#ef4444' },
  actionCount: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '500' },
});
