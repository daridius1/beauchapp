import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { theme } from '../theme/theme';
import { pb, getFileUrl } from '../services/pocketbase';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

export interface PostCardProps {
  post: any;
  currentUser: any;
  onPress?: () => void;
  onLikePress?: () => void;
  onDeletePress?: () => void;
  onAuthorPress?: () => void;
  onProblemPress?: () => void;
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
  onProblemPress,
  onTagPress,
  isFocused = false,
  isParent = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingMention, setLoadingMention] = useState(false);
  const isDeleted = post.deleted === true;
  const author = isDeleted ? null : post.expand?.author;
  const isLiked = currentUser && (post.likes || []).includes(currentUser.id);
  const repliesCount = post.commentCount || 0;
  const [ratingData, setRatingData] = useState<{ rating: number, difficulty: number, count: number } | null>(null);

  useEffect(() => {
    if (isDeleted || post.entityType !== 'problems' || !post.entityId) {
      return;
    }
    
    let isMounted = true;
    const fetchRatings = async () => {
      try {
        const ratingsRes = await pb.collection('problem_ratings').getFullList({
          filter: `problem = "${post.entityId}"`
        });
        
        if (!isMounted) return;
        
        if (ratingsRes.length === 0) {
          setRatingData({ rating: 0, difficulty: 0, count: 0 });
          return;
        }
        
        let sumRating = 0;
        let sumDifficulty = 0;
        ratingsRes.forEach(r => {
          sumRating += r.rating;
          sumDifficulty += r.difficulty;
        });
        
        setRatingData({
          rating: parseFloat((sumRating / ratingsRes.length).toFixed(1)),
          difficulty: parseFloat((sumDifficulty / ratingsRes.length).toFixed(1)),
          count: ratingsRes.length
        });
      } catch (err) {
        console.error('Error fetching entity ratings for post:', err);
      }
    };
    
    fetchRatings();
    return () => {
      isMounted = false;
    };
  }, [post.entityType, post.entityId, isDeleted]);

  const renderStars = (rating: number, color: string) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<FontAwesome key={i} name="star" size={10} color={color} style={{ marginRight: 1 }} />);
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(<FontAwesome key={i} name="star-half-o" size={10} color={color} style={{ marginRight: 1 }} />);
      } else {
        stars.push(<FontAwesome key={i} name="star-o" size={10} color={color} style={{ marginRight: 1 }} />);
      }
    }
    return stars;
  };
  const navigation = useNavigation<any>();

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
          text2: `No existe ningún usuario con el nombre @${username}`
        });
      } else {
        console.error('Error fetching user for mention:', err);
      }
    } finally {
      setLoadingMention(false);
    }
  };

  const renderContent = (content: string) => {
    if (!content) return null;
    const parts = content.split(/(?<=^|\s)(@[a-zA-Z0-9_-]{3,20}\b)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@') && /^@[a-zA-Z0-9_-]{3,20}$/.test(part)) {
        const username = part.substring(1);
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
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Text style={styles.postAuthor}>{isDeleted ? '[eliminado]' : (author?.name || 'Usuario')}</Text>
                {!isDeleted && author?.username ? <Text style={styles.postUsername}> @{author.username}</Text> : null}
              </TouchableOpacity>
            </View>
            <Text style={styles.postDate}>{formatDate(post.created)}</Text>
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
      
      {post.replyTo && post.expand?.replyTo?.expand?.author ? (
        <Text style={styles.replyContextText}>
          En respuesta a @{post.expand.replyTo.expand.author.username}
        </Text>
      ) : null}

      {!(isDeleted && !!post.entityType) && (
        <Text style={[
          styles.postContent, 
          isFocused && styles.mainPostContent,
          isDeleted && { color: theme.colors.textMuted, fontStyle: 'italic' }
        ]}>
          {isDeleted ? '[Mensaje eliminado]' : renderContent(post.content)}
        </Text>
      )}

      {/* Polymorphic Problem/Pauta Link card */}
      {!!post.entityType && !!post.entityMeta && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.entityCard, isDeleted && { opacity: 0.6 }]}
          onPress={(e) => {
            e.stopPropagation();
            if (onProblemPress) {
              onProblemPress();
            }
          }}
        >
          <View style={styles.entityCardIcon}>
            <Text style={{ fontSize: 22 }}>{post.entityMeta.subtitle === 'Pauta' ? '✍️' : '📄'}</Text>
          </View>
          <View style={styles.entityCardBody}>
            <Text style={styles.entityCardSubtitle}>{post.entityMeta.subtitle}{post.entityMeta.ramo ? ` · ${post.entityMeta.ramo}` : ''}</Text>
            <Text style={[styles.entityCardTitle, isDeleted && { color: theme.colors.textMuted, fontStyle: 'italic' }]} numberOfLines={2}>
              {isDeleted 
                ? (post.entityMeta.subtitle === 'Pauta' ? 'Pauta eliminada' : 'Problema eliminado') 
                : post.entityMeta.title}
            </Text>
            {ratingData && ratingData.count > 0 && (
              <View style={styles.entityRatingsRow}>
                <View style={styles.entityRatingCol}>
                  <Text style={styles.entityRatingLabel}>Nota: </Text>
                  <View style={styles.starsWrapper}>
                    {renderStars(ratingData.rating, '#F59E0B')}
                  </View>
                  <Text style={styles.entityRatingText}>{ratingData.rating}</Text>
                </View>
                <View style={styles.entityRatingCol}>
                  <Text style={styles.entityRatingLabel}>Dificultad: </Text>
                  <View style={styles.starsWrapper}>
                    {renderStars(ratingData.difficulty, '#EF4444')}
                  </View>
                  <Text style={styles.entityRatingText}>{ratingData.difficulty}</Text>
                </View>
              </View>
            )}
          </View>
          <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* Post photo attachment */}
      {!isDeleted && !!post.photo && (
        <Image 
          source={{ uri: getFileUrl(post, post.photo) }}
          style={styles.postImage}
        />
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
            <Text style={[styles.actionCount, isLiked && styles.actionIconActive]}>
              {(post.likes || []).length}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.actionBtn}>
          <Feather 
            name="message-square" 
            size={16} 
            color={theme.colors.textMuted} 
            style={{ marginRight: 6 }}
          />
          <Text style={styles.actionCount}>{repliesCount}</Text>
        </View>
      </View>

      {/* Menu dropdown inside the card */}
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
    resizeMode: 'cover',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  entityRatingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  entityRatingCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entityRatingLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginRight: 2,
  },
  starsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  entityRatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text,
  },
});
