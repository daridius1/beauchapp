import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Linking, RefreshControl, DeviceEventEmitter } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { pb, getFileUrl } from '../services/pocketbase';
import { ActivityRecord, activityService } from '../services/activityService';
import { OrgChip } from '../components/OrgChip';
import { EntityCommentBox } from '../components/EntityCommentBox';
import { PostCard } from '../components/PostCard';
import { withMinimumDelay } from '../utils/refresh';

export const ActivityDetailScreen = ({ route, navigation }: any) => {
  const targetActivityId = route.params?.activityId || route.params?.id;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activity, setActivity] = useState<ActivityRecord | null>(null);
  const [bannerAspectRatio, setBannerAspectRatio] = useState<number | undefined>(undefined);

  // Estados de interacción
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeRecordId, setLikeRecordId] = useState<string | undefined>();

  const [attending, setAttending] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [attendeeRecordId, setAttendeeRecordId] = useState<string | undefined>();

  // Comentarios del foro vinculados
  const [comments, setComments] = useState<any[]>([]);

  const loadData = async (hideLoading = false) => {
    if (!targetActivityId) {
      setLoading(false);
      return;
    }
    try {
      if (!hideLoading) setLoading(true);

      // Las 3 solo dependen de targetActivityId/user.id (conocidos de antemano), en paralelo.
      const [actResult, interResult, commentsResult] = await Promise.allSettled([
        activityService.getActivityById(targetActivityId),
        user?.id ? activityService.checkUserInteractions(targetActivityId, user.id) : Promise.resolve(null),
        pb.collection('posts').getList(1, 50, {
          filter: `targetType = "activity" && targetId = "${targetActivityId}" && deleted = false`,
          sort: 'created',
          expand: 'author,replyTo.author',
        }),
      ]);

      if (actResult.status !== 'fulfilled') throw actResult.reason;
      const actData = actResult.value;
      if (!actData) {
        setLoading(false);
        return;
      }

      setActivity(actData);
      setLikeCount(actData.like_count || 0);
      setAttendeeCount(actData.attendee_count || 0);

      const bUrl = activityService.getBannerUrl(actData, '800x0');
      if (bUrl) {
        Image.getSize(
          bUrl,
          (w, h) => {
            if (w && h) setBannerAspectRatio(w / h);
          },
          () => {}
        );
      }

      // Estado de interacciones del usuario
      if (user?.id) {
        if (interResult.status === 'fulfilled' && interResult.value) {
          const inter = interResult.value;
          setLiked(inter.liked);
          setLikeRecordId(inter.likeRecordId);
          setAttending(inter.attending);
          setAttendeeRecordId(inter.attendeeRecordId);
        } else if (interResult.status === 'rejected') {
          console.error('Error cargando interacciones de actividad:', interResult.reason);
        }
      }

      // Comentarios polimórficos vinculados a la actividad
      if (commentsResult.status === 'fulfilled') {
        setComments(commentsResult.value.items);
      } else {
        console.error('Error cargando comentarios de actividad:', commentsResult.reason);
      }
    } catch (err) {
      console.error('Error al cargar detalle de actividad:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [targetActivityId, user?.id]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => loadData(true));
      setLoading(false);
    });
    return () => sub.remove();
  }, [targetActivityId, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await withMinimumDelay(() => loadData(true));
    setRefreshing(false);
  }, [targetActivityId, user?.id]);

  const handleToggleLike = async () => {
    if (!user) {
      Toast.show({ type: 'info', text1: 'Inicia sesión', text2: 'Debes iniciar sesión para dar me gusta.' });
      return;
    }
    if (!activity) return;

    // Actualización optimista de UI
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const isNowLiked = await activityService.toggleLike(activity.id, user.id, likeRecordId);
      setLiked(isNowLiked);
      const inter = await activityService.checkUserInteractions(activity.id, user.id);
      setLikeRecordId(inter.likeRecordId);
    } catch (err) {
      console.error('Error al dar like:', err);
      setLiked(prevLiked);
      setLikeCount(prevCount);
    }
  };

  const handleToggleAttendance = async () => {
    if (!user) {
      Toast.show({ type: 'info', text1: 'Inicia sesión', text2: 'Debes iniciar sesión para confirmar tu asistencia.' });
      return;
    }
    if (!activity) return;

    // Actualización optimista de UI
    const prevAttending = attending;
    const prevCount = attendeeCount;
    setAttending(!prevAttending);
    setAttendeeCount(prevAttending ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const isNowAttending = await activityService.toggleAttendance(activity.id, user.id, attendeeRecordId);
      setAttending(isNowAttending);
      const inter = await activityService.checkUserInteractions(activity.id, user.id);
      setAttendeeRecordId(inter.attendeeRecordId);

      Toast.show({
        type: 'success',
        text1: isNowAttending ? '¡Asistencia confirmada!' : 'Asistencia cancelada',
        text2: isNowAttending ? 'Aparecerás como asistente en este evento.' : 'Ya no figuras como asistente.',
      });
    } catch (err) {
      console.error('Error al cambiar asistencia:', err);
      setAttending(prevAttending);
      setAttendeeCount(prevCount);
    }
  };

  const handleSendComment = async (content: string, photo: File | null) => {
    if (!user || !activity) return;

    const formData = new FormData();
    formData.append('author', user.id);
    formData.append('actionType', 'comment');
    formData.append('targetType', 'activity');
    formData.append('targetId', activity.id);
    formData.append('content', content || ' ');

    if (photo) {
      formData.append('photo', photo);
    }

    await pb.collection('posts').create(formData);
    await loadData(true);
  };

  const handleQuoteActivity = () => {
    if (!activity) return;
    navigation.navigate('Home', {
      quoteTargetType: 'activity',
      quoteTargetId: activity.id,
      quoteTargetMeta: {
        title: activity.title,
        location: activity.location,
        date: activity.date,
        startTime: activity.start_time,
        endTime: activity.end_time,
        orgName: activity.expand?.organization?.name || 'Organización',
        category: activity.category,
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginBottom: 12 }}>Actividad no encontrada.</Text>
        <TouchableOpacity
          style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Activities')}
        >
          <Text style={{ color: '#000000', fontWeight: '800', fontSize: 14 }}>Volver a Actividades</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const org = activity.expand?.organization;
  const bannerUrl = activityService.getBannerUrl(activity, '800x0');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      {/* Portada / Banner con límite de ancho max celus y alto autodimensionado */}
      {!!bannerUrl && (
        <View style={styles.bannerWrapper}>
          <Image
            source={{ uri: bannerUrl }}
            style={[
              styles.bannerImage,
              bannerAspectRatio ? { aspectRatio: bannerAspectRatio } : { height: 250 }
            ]}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Contenido Principal */}
      <View style={styles.mainContent}>
        {/* Cabecera: Organización y Categoría en texto limpio */}
        <View style={styles.headerRow}>
          <Text style={styles.orgCategoryText} numberOfLines={1}>
            <Text
              style={styles.orgText}
              onPress={org ? () => navigation.navigate('UserProfile', { userId: org.id }) : undefined}
            >
              @{org?.username || org?.name || 'organización'}
            </Text>
            {!!activity.category && (
              <Text style={styles.dotSeparator}> • {activity.category}</Text>
            )}
          </Text>

          {!!activity.price && (
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>{activity.price}</Text>
            </View>
          )}
        </View>

        {/* Título de la Actividad */}
        <Text style={styles.title}>{activity.title}</Text>

        {/* Información Logística (Fecha, Horario, Lugar) directamente en la página, sin Card ni cajas de color */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Feather name="calendar" size={16} color={theme.colors.textMuted} style={styles.infoIconInline} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Fecha</Text>
              <Text style={styles.infoValue}>{activity.date}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Feather name="clock" size={16} color={theme.colors.textMuted} style={styles.infoIconInline} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Horario</Text>
              <Text style={styles.infoValue}>
                {activity.start_time} hrs – {activity.end_time} hrs
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Feather name="map-pin" size={16} color={theme.colors.textMuted} style={styles.infoIconInline} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Ubicación</Text>
              <Text style={styles.infoValue}>{activity.location}</Text>
            </View>
          </View>

          {!!activity.external_link && (
            <TouchableOpacity
              style={styles.externalLinkRow}
              onPress={() => activity.external_link && Linking.openURL(activity.external_link)}
            >
              <Feather name="external-link" size={14} color={theme.colors.primary} />
              <Text style={styles.externalLinkText} numberOfLines={1}>
                {activity.external_link}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Botones de Acción Interactivas (Like, Asistiré, Ver Asistentes) */}
        <View style={styles.actionsBar}>
          {/* Botón Like */}
          <TouchableOpacity
            style={[styles.actionBtn, liked && styles.actionBtnLiked]}
            onPress={handleToggleLike}
            activeOpacity={0.8}
          >
            <Feather name="heart" size={16} color={liked ? '#ef4444' : '#888888'} />
            <Text style={[styles.actionBtnText, liked && { color: '#ef4444' }]}>
              {likeCount}
            </Text>
          </TouchableOpacity>

          {/* Botón Asistiré */}
          <TouchableOpacity
            style={[styles.actionBtn, attending && styles.actionBtnAttending]}
            onPress={handleToggleAttendance}
            activeOpacity={0.8}
          >
            <Feather name="check-circle" size={16} color={attending ? '#10b981' : '#888888'} />
            <Text style={[styles.actionBtnText, attending && { color: '#10b981' }]}>
              {attending ? '¡Asistiré!' : 'Asistiré'}
            </Text>
          </TouchableOpacity>

          {/* Botón para Ver Asistentes */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('FollowList', { userId: activity.id, type: 'attendees', title: 'Asistentes a la actividad' })}
            activeOpacity={0.8}
          >
            <Feather name="users" size={16} color="#10b981" />
            <Text style={[styles.actionBtnText, { color: '#10b981' }]}>
              Asistentes ({attendeeCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Descripción en Texto Plano */}
        {!!activity.description && (
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Acerca del evento</Text>
            <Text style={styles.descriptionText}>{activity.description}</Text>
          </View>
        )}

        {/* Sección de Comentarios con Botón Citar al lado del encabezado */}
        <View style={styles.commentsSection}>
          <View style={styles.commentsHeaderRow}>
            <Text style={styles.sectionTitle}>Comentarios ({comments.length})</Text>

            <TouchableOpacity
              style={styles.quoteHeaderBtn}
              activeOpacity={0.7}
              onPress={handleQuoteActivity}
            >
              <FontAwesome name="quote-left" size={11} color={theme.colors.text} style={{ marginRight: 6 }} />
              <Text style={styles.quoteHeaderBtnText}>Citar</Text>
            </TouchableOpacity>
          </View>

          {/* Caja de Comentarios */}
          <EntityCommentBox onSendComment={handleSendComment} placeholder="Pregunta o comenta sobre esta actividad..." />

          {/* Lista de Comentarios */}
          {comments.map((comment) => (
            <PostCard
              key={comment.id}
              post={comment}
              currentUser={user}
              hideTargetContext={true}
              onPress={() => navigation.push('PostDetail', { postId: comment.id })}
              onAuthorPress={() => navigation.navigate('UserProfile', { userId: comment.author })}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  bannerWrapper: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: '#000000',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 6,
  },
  bannerImage: {
    width: '100%',
    backgroundColor: '#000000',
  },
  mainContent: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orgCategoryText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    flex: 1,
  },
  orgText: {
    fontWeight: '700',
    color: theme.colors.primary,
  },
  dotSeparator: {
    color: '#888888',
    fontWeight: '500',
  },
  priceBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  priceBadgeText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 16,
    lineHeight: 28,
  },
  infoSection: {
    marginBottom: 20,
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconInline: {
    marginRight: 4,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 1,
  },
  externalLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
  },
  externalLinkText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: '#262626',
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnLiked: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  actionBtnAttending: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  descriptionSection: {
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 14,
    color: '#d4d4d4',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  commentsSection: {
    marginTop: 8,
  },
  commentsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quoteHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quoteHeaderBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
