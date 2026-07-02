import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { theme } from './HomeScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'PostDetail'>;

export const PostDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { postId } = route.params;
  const { user } = useAuth();
  
  const [parent, setParent] = useState<any>(null);
  const [siblings, setSiblings] = useState<any[]>([]);
  const [mainPost, setMainPost] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const isFirstLoad = useRef(true);

  const fetchData = async (hideLoading = false) => {
    if (!hideLoading) setLoading(true);
    try {
      // 1. Fetch focused post
      const postRes = await pb.collection('posts').getOne(postId, { expand: 'author,posts_via_replyTo' });
      setMainPost(postRes);
      
      if (!hideLoading) {
        setTags(postRes.tags || []);
      }

      // 2. Fetch parent context (if exists) and siblings
      if (postRes.replyTo) {
        const parentRes = await pb.collection('posts').getOne(postRes.replyTo, { expand: 'author,posts_via_replyTo' });
        setParent(parentRes);

        const sibRes = await pb.collection('posts').getList(1, 100, {
          filter: `replyTo = "${parentRes.id}"`,
          sort: '+created',
          expand: 'author,posts_via_replyTo'
        });
        setSiblings(sibRes.items);
      } else {
        setParent(null);
        setSiblings([postRes]); // If it has no parent, it's a root post
      }

      // 3. Fetch children of the focused post
      const childrenRes = await pb.collection('posts').getList(1, 100, {
        filter: `replyTo = "${postId}"`,
        sort: '+created',
        expand: 'author,posts_via_replyTo'
      });
      setChildren(childrenRes.items);
    } catch (err) {
      console.error('Error fetching post details', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData(!isFirstLoad.current);
      isFirstLoad.current = false;
    }, [postId])
  );

  const addTag = (text: string) => {
    const clean = text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (clean && tags.length < 4 && clean.length <= 15 && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleTagInputChange = (text: string) => {
    if (text.endsWith(' ') || text.endsWith(',') || text.endsWith('\n')) {
      addTag(text);
    } else {
      setTagInput(text);
    }
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleReply = async () => {
    if (!content.trim() || !user || !mainPost) return;
    setPosting(true);
    try {
      let finalTags = [...tags];
      const pendingTag = tagInput.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (pendingTag && finalTags.length < 4 && pendingTag.length <= 15 && !finalTags.includes(pendingTag)) {
        finalTags.push(pendingTag);
      }

      await pb.collection('posts').create({
        content: content.trim(),
        tags: finalTags,
        author: user.id,
        replyTo: mainPost.id
      });
      setContent('');
      setTags(mainPost.tags || []);
      setTagInput('');
      fetchData();
    } catch (err) {
      console.error('Error replying', err);
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
      // Optimistic update
      if (mainPost?.id === post.id) setMainPost({ ...mainPost, likes: newLikes });
      if (parent?.id === post.id) setParent({ ...parent, likes: newLikes });
      setSiblings(sibs => sibs.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));
      setChildren(kids => kids.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));

      await pb.collection('posts').update(post.id, { likes: newLikes });
    } catch (err) {
      console.error('Error liking post', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute:'2-digit' });
  };

  if (loading || !mainPost) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Render a single post card
  const renderPost = (post: any, isFocused: boolean = false) => {
    const author = post.expand?.author;
    const isLiked = user && (post.likes || []).includes(user.id);
    const isParent = parent && post.id === parent.id;
    const repliesCount = post.expand?.posts_via_replyTo ? post.expand.posts_via_replyTo.length : 0;

    const CardComponent = isFocused ? View : TouchableOpacity;
    const cardProps = isFocused ? {} : { 
      activeOpacity: 0.7, 
      onPress: () => navigation.push('PostDetail', { postId: post.id }) 
    };

    return (
      <CardComponent {...cardProps} style={[styles.postCard, isFocused && styles.mainPostCard, isParent && styles.parentCard]}>
        <TouchableOpacity 
          style={styles.postHeader}
          onPress={() => navigation.push('UserProfile', { userId: post.author })}
        >
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
        </TouchableOpacity>
        
        {isParent && <Text style={styles.contextBadge}>Post Original</Text>}
        
        <Text style={[styles.postContent, isFocused && styles.mainPostContent]}>{post.content}</Text>
        
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
          {!isFocused && (
             <View style={styles.actionBtn}>
               <Text style={styles.actionIcon}>💬</Text>
               <Text style={styles.actionCount}>{repliesCount}</Text>
             </View>
          )}
        </View>
      </CardComponent>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hilo de Conversación</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        
        {/* Render Parent Context */}
        {parent && (
          <View style={styles.parentContextWrapper}>
            {renderPost(parent, false)}
            <View style={styles.contextLineContainer}>
              <View style={styles.verticalLine} />
            </View>
          </View>
        )}

        {/* Render Siblings & Focused Post */}
        {siblings.map(sib => {
          const isFocused = sib.id === postId;
          return (
            <React.Fragment key={sib.id}>
              
              <View style={isFocused ? styles.focusedWrapper : styles.siblingWrapper}>
                 {renderPost(sib, isFocused)}
              </View>

              {/* If this is the focused post, render the reply box and its children directly underneath */}
              {isFocused && (
                <View style={styles.focusedChildrenSection}>
                  
                  {/* Reply Input Box */}
                  <View style={styles.replyBox}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={styles.replyInput}
                        placeholder="Escribe tu respuesta..."
                        placeholderTextColor={theme.colors.textMuted}
                        value={content}
                        onChangeText={setContent}
                        multiline
                      />

                      {tags.length > 0 && (
                        <View style={styles.activeTagsRow}>
                          {tags.map((t, i) => (
                            <TouchableOpacity key={i} onPress={() => removeTag(i)} style={styles.tagChipEditable}>
                              <Text style={styles.tagChipEditableText}>#{t} ✕</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      <View style={styles.tagsInputContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TextInput
                            style={[styles.tagsInput, tags.length >= 4 && { opacity: 0.5 }]}
                            placeholder={tags.length >= 4 ? "Límite de tags alcanzado" : "Añadir tag..."}
                            placeholderTextColor={theme.colors.textMuted}
                            value={tagInput}
                            onChangeText={handleTagInputChange}
                            onSubmitEditing={() => addTag(tagInput)}
                            maxLength={16}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={tags.length < 4}
                          />
                          {tags.length < 4 && (
                            <TouchableOpacity 
                              onPress={() => addTag(tagInput)} 
                              style={[styles.addTagBtn, tagInput.trim().length === 0 && styles.addTagBtnDisabled]}
                              disabled={tagInput.trim().length === 0}
                            >
                              <Text style={styles.addTagBtnText}>+</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={[styles.replyBtn, (!content.trim() || posting) && styles.replyBtnDisabled]}
                      onPress={handleReply}
                      disabled={!content.trim() || posting}
                    >
                      <Text style={styles.replyBtnText}>{posting ? '...' : 'Publicar'}</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Children List */}
                  {children.length > 0 && (
                    <View style={styles.childrenContainer}>
                      <View style={styles.childrenIndentLine} />
                      <View style={styles.childrenList}>
                        {children.map(child => (
                           <View key={child.id} style={styles.childItem}>
                             {renderPost(child, false)}
                           </View>
                        ))}
                      </View>
                    </View>
                  )}

                </View>
              )}
            </React.Fragment>
          );
        })}
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
  listContainer: { flex: 1 },
  listContent: { paddingBottom: theme.spacing.xl },
  
  postCard: { padding: theme.spacing.md },
  mainPostCard: { backgroundColor: theme.colors.cardBg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border },
  parentCard: { paddingBottom: theme.spacing.sm },
  
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  avatarMini: { width: 40, height: 40, borderRadius: 4, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: theme.spacing.sm },
  avatarMiniText: { color: '#000', fontSize: 18, fontWeight: '700' },
  postMeta: { justifyContent: 'center' },
  postAuthor: { color: theme.colors.text, fontWeight: '700', fontSize: 15 },
  postUsername: { color: theme.colors.textMuted, fontSize: 13 },
  postDate: { color: theme.colors.textMuted, fontSize: 12 },
  
  contextBadge: { fontSize: 11, color: theme.colors.textMuted, fontStyle: 'italic', marginBottom: 4 },
  
  postContent: { color: theme.colors.text, fontSize: 15, lineHeight: 22, marginBottom: theme.spacing.sm },
  mainPostContent: { fontSize: 18, lineHeight: 26, fontWeight: '500' },
  
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.sm },
  tagChip: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8, marginBottom: 8 },
  tagChipText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  
  postActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.lg },
  actionIcon: { fontSize: 14, marginRight: 6 },
  actionIconActive: { color: '#ef4444' },
  actionCount: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '500' },
  
  parentContextWrapper: {
    backgroundColor: theme.colors.background,
  },
  contextLineContainer: {
    paddingLeft: theme.spacing.md + 20, // Center of avatar (16 padding + 20 half avatar)
    height: 20,
  },
  verticalLine: {
    width: 2,
    height: '100%',
    backgroundColor: theme.colors.border,
  },
  
  siblingWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  focusedWrapper: {
    // Styling applied in mainPostCard
  },
  
  focusedChildrenSection: {
    backgroundColor: theme.colors.background,
  },
  
  replyBox: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  replyInput: { color: theme.colors.text, fontSize: 15, maxHeight: 100, minHeight: 40, paddingRight: theme.spacing.md, textAlignVertical: 'top' },
  tagsInputContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  activeTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 8,
  },
  tagsInput: {
    color: theme.colors.text,
    fontSize: 13,
    minWidth: 100,
    paddingVertical: 4,
  },
  tagChipEditable: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
    marginBottom: 8,
  },
  tagChipEditableText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  addTagBtn: {
    backgroundColor: '#333',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addTagBtnDisabled: {
    opacity: 0.3,
  },
  addTagBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginTop: -2,
  },
  replyBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4, marginBottom: theme.spacing.xs },
  replyBtnDisabled: { opacity: 0.5 },
  replyBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  
  childrenContainer: {
    flexDirection: 'row',
  },
  childrenIndentLine: {
    width: 2,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.md + 20,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  childrenList: {
    flex: 1,
  },
  childItem: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  }
});
