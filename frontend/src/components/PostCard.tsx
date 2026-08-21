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
import { ContentActionsMenu, ContentAction } from './ContentActionsMenu';
import { ReportModal } from './ReportModal';
import { LinkConfirmModal } from './LinkConfirmModal';
import { PollView } from './PollView';

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
  hideTargetContext?: boolean;
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
  hideTargetContext = false,
}) => {
  const { developerMode } = useAuth();
  const navigation = useNavigation<any>();

  const [loadingMention, setLoadingMention] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [linkModalUrl, setLinkModalUrl] = useState<string | null>(null);

  const isDeleted = post.deleted === true;
  const author = isDeleted ? null : post.expand?.author;
  const isLiked = currentUser && (post.likes || []).includes(currentUser.id);
  const repliesCount = post.commentCount || 0;
  const isOwnPost = !!currentUser && post.author === currentUser.id;

  const cardActions: ContentAction[] = [];
  if (currentUser && !isDeleted) {
    if (isOwnPost && onDeletePress) {
      cardActions.push({ key: 'delete', icon: 'trash-2', label: 'Eliminar', onPress: onDeletePress, destructive: true });
    } else if (!isOwnPost) {
      cardActions.push({ key: 'report', icon: 'flag', label: 'Reportar', onPress: () => setShowReportModal(true) });
    }
  }

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

  const handleDefaultTargetPress = () => {
    if (onTargetPress) {
      onTargetPress();
      return;
    }
    if (!post.targetType || !post.targetId) return;
    if (post.targetType === 'post') {
      navigation.push('PostDetail', { postId: post.targetId });
    } else if (post.targetType === 'problem') {
      navigation.push('ProblemDetail', { problemId: post.targetId });
    } else if (post.targetType === 'match') {
      navigation.push('LadderMatchDetail', { matchId: post.targetId });
    } else if (post.targetType === 'league_match') {
      navigation.push('LeagueMatchDetail', { matchId: post.targetId });
    } else if (post.targetType === 'league') {
      navigation.push('LeagueDetail', { leagueId: post.targetId });
    } else if (post.targetType === 'team') {
      navigation.push('TeamProfile', { teamId: post.targetId });
    } else if (post.targetType === 'marketplace_item' || post.targetType === 'product') {
      navigation.push('MarketplaceItemDetail', { itemId: post.targetId });
    } else if (post.targetType === 'seller_profile' || post.targetType === 'seller') {
      navigation.push('SellerProfile', { sellerProfileId: post.targetId });
    } else if (post.targetType === 'activity') {
      navigation.push('ActivityDetail', { activityId: post.targetId });
    } else if (post.targetType === 'course') {
      navigation.push('CourseDetail', { courseId: post.targetId });
    } else if (post.targetType === 'beaumarket') {
      navigation.push('BeaumarketDetail', { marketId: post.targetId });
    } else if (post.targetType === 'beaudle') {
      if (post.targetMeta?.day) {
        navigation.push('BeaudleDay', { day: post.targetMeta.day });
      } else {
        navigation.push('Beaudle');
      }
    }
  };

  const handleDefaultQuotePress = () => {
    navigation.navigate('Home', {
      quoteTargetType: 'post',
      quoteTargetId: post.id,
      quoteTargetMeta: {
        authorName: post.expand?.author?.name || 'Usuario',
        authorUsername: post.expand?.author?.username || '',
        content: post.content || '',
        photo: post.photo || '',
      }
    });
  };

  const renderContent = (contentStr: string) => {
    if (!contentStr) return null;
    const parts = contentStr.split(/(@[a-zA-Z0-9_.-]+|https?:\/\/[^\s]+)/g);

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
      if (/^https?:\/\//.test(part)) {
        return (
          <Text
            key={index}
            style={styles.linkText}
            onPress={(e: any) => {
              if (e.stopPropagation) e.stopPropagation();
              setLinkModalUrl(part);
            }}
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
              <TouchableOpacity
                onPress={isDeleted ? undefined : onAuthorPress}
                disabled={isDeleted || !onAuthorPress}
                activeOpacity={0.7}
              >
                <Text style={styles.postAuthor}>{isDeleted ? '[eliminado]' : (author?.name || 'Usuario')}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                {!isDeleted && author?.username && (
                  <>
                    <TouchableOpacity
                      onPress={onAuthorPress}
                      disabled={!onAuthorPress}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.postUsername}>@{author.username}</Text>
                    </TouchableOpacity>
                    <Text style={styles.postMetaDot}>·</Text>
                  </>
                )}
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
          </View>

          <ContentActionsMenu actions={cardActions} />
        </View>
        
        {/* Contexto NO clickeable para Respuestas entre Posts */}
        {!!(post.actionType === 'reply' || post.replyTo) && (
          <View style={{ marginBottom: 2 }}>
            <Text style={styles.replyContextText}>
              En respuesta a{' '}
              {post.expandedTarget?.deleted || post.expand?.replyTo?.deleted ? (
                <Text style={{ fontStyle: 'italic', color: theme.colors.textMuted }}>publicación eliminada</Text>
              ) : (
                <Text style={{ fontWeight: '700' }}>
                  @{post.expandedTarget?.expand?.author?.username || post.expand?.replyTo?.expand?.author?.username || post.targetMeta?.authorUsername || 'Usuario'}
                </Text>
              )}
            </Text>
          </View>
        )}

        {/* Contexto clickeable para Comentarios a Objetos No-Post (Problemas, Partidos, Productos, Vendedores, Actividades, etc.) */}
        {!hideTargetContext && post.actionType === 'comment' && !!post.targetType && !!post.targetId && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={(e: any) => {
              if (e.stopPropagation) e.stopPropagation();
              handleDefaultTargetPress();
            }}
          >
            <Text style={styles.replyContextText}>
              En respuesta a {
                post.targetType === 'problem' ? 'Problema: ' :
                post.targetType === 'match' ? 'Partido: ' :
                post.targetType === 'league_match' ? 'Partido: ' :
                post.targetType === 'league' ? 'Liga: ' :
                post.targetType === 'team' ? 'Equipo: ' :
                (post.targetType === 'marketplace_item' || post.targetType === 'product') ? 'Producto: ' :
                (post.targetType === 'seller_profile' || post.targetType === 'seller') ? 'Vendedor: ' :
                post.targetType === 'activity' ? 'Actividad: ' :
                post.targetType === 'course' ? 'Ramo: ' :
                post.targetType === 'beaumarket' ? 'Mercado: ' :
                post.targetType === 'beaudle' ? 'Beaudle: ' : ''
              }
              <Text style={{ fontWeight: '700', textDecorationLine: 'underline' }}>
                {post.targetMeta?.title || post.targetMeta?.sportName || post.targetMeta?.sellerName || post.targetMeta?.nombre ||
                post.targetMeta?.name ||
                (post.targetType === 'beaudle' && post.targetMeta?.dayNumber ? `#${post.targetMeta.dayNumber}` : null) ||
                (post.targetType === 'league_match' && post.targetMeta?.teamAName && post.targetMeta?.teamBName
                  ? `${post.targetMeta.teamAName} vs ${post.targetMeta.teamBName}` : null) || (
                  post.targetType === 'problem' ? 'Ver problema' :
                  post.targetType === 'match' ? 'Ver partido' :
                  post.targetType === 'league_match' ? 'Ver partido' :
                  post.targetType === 'league' ? 'Ver liga' :
                  post.targetType === 'team' ? 'Ver equipo' :
                  (post.targetType === 'marketplace_item' || post.targetType === 'product') ? 'Ver producto' :
                  (post.targetType === 'seller_profile' || post.targetType === 'seller') ? 'Ver tienda' :
                  post.targetType === 'activity' ? 'Ver actividad' :
                  post.targetType === 'course' ? 'Ver ramo' :
                  post.targetType === 'beaumarket' ? 'Ver mercado' :
                  post.targetType === 'beaudle' ? 'Ver Beaudle' : 'Ver detalle'
                )}
              </Text>
            </Text>
          </TouchableOpacity>
        )}

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

        {/* Target Preview Polimórfico (solo para citas, no para respuestas ni comentarios) —
            va después de la imagen del post a propósito, no antes. */}
        {post.actionType === 'quote' && !!post.targetType && !!post.targetId && (
          <TargetPreview
            targetType={post.targetType}
            targetId={post.targetId}
            targetMeta={post.targetMeta}
            expandedTarget={post.expandedTarget}
            onPress={handleDefaultTargetPress}
          />
        )}

        {/* Encuesta */}
        {!isDeleted && post.pollOptions && post.pollOptions.length >= 2 && (
          <PollView post={post} currentUser={currentUser} />
        )}

        {/* Tags (solo se muestran en publicaciones o citas principales, no en respuestas ni comentarios) */}
        {!isDeleted && post.actionType !== 'reply' && post.actionType !== 'comment' && !post.replyTo && post.tags && post.tags.length > 0 && (
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

          <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
            <Feather 
              name="message-square" 
              size={16} 
              color={theme.colors.textMuted} 
              style={{ marginRight: 6 }}
            />
            <Text style={styles.actionCount}>{repliesCount}</Text>
          </TouchableOpacity>

          {!isDeleted && (
            <TouchableOpacity style={styles.actionBtn} onPress={onRepostPress || handleDefaultQuotePress}>
              <FontAwesome 
                name="quote-left" 
                size={14} 
                color={theme.colors.textMuted} 
              />
            </TouchableOpacity>
          )}
        </View>

      </CardComponent>
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="post"
        targetId={post.id}
      />
      <LinkConfirmModal
        visible={!!linkModalUrl}
        url={linkModalUrl}
        onClose={() => setLinkModalUrl(null)}
      />
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
    flex: 1,
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
  postMetaDot: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginHorizontal: 4,
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
  linkText: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
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
