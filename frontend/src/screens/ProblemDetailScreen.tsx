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
  Alert,
  Image,
  Platform,
  TextInput
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { withMinimumDelay } from '../utils/refresh';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { PostCard } from '../components/PostCard';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'ProblemDetail'>;

const renderContentBlocks = (contentStr: string) => {
  if (!contentStr) return null;
  
  let blocks: { type: 'markdown' | 'image', value: string }[] = [];
  try {
    if (contentStr.trim().startsWith('[')) {
      blocks = JSON.parse(contentStr);
    }
  } catch (e) {}

  if (blocks.length === 0) {
    return <MarkdownRenderer content={contentStr} height={150} />;
  }

  const compiledMarkdown = blocks.map(b => {
    if (b.type === 'markdown') {
      return b.value;
    } else {
      return b.value ? `\n![imagen](${b.value})\n` : '';
    }
  }).join('\n\n');

  return <MarkdownRenderer content={compiledMarkdown} height={150} />;
};

export const ProblemDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { problemId } = route.params;
  const { user } = useAuth();
  
  const [problem, setProblem] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [myRating, setMyRating] = useState<{ rating: number, difficulty: number } | null>(null);
  const [avgRating, setAvgRating] = useState({ rating: 0, ratingCount: 0, difficulty: 0, difficultyCount: 0 });
  
  const [answersAvgRatings, setAnswersAvgRatings] = useState<Record<string, { rating: number, ratingCount: number, difficulty: number, difficultyCount: number }>>({});
  const [myAnswersRatings, setMyAnswersRatings] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showParentProblem, setShowParentProblem] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [quoteModalVisible, setQuoteModalVisible] = useState(false);

  const [comments, setComments] = useState<any[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchDetail = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);

      // 1. Obtener datos del problema
      const probRes = await pb.collection('problems').getOne(problemId, {
        expand: 'author,parent'
      });
      setProblem(probRes);

      // 2. Obtener respuestas/pautas (problems con parent = problemId)
      const ansRes = await pb.collection('problems').getList(1, 100, {
        filter: `parent = "${problemId}"`,
        sort: '-created',
        expand: 'author'
      });
      setAnswers(ansRes.items);

      // 2.5. Obtener comentarios polimórficos dirigidos a este problema o pauta
      try {
        const commentsRes = await pb.collection('posts').getList(1, 50, {
          filter: `targetType = "problem" && targetId = "${problemId}" && actionType = "comment" && deleted = false`,
          sort: '+created',
          expand: 'author'
        });
        setComments(commentsRes.items);
      } catch (err) {
        console.error('Error fetching problem comments:', err);
      }

      // 3. Obtener calificaciones (del problema y de las respuestas)
      const ratingsRes = await pb.collection('problem_ratings').getFullList({
        filter: `problem = "${problemId}" || problem.parent = "${problemId}"`
      });

      let sumRating = 0;
      let ratingCount = 0;
      let sumDifficulty = 0;
      let difficultyCount = 0;
      let userRatingData = null;

      const tempAnswersAvgRatings: Record<string, { sumRating: number, ratingCount: number, sumDifficulty: number, difficultyCount: number }> = {};
      const tempMyAnswersRatings: Record<string, number> = {};

      ratingsRes.forEach(r => {
        if (r.problem === problemId) {
          if (r.rating > 0) {
            sumRating += r.rating;
            ratingCount++;
          }
          if (r.difficulty > 0) {
            sumDifficulty += r.difficulty;
            difficultyCount++;
          }
          if (user && r.user === user.id) {
            userRatingData = { rating: r.rating, difficulty: r.difficulty };
          }
        } else {
          if (!tempAnswersAvgRatings[r.problem]) {
            tempAnswersAvgRatings[r.problem] = { 
              sumRating: 0, ratingCount: 0,
              sumDifficulty: 0, difficultyCount: 0
            };
          }
          if (r.rating > 0) {
            tempAnswersAvgRatings[r.problem].sumRating += r.rating;
            tempAnswersAvgRatings[r.problem].ratingCount++;
          }
          if (r.difficulty > 0) {
            tempAnswersAvgRatings[r.problem].sumDifficulty += r.difficulty;
            tempAnswersAvgRatings[r.problem].difficultyCount++;
          }

          if (user && r.user === user.id) {
            tempMyAnswersRatings[r.problem] = r.rating;
          }
        }
      });

      setMyRating(userRatingData);
      setAvgRating({
        rating: ratingCount > 0 ? parseFloat((sumRating / ratingCount).toFixed(1)) : 0,
        ratingCount: ratingCount,
        difficulty: difficultyCount > 0 ? parseFloat((sumDifficulty / difficultyCount).toFixed(1)) : 0,
        difficultyCount: difficultyCount
      });

      const newAnswersAvgRatings: Record<string, { rating: number, ratingCount: number, difficulty: number, difficultyCount: number }> = {};
      for (const [ansId, data] of Object.entries(tempAnswersAvgRatings)) {
        newAnswersAvgRatings[ansId] = {
          rating: data.ratingCount > 0 ? parseFloat((data.sumRating / data.ratingCount).toFixed(1)) : 0,
          ratingCount: data.ratingCount,
          difficulty: data.difficultyCount > 0 ? parseFloat((data.sumDifficulty / data.difficultyCount).toFixed(1)) : 0,
          difficultyCount: data.difficultyCount
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

  const handleSendComment = async () => {
    if (!commentContent.trim() || !user || !problem) return;
    setSubmittingComment(true);
    try {
      const postData: any = {
        content: commentContent.trim(),
        author: user.id,
        actionType: 'comment',
        targetType: 'problem',
        targetId: problem.id,
        targetMeta: {
          title: problem.title || (problem.parent ? 'Pauta' : 'Problema'),
          ramo: problem.ramo || problem.expand?.parent?.ramo || '',
          instancia: problem.instancia || problem.expand?.parent?.instancia || '',
        }
      };

      const created = await pb.collection('posts').create(postData, { expand: 'author' });
      setComments(prev => [...prev, created]);
      setCommentContent('');
      Toast.show({ type: 'success', text1: 'Comentario publicado' });
    } catch (err) {
      console.error('Error enviando comentario:', err);
      Toast.show({ type: 'error', text1: 'Error al enviar comentario' });
    } finally {
      setSubmittingComment(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDetail();
    }, [problemId, user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchDetail(true));
  };

  const performDeleteAction = async (isSolution: boolean) => {
    try {
      await pb.collection('problems').update(problemId, { deleted: true });
      Toast.show({
        type: 'success',
        text1: 'Eliminado',
        text2: isSolution ? 'La pauta ha sido eliminada.' : 'El problema ha sido eliminado.',
      });
      navigation.goBack();
    } catch (err) {
      console.error('Error deleting problem:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No se pudo completar la eliminación.',
      });
    }
  };

  const handleDeleteProblem = () => {
    setShowDeleteConfirm(true);
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

    let nextRating = prevAvgRating.rating;
    let nextRatingCount = prevAvgRating.ratingCount;
    
    // Rating adjustment
    const prevRatingVal = prevMyRating?.rating || 0;
    if (selectedRating !== prevRatingVal) {
      if (prevRatingVal > 0 && selectedRating > 0) {
        nextRating = ((prevAvgRating.rating * prevAvgRating.ratingCount) - prevRatingVal + selectedRating) / prevAvgRating.ratingCount;
      } else if (prevRatingVal > 0 && selectedRating === 0) {
        nextRatingCount = prevAvgRating.ratingCount - 1;
        nextRating = nextRatingCount > 0 
          ? ((prevAvgRating.rating * prevAvgRating.ratingCount) - prevRatingVal) / nextRatingCount
          : 0;
      } else if (prevRatingVal === 0 && selectedRating > 0) {
        nextRatingCount = prevAvgRating.ratingCount + 1;
        nextRating = ((prevAvgRating.rating * prevAvgRating.ratingCount) + selectedRating) / nextRatingCount;
      }
    }

    let nextDiff = prevAvgRating.difficulty;
    let nextDiffCount = prevAvgRating.difficultyCount;

    // Difficulty adjustment
    const prevDiffVal = prevMyRating?.difficulty || 0;
    if (selectedDifficulty !== prevDiffVal) {
      if (prevDiffVal > 0 && selectedDifficulty > 0) {
        nextDiff = ((prevAvgRating.difficulty * prevAvgRating.difficultyCount) - prevDiffVal + selectedDifficulty) / prevAvgRating.difficultyCount;
      } else if (prevDiffVal > 0 && selectedDifficulty === 0) {
        nextDiffCount = prevAvgRating.difficultyCount - 1;
        nextDiff = nextDiffCount > 0
          ? ((prevAvgRating.difficulty * prevAvgRating.difficultyCount) - prevDiffVal) / nextDiffCount
          : 0;
      } else if (prevDiffVal === 0 && selectedDifficulty > 0) {
        nextDiffCount = prevAvgRating.difficultyCount + 1;
        nextDiff = ((prevAvgRating.difficulty * prevAvgRating.difficultyCount) + selectedDifficulty) / nextDiffCount;
      }
    }

    setAvgRating({
      rating: parseFloat(nextRating.toFixed(1)),
      ratingCount: nextRatingCount,
      difficulty: parseFloat(nextDiff.toFixed(1)),
      difficultyCount: nextDiffCount
    });
    // ----------------------------

    try {
      // Comprobar si ya existe una calificación de este usuario
      const existing = await pb.collection('problem_ratings').getList(1, 1, {
        filter: `problem = "${problemId}" && user = "${user.id}"`
      });

      if (selectedRating === 0 && selectedDifficulty === 0) {
        if (existing.items.length > 0) {
          await pb.collection('problem_ratings').delete(existing.items[0].id);
        }
      } else {
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
          <FontAwesome 
            name="star" 
            size={22} 
            color={i <= currentValue ? color : '#262626'} 
            style={{ marginRight: 6 }}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };
  const handleShareProblemToFeed = () => {
    if (!user || !problem) {
      Toast.show({ type: 'info', text1: 'Autenticación requerida', text2: 'Inicia sesión para citar.' });
      return;
    }
    navigation.navigate('Home', {
      quoteTargetType: 'problem',
      quoteTargetId: problem.id,
      quoteTargetMeta: {
        title: problem.title,
        subtitle: problem.parent ? 'Pauta' : 'Enunciado',
        ramo: problem.ramo,
        instancia: problem.instancia,
      }
    });
  };



  const renderStars = (value: number, color: string) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (value >= i) {
        stars.push(
          <FontAwesome
            key={i}
            name="star"
            size={14}
            color={color}
            style={{ marginRight: 2 }}
          />
        );
      } else if (value >= i - 0.75) {
        stars.push(
          <FontAwesome
            key={i}
            name="star-half-o"
            size={14}
            color={color}
            style={{ marginRight: 2 }}
          />
        );
      } else {
        stars.push(
          <FontAwesome
            key={i}
            name="star"
            size={14}
            color="#262626"
            style={{ marginRight: 2 }}
          />
        );
      }
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

  const problemAuthor = problem.deleted ? null : problem.expand?.author;

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


        {!!problem.parent && (
          <View style={styles.parentProblemContainer}>
            <TouchableOpacity
              style={styles.parentProblemHeader}
              onPress={() => setShowParentProblem(!showParentProblem)}
              activeOpacity={0.8}
            >
              <Text style={styles.parentProblemHeaderText}>
                {showParentProblem ? 'Ocultar enunciado' : 'Mostrar enunciado'}
              </Text>
              <Feather 
                name={showParentProblem ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={theme.colors.primary} 
              />
            </TouchableOpacity>
            
            {showParentProblem && (
              <View style={styles.parentProblemContent}>
                {problem.expand?.parent?.tags && problem.expand.parent.tags.length > 0 && (
                  <View style={styles.parentProblemTagsRow}>
                    {problem.expand.parent.tags.map((tag: string) => (
                      <Text key={tag} style={styles.parentProblemTagBadge}>#{tag}</Text>
                    ))}
                  </View>
                )}
                {problem.expand?.parent?.content && (
                  <View style={styles.rendererContainer}>
                    {renderContentBlocks(problem.expand.parent.content)}
                  </View>
                )}
                
                <TouchableOpacity
                  style={[styles.parentBanner, { marginTop: theme.spacing.md, marginBottom: 0 }]}
                  onPress={() => navigation.push('ProblemDetail', { problemId: problem.parent, type: 'problem' })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.parentBannerText}>
                    Ver problema original
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Autor e Info */}
        <View style={[styles.authorRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={(problem.author && !problem.deleted) ? () => navigation.push('UserProfile', { userId: problem.author }) : undefined}
              disabled={!problem.author || problem.deleted}
            >
              <Avatar user={problemAuthor} size={44} />
            </TouchableOpacity>
            <View style={styles.authorMeta}>
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={(problem.author && !problem.deleted) ? () => navigation.push('UserProfile', { userId: problem.author }) : undefined}
                disabled={!problem.author || problem.deleted}
              >
                <Text style={styles.authorName}>{problemAuthor?.name || (problem.deleted ? 'Usuario Anónimo' : 'Usuario')}</Text>
                {!!problemAuthor?.username && <Text style={styles.authorHandle}>@{problemAuthor.username}</Text>}
              </TouchableOpacity>
              <Text style={styles.dateText}>{formatDate(problem.created)}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!problem.deleted && (
              <TouchableOpacity
                style={styles.shareProblemBtn}
                activeOpacity={0.7}
                onPress={handleShareProblemToFeed}
              >
                <Feather name="repeat" size={14} color={theme.colors.text} style={{ marginRight: 4 }} />
                <Text style={styles.shareProblemBtnText}>Compartir</Text>
              </TouchableOpacity>
            )}

            {user && problem.author === user.id && !problem.deleted && (
              <TouchableOpacity 
                style={{ padding: 8 }} 
                onPress={handleDeleteProblem}
              >
                <Feather name="trash-2" size={20} color={theme.colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Academic Metadata Badges */}
        {!!(problem.ramo || problem.semestre || problem.instancia) && (
          <View style={styles.academicBadgesRow}>
            {!!problem.ramo && (
              <View style={[styles.academicBadge, { backgroundColor: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.3)' }]}>
                <Text style={[styles.academicBadgeText, { color: '#38BDF8' }]}>{problem.ramo}</Text>
              </View>
            )}
            {!!problem.semestre && (
              <View style={[styles.academicBadge, { backgroundColor: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.3)' }]}>
                <Text style={[styles.academicBadgeText, { color: '#34D399' }]}>{problem.semestre}</Text>
              </View>
            )}
            {!!problem.instancia && (
              <View style={[styles.academicBadge, { backgroundColor: 'rgba(248, 113, 113, 0.1)', borderColor: 'rgba(248, 113, 113, 0.3)' }]}>
                <Text style={[styles.academicBadgeText, { color: '#F87171' }]}>{problem.instancia}</Text>
              </View>
            )}
          </View>
        )}

        {/* Título y Enunciado */}
        <Text style={[styles.problemTitle, problem.deleted && { color: theme.colors.textMuted, fontStyle: 'italic' }]}>
          {problem.deleted 
            ? (problem.parent ? 'Pauta eliminada' : 'Problema eliminado') 
            : problem.title}
        </Text>
        
        {/* Etiquetas */}
        {!problem.deleted && problem.tags && problem.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {problem.tags.map((tag: string) => (
              <Text key={tag} style={styles.tagBadge}>#{tag}</Text>
            ))}
          </View>
        )}

        {!problem.deleted && (
          <View style={styles.rendererContainer}>
            {renderContentBlocks(problem.content)}
          </View>
        )}

        {!problem.deleted && (
          <>
            <View style={styles.divider} />

            {/* Estadísticas Promedio de Calificación */}
            <View style={styles.avgStatsContainer}>
              <View style={styles.avgStatBox}>
                <Text style={styles.avgStatLabel}>{problem.parent ? 'Solución' : 'Enunciado'}</Text>
                <View style={styles.starsWrapper}>
                  {renderStars(avgRating.rating, '#F59E0B')}
                </View>
                <Text style={styles.avgStatValue}>{avgRating.rating} / 5 ({avgRating.ratingCount})</Text>
              </View>
              <View style={styles.avgStatBox}>
                <Text style={styles.avgStatLabel}>{problem.parent ? 'Explicación' : 'Dificultad'}</Text>
                <View style={styles.starsWrapper}>
                  {renderStars(avgRating.difficulty, '#EF4444')}
                </View>
                <Text style={styles.avgStatValue}>{avgRating.difficulty} / 5 ({avgRating.difficultyCount})</Text>
              </View>
            </View>
          </>
        )}

        {/* Calificar Problema / Solución */}
        {user && user.type !== 'organization' && !problem.deleted && (
          <>
            <View style={styles.divider} />
            <View style={styles.ratingForm}>
            <Text style={styles.ratingFormTitle}>
              {problem.parent ? 'Califica esta solución' : 'Califica este problema'}
            </Text>
            
            <View style={styles.selectorRow}>
              <Text style={styles.selectorLabel}>
                {problem.parent ? 'Solución' : 'Enunciado'}
              </Text>
              <Text style={styles.selectorSeparator}>|</Text>
              <View style={[styles.starsSelectorWrapper, { alignItems: 'center' }]}>
                {renderStarsSelector(
                  myRating?.rating || 0, 
                  '#F59E0B', 
                  (val) => handleRatingSubmit(val, myRating?.difficulty || 0)
                )}
                {!!myRating?.rating && myRating.rating > 0 && (
                  <TouchableOpacity
                    onPress={() => handleRatingSubmit(0, myRating?.difficulty || 0)}
                    style={styles.clearRatingBtn}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.selectorRow}>
              <Text style={styles.selectorLabel}>
                {problem.parent ? 'Explicación' : 'Dificultad'}
              </Text>
              <Text style={styles.selectorSeparator}>|</Text>
              <View style={[styles.starsSelectorWrapper, { alignItems: 'center' }]}>
                {renderStarsSelector(
                  myRating?.difficulty || 0, 
                  '#EF4444', 
                  (val) => handleRatingSubmit(myRating?.rating || 0, val)
                )}
                {!!myRating?.difficulty && myRating.difficulty > 0 && (
                  <TouchableOpacity
                    onPress={() => handleRatingSubmit(myRating?.rating || 0, 0)}
                    style={styles.clearRatingBtn}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          </>
        )}

        {!problem.parent && (
          <>
            <View style={styles.divider} />

            {/* Respuestas / Pautas */}
            <View style={styles.answersHeaderRow}>
              <Text style={styles.sectionTitle}>Pautas</Text>
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
                  <Text style={styles.emptyAnswersSub}>¿Resolviste el problema? ¡Comparte tu solución!</Text>
                )}
              </View>
            ) : (
              answers.map(ans => {
                const ansAuthor = ans.expand?.author;
                return (
                  <TouchableOpacity 
                    key={ans.id} 
                    style={styles.answerCard}
                    activeOpacity={0.8}
                    onPress={() => navigation.push('ProblemDetail', { problemId: ans.id, type: 'solution' })}
                  >
                    <View style={styles.answerHeader}>
                      <Avatar user={ansAuthor} size={30} />
                      <View style={styles.answerMeta}>
                        <Text style={styles.answerAuthorName}>{ansAuthor?.name || 'Usuario'}</Text>
                        {!!ansAuthor?.username && <Text style={styles.answerAuthorHandle}>@{ansAuthor.username}</Text>}
                      </View>
                      <Text style={styles.answerDate}>{formatDate(ans.created)}</Text>
                    </View>
                    {ans.title ? (
                      <Text style={styles.answerTitle}>{ans.title}</Text>
                    ) : null}

                    {/* Rating UI for Answer */}
                    <View style={styles.answerRatingContainer}>
                      <View style={styles.answerRatingRow}>
                        <Text style={[styles.answerRatingLabel, { width: 75 }]}>Solución:</Text>
                        <View style={{ flexDirection: 'row', marginRight: 4 }}>
                          {renderStars(answersAvgRatings[ans.id]?.rating || 0, '#F59E0B')}
                        </View>
                        <Text style={styles.answerRatingAvg}>
                          {answersAvgRatings[ans.id]?.rating > 0 
                            ? `${answersAvgRatings[ans.id].rating} (${answersAvgRatings[ans.id].ratingCount})` 
                            : 'Sin notas'}
                        </Text>
                      </View>
                      <View style={[styles.answerRatingRow, { marginTop: 4 }]}>
                        <Text style={[styles.answerRatingLabel, { width: 75 }]}>Explicación:</Text>
                        <View style={{ flexDirection: 'row', marginRight: 4 }}>
                          {renderStars(answersAvgRatings[ans.id]?.difficulty || 0, '#EF4444')}
                        </View>
                        <Text style={styles.answerRatingAvg}>
                          {answersAvgRatings[ans.id]?.difficulty > 0 
                            ? `${answersAvgRatings[ans.id].difficulty} (${answersAvgRatings[ans.id].difficultyCount})` 
                            : 'Sin notas'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* Sección de Comentarios Polimórficos */}
        <View style={styles.divider} />
        <View style={styles.answersHeaderRow}>
          <Text style={styles.sectionTitle}>Comentarios</Text>
        </View>

        {comments.length === 0 ? (
          <View style={styles.emptyAnswers}>
            <Feather name="message-square" size={28} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyAnswersText}>Aún no hay comentarios.</Text>
            <Text style={styles.emptyAnswersSub}>Sé el primero en comentar este {problem?.parent ? 'pauta' : 'problema'}.</Text>
          </View>
        ) : (
          comments.map(c => (
            <View key={c.id} style={{ marginHorizontal: -theme.spacing.lg }}>
              <PostCard
                post={c}
                currentUser={user}
                onPress={() => navigation.push('PostDetail', { postId: c.id })}
                onAuthorPress={() => navigation.push('UserProfile', { userId: c.author })}
              />
            </View>
          ))
        )}

      </ScrollView>

      {/* Caja de Comentarios (Reply Box) */}
      {user && !problem?.deleted && (
        <View style={styles.commentBox}>
          <TextInput
            style={styles.commentInput}
            placeholder="Escribe un comentario..."
            placeholderTextColor={theme.colors.textMuted}
            value={commentContent}
            onChangeText={setCommentContent}
            multiline
          />
          <TouchableOpacity
            style={[styles.commentBtn, (!commentContent.trim() || submittingComment) && styles.commentBtnDisabled]}
            onPress={handleSendComment}
            disabled={!commentContent.trim() || submittingComment}
          >
            <Text style={styles.commentBtnText}>Publicar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de confirmación de eliminación customizado */}
      {showDeleteConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Feather name="alert-triangle" size={24} color={theme.colors.error} style={{ marginRight: 10 }} />
              <Text style={styles.modalTitle}>
                {!!problem.parent ? '¿Eliminar pauta?' : '¿Eliminar problema?'}
              </Text>
            </View>
            <Text style={styles.modalBody}>
              {!!problem.parent 
                ? '¿Estás seguro de que deseas eliminar esta pauta?' 
                : '¿Estás seguro de que deseas eliminar este problema? También se ocultarán todas sus pautas y comentarios asociados.'}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnCancel]} 
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnDelete]} 
                onPress={() => {
                  performDeleteAction(!!problem.parent);
                  setShowDeleteConfirm(false);
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
  shareProblemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  shareProblemBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
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
    marginTop: theme.spacing.md,
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingSeparator: {
    color: theme.colors.textMuted,
    marginHorizontal: 8,
    fontSize: 12,
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
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
    marginTop: theme.spacing.xs,
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
  parentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: theme.spacing.md,
    backgroundColor: 'transparent',
  },
  parentBannerText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  parentProblemContainer: {
    backgroundColor: '#111111',
    marginHorizontal: -theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  parentProblemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  parentProblemHeaderText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  parentProblemContent: {
    marginTop: theme.spacing.md,
  },
  parentProblemContentTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: theme.spacing.xs,
  },
  parentProblemTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  parentProblemTagBadge: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  academicBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  academicBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  academicBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  detailImageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  detailImage: {
    width: '100%',
    height: 280,
    borderRadius: 8,
    backgroundColor: '#050505',
  },
  clearRatingBtn: {
    padding: 4,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    padding: 14,
    marginTop: theme.spacing.sm,
  },
  commentsBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  deletedBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: theme.spacing.md,
  },
  commentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  commentInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    maxHeight: 90,
    minHeight: 40,
    paddingRight: theme.spacing.md,
    textAlignVertical: 'top',
  },
  commentBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentBtnDisabled: {
    opacity: 0.5,
  },
  commentBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
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
});
