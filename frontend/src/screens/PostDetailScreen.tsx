import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { pb, getFileUrl } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { ImagePicker } from '../components/ImagePicker';

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
    let curr = post.replyTo;
    while (curr) {
      try {
        const parent = await pb.collection('posts').getOne(curr, { expand: 'author' });
        path.unshift(parent);
        curr = parent.replyTo;
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
        filter: `replyTo = "${parentId}"`,
        expand: 'author',
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
      const postRes = await pb.collection('posts').getOne(postId, { expand: 'author' });
      setMainPost(postRes);
      
      const path = await fetchAncestors(postRes);
      setThreadPath(path);
      
      await fetchChildren(postId, 1, false);
    } catch (err) {
      console.error('Error fetching post details', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      hasScrolledRef.current = false;
      fetchData(!isFirstLoad.current);
      isFirstLoad.current = false;
    }, [postId])
  );

  const handleReply = async () => {
    if (!content.trim() || !user || !mainPost) return;
    setPosting(true);
    try {
      const postData: any = {
        content: content.trim(),
        author: user.id,
        replyTo: mainPost.id
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
    const author = post.expand?.author;
    const isLiked = user && (post.likes || []).includes(user.id);
    const repliesCount = post.commentCount || 0;

    const CardComponent = isFocused ? View : TouchableOpacity;
    const cardProps = isFocused ? {} : { 
      activeOpacity: 0.7, 
      onPress: () => navigation.push('PostDetail', { postId: post.id }) 
    };

    return (
      <CardComponent {...cardProps} style={[styles.postCard, isFocused && styles.mainPostCard, isParent && styles.parentCard]}>
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
        
        <Text style={[styles.postContent, isFocused && styles.mainPostContent]}>{post.content}</Text>
        {post.photo && (
          <Image 
            source={{ uri: getFileUrl(post, post.photo) }}
            style={styles.postImage}
          />
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
      </CardComponent>
    );
  };

  return (
    <View style={styles.container}>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.listContainer} 
        contentContainerStyle={styles.listContent}
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
  actionIconActive: { color: theme.colors.primary },
  postImage: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    resizeMode: 'cover',
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
