import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, RefreshControl, Platform, DeviceEventEmitter, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { pb, getFileUrl } from '../services/pocketbase';
import { ImagePicker } from '../components/ImagePicker';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';
import { TargetPreview } from '../components/TargetPreview';
import { withMinimumDelay } from '../utils/refresh';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Target pre-seleccionado para citar
  const [quotedTarget, setQuotedTarget] = useState<{ targetType: string; targetId: string; targetMeta: any } | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [tempTag, setTempTag] = useState('');
  const hasScrolledRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [feedTab, setFeedTab] = useState<'all' | 'following'>('all');

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onScrollToTop', () => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const routeParams = route.params as any;
    if (routeParams?.quoteTargetType && routeParams?.quoteTargetId) {
      setQuotedTarget({
        targetType: routeParams.quoteTargetType,
        targetId: routeParams.quoteTargetId,
        targetMeta: routeParams.quoteTargetMeta || {},
      });
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [route.params]);

  useEffect(() => {
    if (photo) {
      const url = URL.createObjectURL(photo);
      setPhotoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPhotoPreview(null);
    }
  }, [photo]);

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

  const fetchPosts = async (pageNum = 1, isLoadMore = false, hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      let filterConditions = ["deleted = false"];
      
      if (feedTab === 'following' && user) {
        // 1. Obtener la lista de usuarios seguidos
        const followsRes = await pb.collection('follows').getFullList({
          filter: `follower = "${user.id}"`
        });
        const followingIds = followsRes.map(f => f.following);
        
        if (followingIds.length === 0) {
          // Si no sigue a nadie, el feed está vacío
          setPosts([]);
          setHasMore(false);
          setPage(pageNum);
          return;
        }
        
        // 2. Construir la condición OR para los autores seguidos
        const authorConditions = followingIds.map(id => `author = "${id}"`).join(' || ');
        filterConditions.push(`(${authorConditions})`);
      }

      if (activeSearch) {
        const safeSearch = activeSearch.replace(/"/g, '\\"');
        filterConditions.push(`content ~ "${safeSearch}"`);
      } else {
        // Solo publicaciones principales o citas en el muro (no respuestas ni comentarios de problemas/partidos)
        filterConditions.push(`actionType != "reply" && actionType != "comment" && replyTo = ""`);
      }
      
      if (filterTags.length > 0) {
        filterTags.forEach(t => {
          const safeTag = t.replace(/"/g, '\\"').toLowerCase();
          filterConditions.push(`tags ~ "\\"${safeTag}\\""`);
        });
      }

      const options: any = {
        sort: '-created',
        expand: 'author,replyTo.author'
      };
      if (filterConditions.length > 0) {
        options.filter = filterConditions.join(' && ');
      }

      const res = await pb.collection('posts').getList(pageNum, 15, options);
      if (isLoadMore) {
        setPosts(prev => [...prev, ...res.items]);
      } else {
        setPosts(res.items);
      }
      setHasMore(res.page < res.totalPages);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching posts', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    await withMinimumDelay(() => fetchPosts(1, false, true));
    setRefreshing(false);
    setLoading(false);
  }, [activeSearch, filterTags.join(','), feedTab, user]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', () => {
      onRefresh();
    });
    return () => sub.remove();
  }, [onRefresh]);

  useFocusEffect(
    useCallback(() => {
      fetchPosts(1, false);
    }, [activeSearch, filterTags.join(','), feedTab, user])
  );

  const handleSearchChange = (text: string) => {
    if (text.endsWith(' ') && text.includes('#')) {
      const hashMatch = text.match(/#(\w+)\s/);
      if (hashMatch) {
        if (filterTags.length < 1) {
          setFilterTags([hashMatch[1]]);
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
        setFilterTags([hashMatch[1]]);
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
    const cleanTag = tag;
    setFilterTags([cleanTag]);
    setTags([cleanTag]);
    setSearchQuery('');
    setActiveSearch('');
  };

  const removeFilterTag = (index: number) => {
    setFilterTags(filterTags.filter((_, i) => i !== index));
  };

  const addTag = (text: string) => {
    const clean = text
      .toLowerCase()
      .replace(/[áäâà]/g, 'a')
      .replace(/[éëêè]/g, 'e')
      .replace(/[íïîì]/g, 'i')
      .replace(/[óöôò]/g, 'o')
      .replace(/[úüûù]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    if (clean && tags.length < 10 && clean.length <= 15 && !tags.includes(clean)) {
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
    if ((!content.trim() && !photo && !quotedTarget) || !user) return;
    setPosting(true);
    try {
      let finalTags = [...tags];
      const pendingTag = tagInput
        .toLowerCase()
        .replace(/[áäâà]/g, 'a')
        .replace(/[éëêè]/g, 'e')
        .replace(/[íïîì]/g, 'i')
        .replace(/[óöôò]/g, 'o')
        .replace(/[úüûù]/g, 'u')
        .replace(/[ñ]/g, 'n')
        .replace(/[^a-z0-9]/g, '')
        .trim();
      if (pendingTag && finalTags.length < 10 && pendingTag.length <= 15 && !finalTags.includes(pendingTag)) {
        finalTags.push(pendingTag);
      }

      const postData: any = {
        content: content.trim() || " ",
        tags: finalTags,
        author: user.id
      };
      if (photo) postData.photo = photo;

      if (quotedTarget) {
        postData.actionType = 'quote';
        postData.targetType = quotedTarget.targetType;
        postData.targetId = quotedTarget.targetId;
        postData.targetMeta = quotedTarget.targetMeta;
      }

      await pb.collection('posts').create(postData);
      setContent('');
      setTags([]);
      setTagInput('');
      setPhoto(null);
      setQuotedTarget(null);
      fetchPosts(1, false);
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

  const performDelete = async (postId: string) => {
    try {
      setPosts(currentPosts => currentPosts.filter(p => p.id !== postId));
      await pb.collection('posts').update(postId, { deleted: true });
      DeviceEventEmitter.emit('onGlobalRefresh');
    } catch (err) {
      console.error('Error soft-deleting post', err);
      fetchPosts(1, false, true);
    }
  };

  const handleRepost = (targetPost: any) => {
    if (!user) {
      Toast.show({ type: 'info', text1: 'Autenticación requerida', text2: 'Inicia sesión para citar.' });
      return;
    }
    setQuotedTarget({
      targetType: 'post',
      targetId: targetPost.id,
      targetMeta: {
        authorName: targetPost.expand?.author?.name || 'Usuario',
        authorUsername: targetPost.expand?.author?.username || '',
        authorAvatar: targetPost.expand?.author?.avatar || '',
        content: targetPost.content,
        photo: targetPost.photo,
      }
    });
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
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

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 500;
    if (isCloseToBottom && hasMore && !loadingMore && !loading) {
      setLoadingMore(true);
      fetchPosts(page + 1, true, true);
    }
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
                  const clean = tempTag.replace(/[^a-zA-Z0-9]/g, '');
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
                    const clean = tempTag.replace(/[^a-zA-Z0-9]/g, '');
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
                <Feather name="search" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {user && (
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, feedTab === 'all' && styles.tabButtonActive]} 
            onPress={() => setFeedTab('all')}
          >
            <Text style={[styles.tabText, feedTab === 'all' && styles.tabTextActive]}>Descubrir</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, feedTab === 'following' && styles.tabButtonActive]} 
            onPress={() => setFeedTab('following')}
          >
            <Text style={[styles.tabText, feedTab === 'following' && styles.tabTextActive]}>Siguiendo</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView 
        ref={scrollViewRef}
        style={styles.feedList} 
        contentContainerStyle={styles.feedContent}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {user ? (
          <View style={styles.composeBox}>
            <View style={styles.composeRow}>
              <View style={{ marginRight: theme.spacing.sm }}>
                <Avatar user={user} size={40} />
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
            {quotedTarget && (
              <View style={styles.quotedAttachmentCard}>
                <View style={styles.quotedAttachmentHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <FontAwesome name="quote-left" size={13} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.quotedAttachmentTitle}>Citando elemento</Text>
                  </View>
                  <TouchableOpacity onPress={() => setQuotedTarget(null)} style={{ padding: 4 }}>
                    <Feather name="x" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <TargetPreview
                  targetType={quotedTarget.targetType}
                  targetId={quotedTarget.targetId}
                  targetMeta={quotedTarget.targetMeta}
                />
              </View>
            )}

            {photoPreview && (
              <View style={styles.previewContainer}>
                <Image source={{ uri: photoPreview }} style={styles.previewImage} resizeMode="cover" />
                <TouchableOpacity style={styles.removeButton} onPress={() => setPhoto(null)}>
                  <Text style={styles.removeText}>X</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.composeFooter}>
              <View style={styles.tagsInputContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.tagsInput, tags.length >= 10 && { opacity: 0.5 }]}
                    placeholder={tags.length >= 10 ? "Límite de tags alcanzado" : "Añadir tag..."}
                    placeholderTextColor={theme.colors.textMuted}
                    value={tagInput}
                    onChangeText={handleTagInputChange}
                    onSubmitEditing={() => addTag(tagInput)}
                    maxLength={16}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={tags.length < 10}
                  />
                  {tags.length < 10 && (
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
              <View style={styles.footerActions}>
                <ImagePicker onImageReady={(f) => setPhoto(f)} value={photo} />
                <TouchableOpacity 
                  style={[styles.postBtn, ((!content.trim() && !photo && !quotedTarget) || posting) && styles.postBtnDisabled]}
                  onPress={handlePost}
                  disabled={(!content.trim() && !photo && !quotedTarget) || posting}
                >
                <Text style={styles.postBtnText}>{posting ? '...' : 'Publicar'}</Text>
                </TouchableOpacity>
              </View>
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
        ) : posts.length === 0 ? (
          feedTab === 'following' ? (
            <View style={styles.emptyFollowingContainer}>
              <Feather name="users" size={40} color={theme.colors.textMuted} style={{ marginBottom: theme.spacing.sm }} />
              <Text style={styles.emptyFollowingTitle}>No hay publicaciones aún</Text>
              <Text style={styles.emptyFollowingText}>Sigue a otros compañeros, centros o comunidades desde el directorio para ver su contenido aquí.</Text>
              <TouchableOpacity 
                style={styles.emptyFollowingBtn} 
                onPress={() => navigation.navigate('Directory')}
              >
                <Text style={styles.emptyFollowingBtnText}>Explorar Perfiles</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.noPostsText}>No hay publicaciones en el muro.</Text>
          )
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={user}
              onPress={() => navigation.push('PostDetail', { postId: post.id })}
              onLikePress={() => toggleLike(post)}
              onDeletePress={() => setDeleteConfirmPostId(post.id)}
              onAuthorPress={() => navigation.push('UserProfile', { userId: post.author })}
              onTagPress={(t) => activateTagFilter(t)}
              onRepostPress={() => handleRepost(post)}
              onTargetPress={() => handleTargetPress(post.targetType, post.targetId)}
            />
          ))
        )}
        {loadingMore && <ActivityIndicator size="small" color={theme.colors.text} style={{ padding: 20 }} />}
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
  postImage: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  composeBox: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.cardBg,
  },
  quotedAttachmentCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 10,
    marginBottom: theme.spacing.sm,
  },
  quotedAttachmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  quotedAttachmentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  composeRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
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
  emptyText: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  previewContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginLeft: 40,
    marginTop: 10,
    marginBottom: 10,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#333',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    position: 'relative',
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
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: theme.colors.text,
  },
  emptyFollowingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 50,
  },
  emptyFollowingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptyFollowingText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.lg,
  },
  emptyFollowingBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.md,
  },
  emptyFollowingBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 13,
  },
  noPostsText: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    fontSize: 14,
  },
  entityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    padding: 12,
    marginBottom: theme.spacing.sm,
  },
  entityCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  entityCardBody: {
    flex: 1,
  },
  entityCardSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  entityCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    lineHeight: 19,
  },
});
