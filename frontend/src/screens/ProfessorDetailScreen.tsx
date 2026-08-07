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
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { withMinimumDelay } from '../utils/refresh';
import { Feather, FontAwesome } from '@expo/vector-icons';
import {
  reviewsService,
  ProfessorRecord,
  CourseProfessorRecord,
  DualRatingSummary,
} from '../services/reviewsService';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfessorDetail'>;

const EMPTY_RATING: DualRatingSummary = { rating: 0, ratingCount: 0, secondary: 0, secondaryCount: 0, myRating: 0, mySecondary: 0 };

export const ProfessorDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { professorId } = route.params;
  const { user } = useAuth();

  const [professor, setProfessor] = useState<ProfessorRecord | null>(null);
  const [courses, setCourses] = useState<CourseProfessorRecord[]>([]);
  const [ratingSummary, setRatingSummary] = useState<DualRatingSummary>(EMPTY_RATING);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);

  const fetchDetail = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);

      const [professorRes, coursesRes, ratingRes] = await Promise.allSettled([
        reviewsService.getProfessorDetail(professorId),
        reviewsService.getProfessorCourses(professorId),
        reviewsService.getProfessorRatingSummary(professorId, user?.id),
      ]);

      if (professorRes.status !== 'fulfilled') throw professorRes.reason;
      setProfessor(professorRes.value);

      if (coursesRes.status === 'fulfilled') setCourses(coursesRes.value);
      if (ratingRes.status === 'fulfilled') setRatingSummary(ratingRes.value);
    } catch (err) {
      console.error('Error fetching professor detail:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDetail();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [professorId, user])
  );

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchDetail(true));
      setLoading(false);
    });
    return () => sub.remove();
  }, [professorId, user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchDetail(true));
  };

  // Tras calificar solo cambió la calificación: refrescar únicamente ese dato en vez de
  // volver a pedir el profesor y sus ramos (que no cambiaron) con fetchDetail.
  const refreshRatingOnly = async () => {
    try {
      const summary = await reviewsService.getProfessorRatingSummary(professorId, user?.id);
      setRatingSummary(summary);
    } catch (err) {
      console.error('Error refreshing professor rating:', err);
    }
  };

  const handleRatingSubmit = async (axis: 'rating' | 'secondary', value: number) => {
    if (!user) {
      Toast.show({ type: 'error', text1: 'Inicia sesión', text2: 'Debes iniciar sesión para calificar a este profesor.' });
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
      await reviewsService.submitProfessorRating(professorId, user.id, axis, value);
      refreshRatingOnly();
    } catch (err) {
      console.error('Error submitting professor rating:', err);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!professor) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Este profesor no está disponible.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />
        }
      >
        <Text style={styles.professorTitle}>{professor.nombre}</Text>

        <View style={styles.divider} />

        {/* Estadísticas Promedio de Calificación */}
        <View style={styles.avgStatsContainer}>
          <View style={styles.avgStatBox}>
            <Text style={styles.avgStatLabel}>Clases</Text>
            <View style={styles.starsWrapper}>
              {renderStars(ratingSummary.rating, '#F59E0B')}
            </View>
            <Text style={styles.avgStatValue}>{ratingSummary.rating} / 5 ({ratingSummary.ratingCount})</Text>
          </View>
          <View style={styles.avgStatBox}>
            <Text style={styles.avgStatLabel}>Gestión</Text>
            <View style={styles.starsWrapper}>
              {renderStars(ratingSummary.secondary, '#EF4444')}
            </View>
            <Text style={styles.avgStatValue}>{ratingSummary.secondary} / 5 ({ratingSummary.secondaryCount})</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Calificar Profesor */}
        {user && (
          <View style={styles.ratingForm}>
            <Text style={styles.ratingFormTitle}>Califica a este profesor</Text>

            <View style={styles.selectorRow}>
              <Text style={styles.selectorLabel}>Clases</Text>
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
              <Text style={styles.selectorLabel}>Gestión</Text>
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
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Ramos dictados</Text>
        {courses.length === 0 ? (
          <Text style={styles.emptyText}>No hay ramos registrados para este profesor.</Text>
        ) : (
          courses.map((cp, index) => (
            <TouchableOpacity
              key={cp.id}
              style={[styles.courseRow, index === courses.length - 1 && styles.rowNoBorder]}
              activeOpacity={0.7}
              onPress={() => cp.expand?.course && navigation.push('CourseDetail', { courseId: cp.expand.course.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.courseName} numberOfLines={1}>{cp.expand?.course?.nombre || cp.expand?.course?.codigo}</Text>
                <Text style={styles.courseCode}>{cp.expand?.course?.codigo}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
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
  professorTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
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
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  courseName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  courseCode: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
});
