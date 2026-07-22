import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Platform } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { theme } from '../theme/theme';
import { pb, getFileUrl } from '../services/pocketbase';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { ImageViewer } from './ImageViewer';
import { useAuth } from '../context/AuthContext';

import { TargetPreview } from './TargetPreview';

export interface PostCardProps {
  post: any;
  currentUser: any;
  onPress?: () => void;
  onLikePress?: () => void;
  onDeletePress?: () => void;
  onAuthorPress?: () => void;
  onProblemPress?: () => void;
  onTagPress?: (tag: string) => void;
  onRepostPress?: () => void;
  onTargetPress?: () => void;
  isFocused?: boolean;
  isParent?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  onPress,
  onLikePress,
  onDeletePress,
  onAuthorPress,
  onProblemPress,
  onTagPress,
  onRepostPress,
  onTargetPress,
  isFocused = false,
  isParent = false,
}) => {
  const { developerMode } = useAuth();
  const navigation = useNavigation<any>();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingMention, setLoadingMention] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);

  const isDeleted = post.deleted === true;
  const author = isDeleted ? null : post.expand?.author;
  const isLiked = currentUser && (post.likes || []).includes(currentUser.id);
  const repliesCount = post.commentCount || 0;

  const [repostCount, setRepostCount] = useState<number>(0);

  useEffect(() => {
    if (isDeleted || !post.id) return;
    let isMounted = true;
    const fetchRepostCount = async () => {
      try {
        const res = await pb.collection('posts').getList(1, 1, {
          filter: `targetId = "${post.id}" && actionType = "quote" && deleted = false`,
          skipTotal: false,
        });
        if (isMounted) {
          setRepostCount(res.totalItems);
        }
      } catch (err) {}
    };
    fetchRepostCount();
    return () => { isMounted = false; };
  }, [post.id, isDeleted]);

  const handleMentionPress = async (username: string) => {
    if (loadingMention) return;
    setLoadingMention(true);
    try {
      const userRecord = await pb.collection('users').getFirstListItem(`username = "${username}"`);
      if (userRecord && userRecord.id) {
        navigation.push('UserProfile', { userId: userRecord.id });
      }
    } catch (err: any) {
      if (err.status === 404) {
        Toast.show({
          type: 'error',
          text1: 'Usuario no encontrado',
          text2: `No se encontró el perfil de @${username}`,
        });
      }
    } finally {
      setLoadingMention(false);
    }
  };

  const renderContent = (contentStr: string) => {
    if (!contentStr) return null;
    const parts = contentStr.split(/(@[a-zA-Z0-9_.]+)/g);

    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.slice(1);
        return (
          <Text
            key={index}
            style={styles.mentionText}
            onPress={() => handleMentionPress(username)}
          >
            {part}
          </Text>
        );
      }
      return <Text key={index}>{part}</Text>;
    });
  };

  const CardComponent = isFocused ? View : TouchableOpacity;
  const cardProps = isFocused ? {} : { 
    activeOpacity: 0.7, 
    onPress: onPress 
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr.replace(' ', 'T'));
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Hace un momento';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays < 7) return `Hace ${diffDays} d`;
      
      return date.toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    } catch (_) {
      return '';
    }
  };

  return (
    <>
      <CardComponent 
        {...cardProps} 
        style={[
          styles.postCard, 
          isFocused && styles.mainPostCard, 
          isParent && styles.parentCard
        ]}
      >
        {/* Header con la información del autor de este post */}
        <View style={[styles.postHeader, { justifyContent: 'space-between', alignItems: 'center', position: 'relative' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TouchableOpacity 
              onPress={isDeleted ? undefined : onAuthorPress}
              disabled={isDeleted || !onAuthorPress}
              activeOpacity={0.7}
            >
              <View style={{ marginRight: theme.spacing.sm }}>
                <Avatar user={author} size={40} />
              </View>
            </TouchableOpacity>
            <View style={styles.postMeta}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity 
                  onPress={isDeleted ? undefined : onAuthorPress}
                  disabled={isDeleted || !onAuthorPress}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text style={styles.postAuthor}>{isDeleted ? '[eliminado]' : (author?.name || 'Usuario')}</Text>
                  {!isDeleted && author?.username ? <Text style={styles.postUsername}> @{author.username}</Text> : null}
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.postDate}>{formatDate(post.created)}</Text>
                {developerMode && !isDeleted && (
                  <TouchableOpacity
                    style={styles.devIdBadge}
                    activeOpacity={0.7}
                    onPress={(e: any) => {
                      if (e.stopPropagation) e.stopPropagation();
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(post.id);
                      }
                      Toast.show({
                        type: 'info',
                        text1: 'ID Copiado 📋',
                        text2: `ID del post: ${post.id}`,
                      });
                    }}
                  >
                    <Feather name="code" size={10} color={theme.colors.primary} style={{ marginRight: 3 }} />
                    <Text style={styles.devIdBadgeText}>ID: {post.id}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {currentUser && post.author === currentUser.id && !isDeleted && onDeletePress && (
            <TouchableOpacity 
              style={{ padding: 8 }} 
              onPress={() => setMenuOpen(!menuOpen)}
            >
              <Feather name="more-horizontal" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        
        {post.replyTo && (post.expand?.replyTo?.expand?.author || post.expand?.replyTo?.deleted) ? (
          <Text style={styles.replyContextText}>
            En respuesta a @{post.expand.replyTo.deleted ? '[eliminado]' : (post.expand.replyTo.expand?.author?.username || 'Usuario')}
          </Text>
        ) : null}

        {/* Texto del post (omitido si sólo contiene espacio en blanco de 1-clic) */}
        {!(isDeleted && !!post.entityType) && (isDeleted || (post.content && post.content.trim() !== '')) && (
          <Text style={[
            styles.postContent, 
            isFocused && styles.mainPostContent,
            isDeleted && { color: theme.colors.textMuted, fontStyle: 'italic' }
          ]}>
            {isDeleted ? '[Mensaje eliminado]' : renderContent(post.content)}
          </Text>
        )}

        {/* Target Preview Polimórfico (Post, Problema o Partido citado/reposteado) */}
        {!!post.targetType && !!post.targetId && (
          <TargetPreview
            targetType={post.targetType}
            targetId={post.targetId}
            targetMeta={post.targetMeta}
            expandedTarget={post.expand?.targetId}
            onPress={onTargetPress}
          />
        )}

        {/* Adjunto de foto */}
        {!isDeleted && !!post.photo && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setViewerVisible(true)}
          >
            <Image 
              source={{ uri: getFileUrl(post, post.photo) }}
              style={styles.postImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}

        {/* Tags */}
        {!isDeleted && post.tags && post.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {post.tags.map((t: string, i: number) => {
              const ChipComponent = onTagPress ? TouchableOpacity : View;
              const chipProps = onTagPress ? { activeOpacity: 0.7, onPress: (e: any) => { e.stopPropagation(); onTagPress(t); } } : {};
              return (
                <ChipComponent key={i} {...chipProps} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>#{t}</Text>
                </ChipComponent>
              );
            })}
          </View>
        )}
        
        {/* Acciones */}
        <View style={styles.postActions}>
          {!isDeleted && onLikePress && (
            <TouchableOpacity style={styles.actionBtn} onPress={onLikePress}>
              <FontAwesome 
                name={isLiked ? "heart" : "heart-o"} 
                size={16} 
                color={isLiked ? "#EF4444" : theme.colors.textMuted} 
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.actionCount, isLiked && styles.actionIconActive]}>
                {(post.likes || []).length}
              </Text>
            </TouchableOpacity>
          )}

          {!isDeleted && onRepostPress && (
            <TouchableOpacity style={styles.actionBtn} onPress={onRepostPress}>
              <Feather name="repeat" size={16} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={styles.actionCount}>{repostCount}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
            <Feather 
              name="message-square" 
              size={16} 
              color={theme.colors.textMuted} 
              style={{ marginRight: 6 }}
            />
            <Text style={styles.actionCount}>{repliesCount}</Text>
          </TouchableOpacity>
        </View>

        {/* Menú contextual */}
        {menuOpen && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={() => {
                setMenuOpen(false);
                if (onDeletePress) {
                  onDeletePress();
                }
              }}
            >
              <Feather name="trash-2" size={16} color={theme.colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.dropdownItemText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      </CardComponent>
      {post.photo && (
        <ImageViewer 
          visible={viewerVisible}
          imageUrl={getFileUrl(post, post.photo)}
          onClose={() => setViewerVisible(false)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  postCard: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    position: 'relative',
  },
  mainPostCard: {
    backgroundColor: theme.colors.cardBg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  parentCard: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
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
  mentionText: {
    color: '#CCCCCC',
    fontWeight: '700',
  },
  mainPostContent: {
    fontSize: 18,
    lineHeight: 26,
  },
  postImage: {
    width: '100%',
    height: 240,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  tagsRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginBottom: theme.spacing.sm 
  },
  tagChip: { 
    backgroundColor: '#111', 
    borderWidth: 1, 
    borderColor: '#333', 
    borderRadius: 6, 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    marginRight: 8, 
    marginBottom: 8 
  },
  tagChipText: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: '500' 
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
  },
  actionIconActive: {
    color: '#ef4444',
  },
  actionCount: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  dropdownMenu: {
    position: 'absolute',
    right: 10,
    top: 40,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dropdownItemText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  devIdBadge: {
    backgroundColor: '#121212',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  devIdBadgeText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
