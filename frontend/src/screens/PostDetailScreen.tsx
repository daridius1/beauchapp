import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, DeviceEventEmitter, Alert, Platform, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { pb, getFileUrl } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { ImagePicker } from '../components/ImagePicker';
import { Avatar } from '../components/Avatar';
import { Feather } from '@expo/vector-icons';
import { PostCard } from '../components/PostCard';
import { withMinimumDelay } from '../utils/refresh';

type Props = NativeStackScreenProps<RootStackParamList, 'PostDetail'>;

export const PostDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { postId } = route.params;
  const { user } = useAuth();
  
  const [threadPath, setThreadPath] = useState<any[]>([]);
  const [mainPost, setMainPost] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [childrenPage, setChildrenPage] = useState(1);
  const [hasMoreChildren, setHasMoreChildren] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchData(true));
    setRefreshing(false);
  }, [postId]);

  const isFirstLoad = useRef(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (photo) {
      const url = URL.createObjectURL(photo);
      setPhotoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPhotoPreview(null);
    }
  }, [photo]);

  const fetchAncestors = async (post: any) => {
    const path = [];
    let curr = (post.actionType === 'reply' && post.targetType === 'post' ? post.targetId : null) || post.replyTo;
    while (curr) {
      try {
        const parent = await pb.collection('posts').getOne(curr, { expand: 'author,replyTo.author' });
        path.unshift(parent);
        curr = (parent.actionType === 'reply' && parent.targetType === 'post' ? parent.targetId : null) || parent.replyTo;
      } catch (e) {
        break; // Parent might be deleted
      }
    }
    return path;
  };

  const fetchChildren = async (parentId: string, pageNum = 1, isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    try {
      const res = await pb.collection('posts').getList(pageNum, 15, {
        filter: `((targetType = "post" && targetId = "${parentId}" && actionType = "reply") || replyTo = "${parentId}") && deleted = false`,
        expand: 'author,replyTo.author',
        sort: '+created'
      });
      if (isLoadMore) {
        setChildren(prev => [...prev, ...res.items]);
      } else {
        setChildren(res.items);
      }
      setHasMoreChildren(res.page < res.totalPages);
      setChildrenPage(pageNum);
    } catch (err) {
      console.error('Error fetching children', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchData = async (hideLoading = false) => {
    if (!hideLoading) setLoading(true);
    try {
      const postRes = await pb.collection('posts').getOne(postId, { expand: 'author,replyTo.author' });
      setMainPost(postRes);
      
      const path = await fetchAncestors(postRes);
      setThreadPath(path);
      
      await fetchChildren(postId, 1, false);
    } catch (err) {
      console.error('Error fetching post details', err);
    } finally {
      if (!hideLoading) setLoading(false);
    }
  };

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchData(true));
      setLoading(false);
    });
    return () => sub.remove();
  }, [postId]);

  useFocusEffect(
    useCallback(() => {
      hasScrolledRef.current = false;
      fetchData(!isFirstLoad.current);
      isFirstLoad.current = false;
    }, [postId])
  );

  const handleReply = async () => {
    if ((!content.trim() && !photo) || !user || !mainPost) return;
    setPosting(true);
    try {
      const postData: any = {
        content: content.trim() || " ",
        author: user.id,
        actionType: 'reply',
        targetType: 'post',
        targetId: mainPost.id,
        targetMeta: {
          authorName: mainPost.expand?.author?.name || 'Usuario',
          authorUsername: mainPost.expand?.author?.username || '',
          content: mainPost.content,
        }
      };
      if (photo) postData.photo = photo;

      await pb.collection('posts').create(postData);
      setPhoto(null);
      setContent('');
      fetchData(true);
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
      setThreadPath(path => path.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));
      setChildren(kids => kids.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));

      await pb.collection('posts').update(post.id, { likes: newLikes });
    } catch (err) {
      console.error('Error liking post', err);
      if (mainPost?.id === post.id) setMainPost({ ...mainPost, likes: post.likes || [] });
      setThreadPath(path => path.map(p => p.id === post.id ? { ...p, likes: post.likes || [] } : p));
      setChildren(kids => kids.map(p => p.id === post.id ? { ...p, likes: post.likes || [] } : p));
    }
  };

  const performDelete = async (postId: string) => {
    try {
      const markDeleted = (p: any) => p.id === postId ? { ...p, deleted: true, content: "[post/comentario eliminado]", photo: "" } : p;
      if (mainPost?.id === postId) setMainPost(markDeleted(mainPost));
      setThreadPath(path => path.map(markDeleted));
      setChildren(kids => kids.map(markDeleted));

      await pb.collection('posts').update(postId, { deleted: true });
      DeviceEventEmitter.emit('onGlobalRefresh');
    } catch (err) {
      console.error('Error soft-deleting post', err);
      fetchData(true);
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

  if (!mainPost) {
    return (
      <View style={styles.centerContainer}>
        <Text style={{ color: theme.colors.textMuted }}>Publicación no encontrada.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: theme.colors.primary }}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render a single post card
  const renderPost = (post: any, isFocused: boolean = false, isParent: boolean = false) => {
    return (
      <PostCard
        post={post}
        currentUser={user}
        isFocused={isFocused}
        isParent={isParent}
        onPress={isFocused ? undefined : () => navigation.push('PostDetail', { postId: post.id })}
        onLikePress={() => toggleLike(post)}
        onDeletePress={() => setDeleteConfirmPostId(post.id)}
        onAuthorPress={() => navigation.push('UserProfile', { userId: post.author })}
      />
    );
  };

  return (
    <View style={styles.container}>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.listContainer} 
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        
        {/* Render Thread Path (Ancestors) */}
        {threadPath.map((ancestor, index) => (
          <View key={ancestor.id} style={styles.parentContextWrapper}>
            {renderPost(ancestor, false, true)}
            <View style={styles.contextLineContainer}>
              <View style={styles.verticalLine} />
            </View>
          </View>
        ))}

        {/* Render Focused Post */}
        <View 
          style={styles.focusedWrapper}
          onLayout={(event) => {
            if (!hasScrolledRef.current && scrollViewRef.current) {
              const layout = event.nativeEvent.layout;
              // Scroll to the focused post, leaving a small 20px padding at the top
              scrollViewRef.current.scrollTo({ y: Math.max(0, layout.y - 20), animated: true });
              hasScrolledRef.current = true;
            }
          }}
        >
           {renderPost(mainPost, true, false)}
        </View>

        {/* Reply Box and Children */}
        <View style={styles.focusedChildrenSection}>
          
          {/* Reply Input Box */}
          {photoPreview && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photoPreview }} style={styles.previewImage} />
              <TouchableOpacity style={styles.removeButton} onPress={() => setPhoto(null)}>
                <Text style={styles.removeText}>X</Text>
              </TouchableOpacity>
            </View>
          )}
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
            </View>
            <View style={styles.footerActions}>
              <ImagePicker onImageReady={(f) => setPhoto(f)} value={photo} />
              <TouchableOpacity 
                style={[styles.replyBtn, ((!content.trim() && !photo) || posting) && styles.replyBtnDisabled]}
                onPress={handleReply}
                disabled={(!content.trim() && !photo) || posting}
              >
                <Text style={styles.replyBtnText}>{posting ? '...' : 'Publicar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Children List */}
          {children.length > 0 && (
            <View style={styles.childrenContainer}>
              <View style={styles.childrenIndentLine} />
              <View style={styles.childrenList}>
                {children.map(child => (
                   <View key={child.id} style={styles.childItem}>
                     {renderPost(child, false, false)}
                   </View>
                ))}
              </View>
            </View>
          )}
          {hasMoreChildren && (
            <TouchableOpacity 
              style={styles.loadMoreBtn}
              onPress={() => fetchChildren(postId, childrenPage + 1, true)}
              disabled={loadingMore}
            >
              {loadingMore ? <ActivityIndicator size="small" color={theme.colors.text} /> : <Text style={styles.loadMoreText}>Ver más comentarios</Text>}
            </TouchableOpacity>
          )}

        </View>
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
  
  postCard: { padding: theme.spacing.md, position: 'relative' },
  mainPostCard: { backgroundColor: theme.colors.cardBg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border },
  parentCard: { paddingBottom: theme.spacing.sm },
  
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },

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
  actionIconActive: { color: theme.colors.primary },
  postImage: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  loadMoreBtn: {
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  loadMoreText: {
    color: theme.colors.text,
    fontSize: 14,
  },
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
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  previewContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginLeft: theme.spacing.md,
    marginTop: 10,
    marginBottom: 10,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
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
