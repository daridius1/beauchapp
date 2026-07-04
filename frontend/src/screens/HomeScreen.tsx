import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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

export const HomeScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tempTag, setTempTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (route.params?.initialFilterTag) {
      setFilterTags([route.params.initialFilterTag]);
    }
    if (route.params?.initialPostTags) {
      setTags(route.params.initialPostTags);
    }
    if (route.params?.initialFilterTag || route.params?.initialPostTags) {
      navigation.setParams({ initialFilterTag: undefined, initialPostTags: undefined });
    }
  }, [route.params, navigation]);

  const fetchPosts = async () => {
    try {
      let filterConditions = [];
      if (activeSearch) {
        const safeSearch = activeSearch.replace(/"/g, '\\"');
        filterConditions.push(`content ~ "${safeSearch}"`);
      } else {
        // Si no hay búsqueda de texto, mostrar SOLO las raíces (posts originales)
        filterConditions.push(`root = ""`);
      }
      
      if (filterTags.length > 0) {
        filterTags.forEach(t => {
          const safeTag = t.replace(/"/g, '\\"');
          // Hereda los tags del post raíz
          filterConditions.push(`(tags ~ "${safeTag}" || root.tags ~ "${safeTag}")`);
        });
      }

      const options: any = {
        sort: '-created',
        expand: 'author,replyTo.author'
      };
      if (filterConditions.length > 0) {
        options.filter = filterConditions.join(' && ');
      }

      const res = await pb.collection('posts').getList(1, 50, options);
      setPosts(res.items);
    } catch (err) {
      console.error('Error fetching posts', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [activeSearch, filterTags.join(',')])
  );

  const handleSearchChange = (text: string) => {
    if (text.endsWith(' ') && text.includes('#')) {
      const hashMatch = text.match(/#(\w+)\s/);
      if (hashMatch) {
        if (filterTags.length < 1) {
          setFilterTags([hashMatch[1].toLowerCase()]);
        }
        setSearchQuery(text.replace(/#\w+\s/, '').trim());
        return;
      }
    }
    setSearchQuery(text);
  };

  const handleSearch = () => {
    let q = searchQuery;
    const hashMatch = q.match(/#(\w+)/);
    if (hashMatch) {
      if (filterTags.length < 1) {
        setFilterTags([hashMatch[1].toLowerCase()]);
      }
      q = q.replace(/#\w+/, '').trim();
      setSearchQuery(q);
    }
    setActiveSearch(q);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
  };

  const activateTagFilter = (tag: string) => {
    const cleanTag = tag.toLowerCase();
    setFilterTags([cleanTag]);
    setTags([cleanTag]);
    setSearchQuery('');
    setActiveSearch('');
  };

  const removeFilterTag = (index: number) => {
    setFilterTags(filterTags.filter((_, i) => i !== index));
  };

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

  const handlePost = async () => {
    if (!content.trim() || !user) return;
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
        author: user.id
      });
      setContent('');
      setTags([]);
      setTagInput('');
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
      // Optimistic UI Update: Reflejar en pantalla de inmediato
      setPosts(currentPosts => 
        currentPosts.map(p => 
          p.id === post.id ? { ...p, likes: newLikes } : p
        )
      );

      // Actualizar en segundo plano en BD
      await pb.collection('posts').update(post.id, { likes: newLikes });
    } catch (err) {
      console.error(err);
      // Revertir actualizacion optimista
      setPosts(currentPosts => 
        currentPosts.map(p => 
          p.id === post.id ? { ...p, likes: post.likes || [] } : p
        )
      );
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr.replace(' ', 'T'));
    return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute:'2-digit' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          {filterTags.length > 0 ? (
            <TouchableOpacity onPress={() => removeFilterTag(0)} style={[styles.tagChipEditable, { marginBottom: 0, marginTop: 0, marginRight: 8 }]}>
              <Text style={styles.tagChipEditableText}>#{filterTags[0]} ✕</Text>
            </TouchableOpacity>
          ) : (
            !isAddingTag && (
              <TouchableOpacity onPress={() => setIsAddingTag(true)} style={styles.hashBtn}>
                <Text style={styles.hashBtnText}>#</Text>
              </TouchableOpacity>
            )
          )}

          {isAddingTag ? (
            <View style={styles.expandingTagContainer}>
              <Text style={styles.hashPrefix}>#</Text>
              <TextInput
                style={styles.expandingTagInput}
                placeholder="tag..."
                placeholderTextColor={theme.colors.textMuted}
                autoFocus
                value={tempTag}
                onChangeText={setTempTag}
                onSubmitEditing={() => {
                  const clean = tempTag.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                  if (clean) activateTagFilter(clean);
                  setTempTag('');
                  setIsAddingTag(false);
                }}
                maxLength={15}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {tempTag.trim().length > 0 ? (
                <TouchableOpacity 
                  onPress={() => {
                    const clean = tempTag.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    if (clean) activateTagFilter(clean);
                    setTempTag('');
                    setIsAddingTag(false);
                  }} 
                  style={styles.inlineActionBtn}
                >
                  <Text style={styles.inlineActionBtnTextPlus}>+</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setIsAddingTag(false)} style={styles.inlineActionBtn}>
                  <Text style={styles.inlineActionBtnTextCancel}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar..."
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={handleSearchChange}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearSearchBtn}>
                  <Text style={styles.clearSearchBtnText}>✕</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleSearch} style={styles.inlineActionBtn}>
                <Text style={styles.inlineActionBtnTextSearch}>🔍</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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
            
            {tags.length > 0 && (
              <View style={styles.activeTagsRow}>
                {tags.map((t, i) => (
                  <TouchableOpacity key={i} onPress={() => removeTag(i)} style={styles.tagChipEditable}>
                    <Text style={styles.tagChipEditableText}>#{t} ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.composeFooter}>
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
            const repliesCount = post.commentCount || 0;
            return (
              <TouchableOpacity 
                key={post.id} 
                style={styles.postCard} 
                activeOpacity={0.7}
                onPress={() => navigation.push('PostDetail', { postId: post.id })}
              >
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
                {post.replyTo && post.expand?.replyTo?.expand?.author ? (
                  <Text style={styles.replyContextText}>
                    En respuesta a @{post.expand.replyTo.expand.author.username}
                  </Text>
                ) : null}
                <Text style={styles.postContent}>{post.content}</Text>
                
                {post.tags && post.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {post.tags.map((t: string, i: number) => (
                      <TouchableOpacity 
                        key={i} 
                        style={styles.tagChip}
                        onPress={() => activateTagFilter(t)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.tagChipText}>#{t}</Text>
                      </TouchableOpacity>
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
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  filterTagsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  filterTagsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  filterTagsLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginRight: theme.spacing.sm,
  },
  filterTagsInput: {
    color: theme.colors.text,
    fontSize: 13,
    minWidth: 70,
    paddingVertical: 4,
    marginRight: 4,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchIcon: {
    fontSize: 14,
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    paddingVertical: 10,
  },
  clearSearchBtn: {
    padding: 4,
    marginLeft: theme.spacing.sm,
  },
  clearSearchBtnText: {
    color: theme.colors.textMuted,
    fontSize: 16,
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
  tagsInputContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  activeTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 12,
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
  postUsername: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  replyContextText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: theme.spacing.xs,
  },
  postContent: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: theme.spacing.sm,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.sm },
  tagChip: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8, marginBottom: 8 },
  tagChipText: { color: '#fff', fontSize: 12, fontWeight: '500' },
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
  hashBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#222',
    borderRadius: 6,
    marginRight: 6,
  },
  hashBtnText: {
    color: theme.colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  expandingTagContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  hashPrefix: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 2,
  },
  expandingTagInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 6,
  },
  inlineActionBtn: {
    padding: 6,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineActionBtnTextPlus: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  inlineActionBtnTextCancel: {
    color: theme.colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  inlineActionBtnTextSearch: {
    fontSize: 16,
  },
});
