import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  DeviceEventEmitter,
  Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'ProblemDetail'>;

export const ProblemDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { problemId } = route.params;
  const { user } = useAuth();
  
  const [problem, setProblem] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [myRating, setMyRating] = useState<{ rating: number, difficulty: number } | null>(null);
  const [avgRating, setAvgRating] = useState({ rating: 0, difficulty: 0, count: 0 });
  
  const [answersAvgRatings, setAnswersAvgRatings] = useState<Record<string, { rating: number, count: number }>>({});
  const [myAnswersRatings, setMyAnswersRatings] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);

  const fetchDetail = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);

      // 1. Obtener datos del problema
      const probRes = await pb.collection('problems').getOne(problemId, {
        expand: 'author'
      });
      setProblem(probRes);

      // 2. Obtener respuestas/pautas (problems con parent = problemId)
      const ansRes = await pb.collection('problems').getList(1, 100, {
        filter: `parent = "${problemId}"`,
        sort: '-created',
        expand: 'author'
      });
      setAnswers(ansRes.items);

      // 3. Obtener calificaciones (del problema y de las respuestas)
      const ratingsRes = await pb.collection('problem_ratings').getFullList({
        filter: `problem = "${problemId}" || problem.parent = "${problemId}"`
      });

      let sumRating = 0;
      let sumDifficulty = 0;
      let userRatingData = null;
      let problemRatingsCount = 0;

      const tempAnswersAvgRatings: Record<string, { sum: number, count: number }> = {};
      const tempMyAnswersRatings: Record<string, number> = {};

      ratingsRes.forEach(r => {
        if (r.problem === problemId) {
          sumRating += r.rating;
          sumDifficulty += r.difficulty;
          problemRatingsCount++;
          if (user && r.user === user.id) {
            userRatingData = { rating: r.rating, difficulty: r.difficulty };
          }
        } else {
          if (!tempAnswersAvgRatings[r.problem]) {
            tempAnswersAvgRatings[r.problem] = { sum: 0, count: 0 };
          }
          tempAnswersAvgRatings[r.problem].sum += r.rating;
          tempAnswersAvgRatings[r.problem].count++;

          if (user && r.user === user.id) {
            tempMyAnswersRatings[r.problem] = r.rating;
          }
        }
      });

      setMyRating(userRatingData);
      setAvgRating({
        rating: problemRatingsCount > 0 ? parseFloat((sumRating / problemRatingsCount).toFixed(1)) : 0,
        difficulty: problemRatingsCount > 0 ? parseFloat((sumDifficulty / problemRatingsCount).toFixed(1)) : 0,
        count: problemRatingsCount
      });

      const newAnswersAvgRatings: Record<string, { rating: number, count: number }> = {};
      for (const [ansId, data] of Object.entries(tempAnswersAvgRatings)) {
        newAnswersAvgRatings[ansId] = {
          rating: parseFloat((data.sum / data.count).toFixed(1)),
          count: data.count
        };
      }
      setAnswersAvgRatings(newAnswersAvgRatings);
      setMyAnswersRatings(tempMyAnswersRatings);

    } catch (err) {
      console.error('Error fetching problem details:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDetail();
    }, [problemId, user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDetail(true);
  };

  const handleRatingSubmit = async (selectedRating: number, selectedDifficulty: number) => {
    if (!user) {
      Toast.show({
        type: 'error',
        text1: 'Inicia sesión',
        text2: 'Debes iniciar sesión para calificar este problema.',
      });
      return;
    }

    // --- Optimistic UI Update ---
    const prevMyRating = myRating;
    const prevAvgRating = avgRating;

    setMyRating({ rating: selectedRating, difficulty: selectedDifficulty });
    if (prevMyRating) {
      setAvgRating({
        rating: ((prevAvgRating.rating * prevAvgRating.count) - prevMyRating.rating + selectedRating) / prevAvgRating.count,
        difficulty: ((prevAvgRating.difficulty * prevAvgRating.count) - prevMyRating.difficulty + selectedDifficulty) / prevAvgRating.count,
        count: prevAvgRating.count
      });
    } else {
      setAvgRating({
        rating: ((prevAvgRating.rating * prevAvgRating.count) + selectedRating) / (prevAvgRating.count + 1),
        difficulty: ((prevAvgRating.difficulty * prevAvgRating.count) + selectedDifficulty) / (prevAvgRating.count + 1),
        count: prevAvgRating.count + 1
      });
    }
    // ----------------------------

    try {
      // Comprobar si ya existe una calificación de este usuario
      const existing = await pb.collection('problem_ratings').getList(1, 1, {
        filter: `problem = "${problemId}" && user = "${user.id}"`
      });

      if (existing.items.length > 0) {
        // Actualizar
        await pb.collection('problem_ratings').update(existing.items[0].id, {
          rating: selectedRating,
          difficulty: selectedDifficulty
        });
      } else {
        // Crear
        await pb.collection('problem_ratings').create({
          problem: problemId,
          user: user.id,
          rating: selectedRating,
          difficulty: selectedDifficulty
        });
      }

      // No mostramos Toast de éxito para que sea completamente silencioso e instantáneo
      // Toast.show({ ... });

      // Actualizamos silenciosamente en background para sincronizar con la DB
      fetchDetail(true);
    } catch (err) {
      console.error('Error submitting rating:', err);
      // Rollback Optimistic Update
      setMyRating(prevMyRating);
      setAvgRating(prevAvgRating);

      Toast.show({
        type: 'error',
        text1: 'Error al calificar',
        text2: 'Ocurrió un error al procesar tu calificación.',
      });
    }
  };

  const handleAnswerRatingSubmit = async (ansId: string, selectedRating: number) => {
    if (!user) {
      Toast.show({
        type: 'error',
        text1: 'Inicia sesión',
        text2: 'Debes iniciar sesión para calificar esta pauta.',
      });
      return;
    }

    // --- Optimistic UI Update ---
    const prevMyRating = myAnswersRatings[ansId];
    const prevAvgRating = answersAvgRatings[ansId] || { rating: 0, count: 0 };

    setMyAnswersRatings(prev => ({ ...prev, [ansId]: selectedRating }));
    
    if (prevMyRating) {
      setAnswersAvgRatings(prev => ({
        ...prev,
        [ansId]: {
          rating: ((prevAvgRating.rating * prevAvgRating.count) - prevMyRating + selectedRating) / prevAvgRating.count,
          count: prevAvgRating.count
        }
      }));
    } else {
      setAnswersAvgRatings(prev => ({
        ...prev,
        [ansId]: {
          rating: ((prevAvgRating.rating * prevAvgRating.count) + selectedRating) / (prevAvgRating.count + 1),
          count: prevAvgRating.count + 1
        }
      }));
    }
    // ----------------------------

    try {
      // Comprobar si ya existe una calificación de este usuario
      const existing = await pb.collection('problem_ratings').getList(1, 1, {
        filter: `problem = "${ansId}" && user = "${user.id}"`
      });

      if (existing.items.length > 0) {
        // Actualizar
        await pb.collection('problem_ratings').update(existing.items[0].id, {
          rating: selectedRating,
          // Mantener difficulty si existe, o setear a 1. La BD lo requiere (0 es rechazado por ser requerido).
          difficulty: existing.items[0].difficulty || 1
        });
      } else {
        // Crear
        await pb.collection('problem_ratings').create({
          problem: ansId,
          user: user.id,
          rating: selectedRating,
          difficulty: 1 // Default for answers (cannot be 0 as required fields reject 0)
        });
      }

      // Actualizamos silenciosamente en background
      fetchDetail(true);
    } catch (err) {
      console.error('Error submitting answer rating:', err);
      // Rollback Optimistic Update
      setMyAnswersRatings(prev => {
        const newRatings = { ...prev };
        if (prevMyRating !== undefined) {
          newRatings[ansId] = prevMyRating;
        } else {
          delete newRatings[ansId];
        }
        return newRatings;
      });
      setAnswersAvgRatings(prev => ({ ...prev, [ansId]: prevAvgRating }));

      Toast.show({
        type: 'error',
        text1: 'Error al calificar',
        text2: 'Ocurrió un error al procesar tu calificación.',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr.replace(' ', 'T'));
    return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute:'2-digit' });
  };

  const renderStarsSelector = (
    currentValue: number, 
    color: string, 
    onSelect: (val: number) => void
  ) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity 
          key={i} 
          onPress={() => onSelect(i)}
          disabled={submittingRating}
        >
          <Feather 
            name="star" 
            size={22} 
            color={i <= currentValue ? color : theme.colors.textMuted} 
            style={{ marginRight: 6 }}
            fill={i <= currentValue ? color : 'transparent'}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const renderSmallStarsSelector = (
    currentValue: number, 
    color: string, 
    onSelect: (val: number) => void
  ) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity 
          key={i} 
          onPress={() => onSelect(i)}
          disabled={submittingRating}
          style={{ padding: 2 }}
        >
          <Feather 
            name="star" 
            size={18} 
            color={i <= currentValue ? color : theme.colors.border} 
            fill={i <= currentValue ? color : 'transparent'}
          />
        </TouchableOpacity>
      );
    }
    return <View style={{ flexDirection: 'row' }}>{stars}</View>;
  };

  const renderStars = (value: number, color: string) => {
    const stars = [];
    const roundedValue = Math.round(value);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Feather 
          key={i} 
          name="star" 
          size={14} 
          color={i <= roundedValue ? color : theme.colors.textMuted} 
          style={{ marginRight: 2 }}
          fill={i <= roundedValue ? color : 'transparent'}
        />
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

  if (!problem) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se pudo cargar el problema.</Text>
      </View>
    );
  }

  const problemAuthor = problem.expand?.author;

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Autor e Info */}
        <View style={styles.authorRow}>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => navigation.push('UserProfile', { userId: problem.author })}
          >
            <Avatar user={problemAuthor} size={44} />
          </TouchableOpacity>
          <View style={styles.authorMeta}>
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => navigation.push('UserProfile', { userId: problem.author })}
            >
              <Text style={styles.authorName}>{problemAuthor?.name || 'Usuario'}</Text>
              {problemAuthor?.username && <Text style={styles.authorHandle}>@{problemAuthor.username}</Text>}
            </TouchableOpacity>
            <Text style={styles.dateText}>{formatDate(problem.created)}</Text>
          </View>
        </View>

        {/* Título y Enunciado */}
        <Text style={styles.problemTitle}>{problem.title}</Text>
        
        {/* Etiquetas */}
        {problem.tags && problem.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {problem.tags.map((tag: string) => (
              <Text key={tag} style={styles.tagBadge}>#{tag}</Text>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {/* Renderizador de Typst */}
        <Text style={styles.sectionHeader}>Enunciado</Text>
        <View style={styles.rendererContainer}>
          <MarkdownRenderer content={problem.content} height={150} />
        </View>

        {/* Estadísticas Promedio de Calificación */}
        <View style={styles.avgStatsContainer}>
          <View style={styles.avgStatBox}>
            <Text style={styles.avgStatLabel}>Nota Promedio</Text>
            <View style={styles.starsWrapper}>
              {renderStars(avgRating.rating, '#F59E0B')}
            </View>
            <Text style={styles.avgStatValue}>{avgRating.rating} / 5.0</Text>
          </View>
          <View style={styles.avgStatBox}>
            <Text style={styles.avgStatLabel}>Dificultad Promedio</Text>
            <View style={styles.starsWrapper}>
              {renderStars(avgRating.difficulty, '#EF4444')}
            </View>
            <Text style={styles.avgStatValue}>{avgRating.difficulty} / 5.0</Text>
          </View>
          <Text style={styles.ratingsCountTotal}>Basado en {avgRating.count} calificaciones</Text>
        </View>

        {/* Calificar Problema */}
        {user && user.type !== 'organization' && (
          <View style={styles.ratingForm}>
            <Text style={styles.ratingFormTitle}>Califica este problema</Text>
            
            <View style={styles.selectorRow}>
              <Text style={styles.selectorLabel}>Tu Calificación:</Text>
              <View style={styles.starsSelectorWrapper}>
                {renderStarsSelector(
                  myRating?.rating || 0, 
                  '#F59E0B', 
                  (val) => handleRatingSubmit(val, myRating?.difficulty || 3)
                )}
              </View>
            </View>

            <View style={styles.selectorRow}>
              <Text style={styles.selectorLabel}>Dificultad:</Text>
              <View style={styles.starsSelectorWrapper}>
                {renderStarsSelector(
                  myRating?.difficulty || 0, 
                  '#EF4444', 
                  (val) => handleRatingSubmit(myRating?.rating || 4, val)
                )}
              </View>
            </View>
          </View>
        )}

        <View style={styles.divider} />

        {/* Respuestas / Pautas */}
        <View style={styles.answersHeaderRow}>
          <Text style={styles.sectionTitle}>Pautas y Resoluciones</Text>
          {user && user.type !== 'organization' && (
            <TouchableOpacity 
              style={styles.addAnswerBtn}
              onPress={() => navigation.push('ProblemEditor', { 
                type: 'answer', 
                problemId: problemId,
                problemTitle: problem.title 
              })}
            >
              <Feather name="plus" size={16} color="#000000" style={{ marginRight: 4 }} />
              <Text style={styles.addAnswerBtnText}>Subir Pauta</Text>
            </TouchableOpacity>
          )}
        </View>

        {answers.length === 0 ? (
          <View style={styles.emptyAnswers}>
            <Feather name="message-square" size={32} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyAnswersText}>Aún no hay pautas subidas para este problema.</Text>
            {user && user.type !== 'organization' && (
              <Text style={styles.emptyAnswersSub}>¿Resolviste el problema? ¡Comparte tu solución en Typst!</Text>
            )}
          </View>
        ) : (
          answers.map(ans => {
            const ansAuthor = ans.expand?.author;
            return (
              <View key={ans.id} style={styles.answerCard}>
                <View style={styles.answerHeader}>
                  <Avatar user={ansAuthor} size={30} />
                  <View style={styles.answerMeta}>
                    <Text style={styles.answerAuthorName}>{ansAuthor?.name || 'Usuario'}</Text>
                    {ansAuthor?.username && <Text style={styles.answerAuthorHandle}>@{ansAuthor.username}</Text>}
                  </View>
                  <Text style={styles.answerDate}>{formatDate(ans.created)}</Text>
                </View>
                {ans.title ? (
                  <Text style={styles.answerTitle}>{ans.title}</Text>
                ) : null}
                <View style={styles.answerRenderer}>
                  <MarkdownRenderer content={ans.content} height={100} />
                </View>

                {/* Rating UI for Answer */}
                <View style={styles.answerRatingContainer}>
                  <View style={styles.answerRatingRow}>
                    <Text style={styles.answerRatingLabel}>Nota solución:</Text>
                    {renderSmallStarsSelector(
                      myAnswersRatings[ans.id] || 0,
                      theme.colors.primary,
                      (val) => handleAnswerRatingSubmit(ans.id, val)
                    )}
                    <Text style={styles.answerRatingAvg}>
                      {answersAvgRatings[ans.id]?.rating > 0 
                        ? `${answersAvgRatings[ans.id].rating} (${answersAvgRatings[ans.id].count})` 
                        : 'Sin notas'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
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
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  authorMeta: {
    marginLeft: theme.spacing.sm,
  },
  authorName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  authorHandle: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  dateText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  problemTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: theme.spacing.xs,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  tagBadge: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  sectionHeader: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  rendererContainer: {
    marginBottom: theme.spacing.lg,
  },
  avgStatsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: theme.colors.cardBg,
    borderRadius: 16,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
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
  ratingsCountTotal: {
    width: '100%',
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: theme.spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.xs,
  },
  ratingForm: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
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
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  selectorLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  starsSelectorWrapper: {
    flexDirection: 'row',
  },
  answersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  addAnswerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addAnswerBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyAnswers: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  answerCard: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  answerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  answerMeta: {
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  answerAuthorName: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  answerAuthorHandle: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  answerDate: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  answerTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  answerRenderer: {
    marginTop: 4,
  },
  answerRatingContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  answerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  answerRatingLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginRight: 8,
  },
  answerRatingAvg: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginLeft: 8,
  },
});
