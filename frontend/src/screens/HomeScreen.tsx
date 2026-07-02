import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';

export const theme = {
  colors: {
    primary: '#ffffff', // White accent
    background: '#000000', // Pure black background
    cardBg: '#0a0a0a', // Almost black cards
    text: '#ffffff', // Pure white text
    textMuted: '#888888', // Muted gray text
    border: '#222222', // Subtle dark border
    accent: '#ffffff', // White accents
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    md: 4,
    lg: 4,
  }
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const fetchPosts = async () => {
    try {
      const res = await pb.collection('posts').getList(1, 50, {
        sort: '-created',
        filter: 'replyTo = ""',
        expand: 'author'
      });
      setPosts(res.items);
    } catch (err) {
      console.error('Error fetching posts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handlePost = async () => {
    if (!content.trim() || !user) return;
    setPosting(true);
    try {
      const tagList = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
      await pb.collection('posts').create({
        content: content.trim(),
        tags: tagList,
        author: user.id
      });
      setContent('');
      setTagsInput('');
      fetchPosts();
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

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
      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute:'2-digit' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Muro de Beauchef</Text>
      </View>

      <ScrollView style={styles.feedList} contentContainerStyle={styles.feedContent}>
        {user ? (
          <View style={styles.composeBox}>
            <View style={styles.composeRow}>
              <View style={styles.avatarMini}>
                <Text style={styles.avatarMiniText}>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</Text>
              </View>
              <TextInput
                style={styles.composeInput}
                placeholder="¿Qué está pasando?"
                placeholderTextColor={theme.colors.textMuted}
                multiline
                maxLength={280}
                value={content}
                onChangeText={setContent}
              />
            </View>
            <View style={styles.composeFooter}>
              <TextInput
                style={styles.tagsInput}
                placeholder="Añadir tags (separados por coma)..."
                placeholderTextColor={theme.colors.textMuted}
                value={tagsInput}
                onChangeText={setTagsInput}
              />
              <TouchableOpacity 
                style={[styles.postBtn, (!content.trim() || posting) && styles.postBtnDisabled]}
                onPress={handlePost}
                disabled={!content.trim() || posting}
              >
                <Text style={styles.postBtnText}>{posting ? '...' : 'Publicar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.loginPrompt}>
            <Text style={styles.loginPromptText}>Inicia sesión para publicar en el muro.</Text>
            <TouchableOpacity style={styles.loginPromptBtn} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginPromptBtnText}>Iniciar Sesión</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          posts.map(post => {
            const isLiked = user && (post.likes || []).includes(user.id);
            const author = post.expand?.author;
            return (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <View style={styles.avatarMini}>
                    <Text style={styles.avatarMiniText}>{author?.name ? author.name.charAt(0).toUpperCase() : 'U'}</Text>
                  </View>
                  <View style={styles.postMeta}>
                    <Text style={styles.postAuthor}>{author?.name || 'Usuario'}</Text>
                    <Text style={styles.postDate}>{formatDate(post.created)}</Text>
                  </View>
                </View>
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
                    <Text style={styles.actionIcon}>
                      {isLiked ? '❤️' : '🤍'}
                    </Text>
                    <Text style={[styles.actionCount, isLiked && styles.actionIconActive]}>
                      {(post.likes || []).length}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn}>
                    <Text style={styles.actionIcon}>💬</Text>
                    <Text style={styles.actionCount}>Responder</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  feedList: {
    flex: 1,
  },
  feedContent: {
    paddingBottom: theme.spacing.xl,
  },
  composeBox: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.cardBg,
  },
  composeRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  avatarMini: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  avatarMiniText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  composeInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  composeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.3)',
    paddingTop: theme.spacing.sm,
  },
  tagsInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    marginRight: theme.spacing.md,
  },
  postBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  postBtnDisabled: {
    opacity: 0.5,
  },
  postBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  loginPrompt: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  loginPromptText: {
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  loginPromptBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  loginPromptBtnText: {
    color: '#000',
    fontWeight: '700',
  },
  postCard: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  postMeta: {
    justifyContent: 'center',
  },
  postAuthor: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  postDate: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  postContent: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: theme.spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.sm,
  },
  tagChip: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  tagChipText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
  },
  actionIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  actionIconActive: {
    color: '#ef4444',
  },
  actionCount: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
});
