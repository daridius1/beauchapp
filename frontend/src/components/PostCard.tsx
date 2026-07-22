import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Platform } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { theme } from '../theme/theme';
import { pb, getFileUrl } from '../services/pocketbase';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { ImageViewer } from './ImageViewer';
import { useAuth } from '../context/AuthContext';

export interface PostCardProps {
  post: any;
  currentUser: any;
  onPress?: () => void;
  onLikePress?: () => void;
  onDeletePress?: () => void;
  onAuthorPress?: () => void;
  onTagPress?: (tag: string) => void;
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
  onTagPress,
  isFocused = false,
  isParent = false,
}) => {
  const { developerMode } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingMention, setLoadingMention] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const isDeleted = post.deleted === true;
  const author = isDeleted ? null : post.expand?.author;
  const isLiked = currentUser && (post.likes || []).includes(currentUser.id);
  const repliesCount = post.commentCount || 0;
  const navigation = useNavigation<any>();

  const renderContent = (content: string) => {
    if (!content) return null;
    const mentionRegex = /@(\w+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      const username = match[1];

      parts.push(
        <Text
          key={`mention-${match.index}`}
          style={styles.mentionText}
          onPress={async (e) => {
            e.stopPropagation();
            if (loadingMention) return;
            setLoadingMention(true);
            try {
              const res = await fetch(
                `${pb.baseUrl}/api/collections/users/records?filter=(username='${username}')`
              );
              const data = await res.json();
              if (data.items && data.items.length > 0) {
                navigation.navigate('UserProfile', { userId: data.items[0].id });
              } else {
                Toast.show({
                  type: 'info',
                  text1: 'Usuario no encontrado',
                  text2: `No existe @${username}`,
                });
              }
            } catch (err) {
              console.error(err);
            } finally {
              setLoadingMention(false);
            }
          }}
        >
          @{username}
        </Text>
      );

      lastIndex = mentionRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts;
  };

  const CardComponent = onPress ? TouchableOpacity : View;
  const cardProps = onPress ? { activeOpacity: 0.9, onPress } : {};

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
              >
                <Text style={styles.authorName}>
                  {isDeleted ? 'Usuario Eliminado' : (author?.name || 'Usuario Anónimo')}
                </Text>
              </TouchableOpacity>
              {!isDeleted && author?.username && (
                <Text style={styles.authorUsername}>@{author.username}</Text>
              )}
            </View>
            <Text style={styles.postTime}>
              {new Date(post.created).toLocaleDateString()} · {new Date(post.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </Text>
          </View>
        </View>

        {developerMode && (
          <View style={styles.devIdBadge}>
            <Feather name="hash" size={10} color={theme.colors.primary} style={{ marginRight: 2 }} />
            <Text style={styles.devIdBadgeText}>{post.id}</Text>
          </View>
        )}

        {!isDeleted && currentUser && currentUser.id === post.author && onDeletePress && (
          <View>
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              style={{ padding: 4 }}
            >
              <Feather name="more-horizontal" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>

            {menuOpen && (
              <View style={styles.dropdownMenu}>
                <TouchableOpacity 
                  style={styles.dropdownItem}
                  onPress={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDeletePress();
                  }}
                >
                  <Feather name="trash-2" size={14} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={[styles.dropdownItemText, { color: '#EF4444' }]}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
      
      {post.replyTo && (post.expand?.replyTo?.expand?.author || post.expand?.replyTo?.deleted) ? (
        <Text style={styles.replyContextText}>
          En respuesta a @{post.expand.replyTo.deleted ? '[eliminado]' : (post.expand.replyTo.expand?.author?.username || 'Usuario')}
        </Text>
      ) : null}

      {(isDeleted || (post.content && post.content.trim() !== '')) && (
        <Text style={[
          styles.postContent, 
          isFocused && styles.mainPostContent,
          isDeleted && { color: theme.colors.textMuted, fontStyle: 'italic' }
        ]}>
          {isDeleted ? '[Mensaje eliminado]' : renderContent(post.content)}
        </Text>
      )}

      {/* Image attachment if exists */}
      {!isDeleted && post.photo && (
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={(e) => {
            e.stopPropagation();
            setViewerVisible(true);
          }}
        >
          <Image 
            source={{ uri: getFileUrl(post, post.photo) }}
            style={styles.postImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}

      {/* Tags row */}
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
      
      {/* Actions (Likes and Comments count) */}
      <View style={styles.postActions}>
        {!isDeleted && onLikePress && (
          <TouchableOpacity style={styles.actionBtn} onPress={onLikePress}>
            <FontAwesome 
              name={isLiked ? "heart" : "heart-o"} 
              size={16} 
              color={isLiked ? "#EF4444" : theme.colors.textMuted} 
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.actionText, isLiked && { color: "#EF4444" }]}>
              {post.likes ? post.likes.length : 0}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionBtn}>
          <Feather name="message-square" size={16} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.actionText}>{repliesCount}</Text>
        </View>
      </View>
    </CardComponent>

    {!isDeleted && post.photo && (
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
    backgroundColor: theme.colors.cardBg,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mainPostCard: {
    backgroundColor: '#0a0a0a',
    borderColor: '#333333',
    padding: theme.spacing.lg,
  },
  parentCard: {
    opacity: 0.85,
    marginBottom: theme.spacing.sm,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  postMeta: {
    justifyContent: 'center',
  },
  authorName: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 14,
    marginRight: 6,
  },
  authorUsername: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  postTime: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  replyContextText: { color: theme.colors.textMuted, fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
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
  actionText: {
    color: theme.colors.textMuted,
    fontSize: 13,
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
