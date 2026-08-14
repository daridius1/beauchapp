import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  DeviceEventEmitter,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { withMinimumDelay } from '../utils/refresh';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { EntityCommentBox } from '../components/EntityCommentBox';
import { PostCard } from '../components/PostCard';
import {
  reviewsService,
  CourseRecord,
  CourseProfessorRecord,
  DualRatingSummary,
} from '../services/reviewsService';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'CourseDetail'>;

const SEMESTRE_SUFIJOS: Record<string, string> = { '0': 'Anual', '1': 'Otoño', '2': 'Primavera', '3': 'Verano' };
const formatSemestre = (id: string) => {
  if (id.length !== 5) return id;
  const year = id.slice(0, 4);
  const suf = SEMESTRE_SUFIJOS[id.slice(4)] || '';
  return `${year} ${suf}`.trim();
};

const EMPTY_RATING: DualRatingSummary = { rating: 0, ratingCount: 0, secondary: 0, secondaryCount: 0, myRating: 0, mySecondary: 0 };

export const CourseDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { courseId } = route.params;
  const { user } = useAuth();

  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [professors, setProfessors] = useState<CourseProfessorRecord[]>([]);
  const [ratingSummary, setRatingSummary] = useState<DualRatingSummary>(EMPTY_RATING);
  const [comments, setComments] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showSemestres, setShowSemestres] = useState(false);
  const [showProfessors, setShowProfessors] = useState(false);

  const fetchDetail = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);

      const [courseRes, professorsRes, commentsRes, ratingRes] = await Promise.allSettled([
        reviewsService.getCourseDetail(courseId),
        reviewsService.getCourseProfessors(courseId),
        pb.collection('posts').getList(1, 50, {
          filter: `targetType = "course" && targetId = "${courseId}" && actionType = "comment" && deleted = false`,
          sort: '+created',
          expand: 'author',
        }),
        reviewsService.getCourseRatingSummary(courseId, user?.id),
      ]);

      if (courseRes.status !== 'fulfilled') throw courseRes.reason;
      setCourse(courseRes.value);

      if (professorsRes.status === 'fulfilled') setProfessors(professorsRes.value);
      if (commentsRes.status === 'fulfilled') setComments((commentsRes.value as any).items);
      if (ratingRes.status === 'fulfilled') setRatingSummary(ratingRes.value);
    } catch (err) {
      console.error('Error fetching course detail:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDetail();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId, user])
  );

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchDetail(true));
      setLoading(false);
    });
    return () => sub.remove();
  }, [courseId, user]);

  // Tras calificar solo cambió la calificación: refrescar únicamente ese dato en vez de
  // volver a pedir el ramo, los profesores y los comentarios (que no cambiaron) con fetchDetail.
  const refreshRatingOnly = async () => {
    try {
      const summary = await reviewsService.getCourseRatingSummary(courseId, user?.id);
      setRatingSummary(summary);
    } catch (err) {
      console.error('Error refreshing course rating:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchDetail(true));
  };

  const handleRatingSubmit = async (axis: 'rating' | 'secondary', value: number) => {
    if (!user) {
      Toast.show({ type: 'error', text1: 'Inicia sesión', text2: 'Debes iniciar sesión para calificar este ramo.' });
      return;
    }

    const prev = ratingSummary;
    const isRating = axis === 'rating';
    const avg = isRating ? prev.rating : prev.secondary;
    const count = isRating ? prev.ratingCount : prev.secondaryCount;
    const prevMine = isRating ? (prev.myRating || 0) : (prev.mySecondary || 0);

    let nextAvg = avg;
    let nextCount = count;
    if (value !== prevMine) {
      if (prevMine > 0 && value > 0) {
        nextAvg = ((avg * count) - prevMine + value) / count;
      } else if (prevMine > 0 && value === 0) {
        nextCount = count - 1;
        nextAvg = nextCount > 0 ? ((avg * count) - prevMine) / nextCount : 0;
      } else if (prevMine === 0 && value > 0) {
        nextCount = count + 1;
        nextAvg = ((avg * count) + value) / nextCount;
      }
    }
    nextAvg = parseFloat(nextAvg.toFixed(1));

    setRatingSummary(
      isRating
        ? { ...prev, rating: nextAvg, ratingCount: nextCount, myRating: value }
        : { ...prev, secondary: nextAvg, secondaryCount: nextCount, mySecondary: value }
    );

    setSubmittingRating(true);
    try {
      await reviewsService.submitCourseRating(courseId, user.id, axis, value);
      refreshRatingOnly();
    } catch (err) {
      console.error('Error submitting course rating:', err);
      setRatingSummary(prev);
      Toast.show({ type: 'error', text1: 'Error al calificar' });
    } finally {
      setSubmittingRating(false);
    }
  };

  const renderStars = (value: number, color: string) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (value >= i) {
        stars.push(<FontAwesome key={i} name="star" size={14} color={color} style={{ marginRight: 2 }} />);
      } else if (value >= i - 0.75) {
        stars.push(<FontAwesome key={i} name="star-half-o" size={14} color={color} style={{ marginRight: 2 }} />);
      } else {
        stars.push(<FontAwesome key={i} name="star" size={14} color="#262626" style={{ marginRight: 2 }} />);
      }
    }
    return stars;
  };

  const renderStarsSelector = (currentValue: number, color: string, onSelect: (val: number) => void) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity key={i} onPress={() => onSelect(i)} disabled={submittingRating}>
          <FontAwesome name="star" size={22} color={i <= currentValue ? color : '#262626'} style={{ marginRight: 6 }} />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const handleSendComment = async (content: string, photoFile: File | null, pollOptions: string[] | null) => {
    if ((!content.trim() && !photoFile) || !user || !course) return;
    try {
      const postData: any = {
        content: content.trim() || ' ',
        author: user.id,
        actionType: 'comment',
        targetType: 'course',
        targetId: course.id,
        targetMeta: { codigo: course.codigo, nombre: course.nombre, area: course.area },
      };
      if (photoFile) postData.photo = photoFile;
      if (pollOptions && pollOptions.length >= 2) postData.pollOptions = pollOptions;

      const created = await pb.collection('posts').create(postData, { expand: 'author' });
      setComments((prev) => [...prev, created]);
      setCourse((prev) => (prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : prev));
      Toast.show({ type: 'success', text1: 'Comentario publicado' });
    } catch (err) {
      console.error('Error enviando comentario:', err);
      Toast.show({ type: 'error', text1: 'Error al enviar comentario' });
      throw err;
    }
  };

  const toggleLikeComment = async (post: any) => {
    if (!user) return;
    try {
      const currentLikes = post.likes || [];
      let newLikes = [...currentLikes];
      if (newLikes.includes(user.id)) newLikes = newLikes.filter((id: string) => id !== user.id);
      else newLikes.push(user.id);
      setComments((prev) => prev.map((p) => (p.id === post.id ? { ...p, likes: newLikes } : p)));
      await pb.collection('posts').update(post.id, { likes: newLikes });
    } catch (err) {
      console.error('Error liking comment:', err);
      setComments((prev) => prev.map((p) => (p.id === post.id ? { ...p, likes: post.likes || [] } : p)));
    }
  };

  const handleDeleteComment = async (postId: string) => {
    try {
      setComments((prev) => prev.filter((p) => p.id !== postId));
      await pb.collection('posts').update(postId, { deleted: true });
      Toast.show({ type: 'success', text1: 'Comentario eliminado' });
    } catch (err) {
      console.error('Error deleting comment:', err);
      fetchDetail(true);
    }
  };

  const handleCiteCourse = () => {
    if (!user || !course) {
      Toast.show({ type: 'info', text1: 'Autenticación requerida', text2: 'Inicia sesión para citar.' });
      return;
    }
    navigation.navigate('Home', {
      quoteTargetType: 'course',
      quoteTargetId: course.id,
      quoteTargetMeta: { codigo: course.codigo, nombre: course.nombre, area: course.area },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Este ramo no está disponible.</Text>
      </View>
    );
  }

  const semestreIds = Object.keys(course.semestres || {}).sort().reverse();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />
        }
      >
        <Text style={styles.courseTitle}>{course.nombre || course.codigo}</Text>
        <Text style={styles.courseSubtitle}>
          {course.codigo}{course.area ? ` · ${course.area}` : ''}
        </Text>

        {semestreIds.length > 0 && (
          <View style={styles.expandableContainer}>
            <TouchableOpacity
              style={styles.expandableHeader}
              onPress={() => setShowSemestres(!showSemestres)}
              activeOpacity={0.8}
            >
              <Text style={styles.expandableHeaderText}>
                Dictado en {semestreIds.length} semestre{semestreIds.length !== 1 ? 's' : ''}
                {semestreIds[0] ? ` · último: ${formatSemestre(semestreIds[0])}` : ''}
              </Text>
              <Feather name={showSemestres ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.primary} />
            </TouchableOpacity>

            {showSemestres && (
              <View style={styles.expandableContent}>
                {semestreIds.map((semId, index) => (
                  <View key={semId} style={[styles.semestreRow, index === semestreIds.length - 1 && styles.rowNoBorder]}>
                    <Text style={styles.semestreRowLabel}>{formatSemestre(semId)}</Text>
                    <Text style={styles.semestreRowValue}>
                      {course.semestres?.[semId] || 0} sección{(course.semestres?.[semId] || 0) !== 1 ? 'es' : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.divider} />

        {/* Estadísticas Promedio de Calificación */}
        <View style={styles.avgStatsContainer}>
          <View style={styles.avgStatBox}>
            <Text style={styles.avgStatLabel}>Calidad</Text>
            <View style={styles.starsWrapper}>
              {renderStars(ratingSummary.rating, '#F59E0B')}
            </View>
            <Text style={styles.avgStatValue}>{ratingSummary.rating} / 5 ({ratingSummary.ratingCount})</Text>
          </View>
          <View style={styles.avgStatBox}>
            <Text style={styles.avgStatLabel}>Dificultad</Text>
            <View style={styles.starsWrapper}>
              {renderStars(ratingSummary.secondary, '#EF4444')}
            </View>
            <Text style={styles.avgStatValue}>{ratingSummary.secondary} / 5 ({ratingSummary.secondaryCount})</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Calificar Ramo */}
        {user && (
          <>
            <View style={styles.ratingForm}>
              <Text style={styles.ratingFormTitle}>Califica este ramo</Text>

              <View style={styles.selectorRow}>
                <Text style={styles.selectorLabel}>Calidad</Text>
                <Text style={styles.selectorSeparator}>|</Text>
                <View style={[styles.starsSelectorWrapper, { alignItems: 'center' }]}>
                  {renderStarsSelector(ratingSummary.myRating || 0, '#F59E0B', (val) => handleRatingSubmit('rating', val))}
                  {!!ratingSummary.myRating && ratingSummary.myRating > 0 && (
                    <TouchableOpacity onPress={() => handleRatingSubmit('rating', 0)} style={styles.clearRatingBtn} activeOpacity={0.7}>
                      <Feather name="x" size={16} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.selectorRow}>
                <Text style={styles.selectorLabel}>Dificultad</Text>
                <Text style={styles.selectorSeparator}>|</Text>
                <View style={[styles.starsSelectorWrapper, { alignItems: 'center' }]}>
                  {renderStarsSelector(ratingSummary.mySecondary || 0, '#EF4444', (val) => handleRatingSubmit('secondary', val))}
                  {!!ratingSummary.mySecondary && ratingSummary.mySecondary > 0 && (
                    <TouchableOpacity onPress={() => handleRatingSubmit('secondary', 0)} style={styles.clearRatingBtn} activeOpacity={0.7}>
                      <Feather name="x" size={16} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </>
        )}

        <View style={styles.divider} />

        {professors.length === 0 ? (
          <>
            <Text style={styles.sectionTitle}>Profesores</Text>
            <Text style={styles.emptyText}>No hay profesores registrados para este ramo.</Text>
          </>
        ) : (
          <TouchableOpacity
            style={styles.expandableSectionHeader}
            onPress={() => setShowProfessors(!showProfessors)}
            activeOpacity={0.8}
          >
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Profesores</Text>
            <Feather name={showProfessors ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        )}

        {showProfessors && (
          <View style={styles.professorsListContainer}>
            {professors.map((cp, index) => (
              <TouchableOpacity
                key={cp.id}
                style={[styles.professorRow, index === professors.length - 1 && styles.rowNoBorder]}
                activeOpacity={0.7}
                onPress={() => cp.expand?.professor && navigation.push('ProfessorDetail', { professorId: cp.expand.professor.id })}
              >
                <Text style={styles.professorName}>{cp.expand?.professor?.nombre || 'Profesor'}</Text>
                <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.commentsHeaderRow}>
          <Text style={styles.sectionTitle}>Comentarios</Text>
          <TouchableOpacity style={styles.quoteHeaderBtn} activeOpacity={0.7} onPress={handleCiteCourse}>
            <FontAwesome name="quote-left" size={11} color={theme.colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.quoteHeaderBtnText}>Citar</Text>
          </TouchableOpacity>
        </View>

        {user && (
          <EntityCommentBox
            placeholder="Escribe un comentario sobre este ramo..."
            style={{ marginHorizontal: -theme.spacing.lg }}
            onSendComment={handleSendComment}
          />
        )}

        {comments.length === 0 ? (
          <View style={styles.emptyAnswers}>
            <Feather name="message-square" size={28} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyAnswersText}>Aún no hay comentarios.</Text>
            <Text style={styles.emptyAnswersSub}>Sé el primero en comentar este ramo.</Text>
          </View>
        ) : (
          comments.map((c) => (
            <View key={c.id} style={{ marginHorizontal: -theme.spacing.lg }}>
              <PostCard
                post={c}
                currentUser={user}
                hideTargetContext={true}
                onPress={() => navigation.push('PostDetail', { postId: c.id })}
                onLikePress={() => toggleLikeComment(c)}
                onDeletePress={() => handleDeleteComment(c.id)}
                onAuthorPress={() => navigation.push('UserProfile', { userId: c.author })}
              />
            </View>
          ))
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
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: 40,
  },
  courseTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  courseSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  expandableContainer: {
    marginTop: theme.spacing.sm,
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandableHeaderText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  expandableContent: {
    marginTop: theme.spacing.sm,
  },
  semestreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  semestreRowLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  semestreRowValue: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  expandableSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: theme.spacing.sm,
  },
  avgStatsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  avgStatBox: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  avgStatLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  starsWrapper: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  avgStatValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  ratingForm: {
    paddingVertical: theme.spacing.sm,
  },
  ratingFormTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  selectorLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    width: 90,
  },
  selectorSeparator: {
    color: theme.colors.border,
    marginHorizontal: 12,
    fontSize: 14,
  },
  starsSelectorWrapper: {
    flexDirection: 'row',
  },
  clearRatingBtn: {
    padding: 4,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowNoBorder: {
    borderBottomWidth: 0,
  },
  professorsListContainer: {
    marginTop: theme.spacing.md,
  },
  professorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  professorName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  commentsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
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
  emptyAnswers: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: theme.spacing.md,
  },
  emptyAnswersText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyAnswersSub: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
});
