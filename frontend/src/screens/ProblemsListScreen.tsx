import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  RefreshControl,
  DeviceEventEmitter
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'ProblemsList'>;

export const ProblemsListScreen: React.FC<Props> = ({ navigation }) => {
  const [problems, setProblems] = useState<any[]>([]);
  const [ratingsMap, setRatingsMap] = useState<Record<string, { rating: number, difficulty: number, count: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Algunos tags sugeridos por defecto
  const suggestedTags = ['cálculo', 'álgebra', 'física', 'computación', 'química', 'otros'];

  const fetchProblems = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);

      // 1. Obtener problemas
      let filterConditions: string[] = ['parent = ""'];
      if (activeSearch) {
        const safeSearch = activeSearch.replace(/"/g, '\\"');
        filterConditions.push(`title ~ "${safeSearch}"`);
      }
      if (activeTag) {
        const safeTag = activeTag.replace(/"/g, '\\"');
        filterConditions.push(`tags ~ "${safeTag}"`);
      }

      const res = await pb.collection('problems').getList(1, 100, {
        sort: '-created',
        expand: 'author',
        filter: filterConditions.length > 0 ? filterConditions.join(' && ') : '',
      });

      // 2. Obtener todas las calificaciones de estos problemas para calcular los promedios
      const problemIds = res.items.map(p => p.id);
      let calculatedRatings: Record<string, { rating: number, difficulty: number, count: number }> = {};
      
      if (problemIds.length > 0) {
        const filterStr = problemIds.map(id => `problem = "${id}"`).join(' || ');
        const ratingsRes = await pb.collection('problem_ratings').getFullList({
          filter: `(${filterStr})`
        });

        ratingsRes.forEach(r => {
          if (!calculatedRatings[r.problem]) {
            calculatedRatings[r.problem] = { rating: 0, difficulty: 0, count: 0 };
          }
          calculatedRatings[r.problem].rating += r.rating;
          calculatedRatings[r.problem].difficulty += r.difficulty;
          calculatedRatings[r.problem].count += 1;
        });

        // Promediar
        Object.keys(calculatedRatings).forEach(key => {
          const item = calculatedRatings[key];
          item.rating = parseFloat((item.rating / item.count).toFixed(1));
          item.difficulty = parseFloat((item.difficulty / item.count).toFixed(1));
        });
      }

      setRatingsMap(calculatedRatings);
      setProblems(res.items);
    } catch (err) {
      console.error('Error fetching problems:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProblems();
    }, [activeSearch, activeTag])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', () => {
      onRefresh();
    });
    return () => sub.remove();
  }, [activeSearch, activeTag]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProblems(true);
  };

  const handleSearch = () => {
    setActiveSearch(searchQuery.trim());
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
  };

  const toggleTag = (tag: string) => {
    if (activeTag === tag) {
      setActiveTag(null);
    } else {
      setActiveTag(tag);
    }
  };

  const renderStars = (value: number, color: string) => {
    const stars = [];
    const roundedValue = Math.round(value);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Feather 
          key={i} 
          name="star" 
          size={12} 
          color={i <= roundedValue ? color : theme.colors.textMuted} 
          style={{ marginRight: 2 }}
          fill={i <= roundedValue ? color : 'transparent'}
        />
      );
    }
    return stars;
  };

  return (
    <View style={styles.container}>
      {/* Buscador y Tags */}
      <View style={styles.headerFilters}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar problemas..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={{ marginRight: 8 }}>
              <Feather name="x" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Categorías (Tags sugeridos) */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.tagsContainer}
          contentContainerStyle={styles.tagsContent}
        >
          {suggestedTags.map(tag => (
            <TouchableOpacity 
              key={tag} 
              style={[
                styles.tagChip, 
                activeTag === tag && styles.tagChipActive
              ]}
              onPress={() => toggleTag(tag)}
            >
              <Text 
                style={[
                  styles.tagText, 
                  activeTag === tag && styles.tagTextActive
                ]}
              >
                #{tag}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

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
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : problems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="book-open" size={48} color={theme.colors.textMuted} style={{ marginBottom: theme.spacing.md }} />
            <Text style={styles.emptyText}>No se encontraron problemas.</Text>
            <Text style={styles.emptySubtitle}>Sé el primero en subir un problema académico para la comunidad.</Text>
          </View>
        ) : (
          problems.map(prob => {
            const author = prob.expand?.author;
            const ratingData = ratingsMap[prob.id] || { rating: 0, difficulty: 0, count: 0 };
            
            return (
              <TouchableOpacity 
                key={prob.id} 
                style={styles.problemCard}
                activeOpacity={0.7}
                onPress={() => navigation.push('ProblemDetail', { problemId: prob.id })}
              >
                <View style={styles.cardHeader}>
                  <Avatar user={author} size={30} />
                  <View style={styles.authorMeta}>
                    <Text style={styles.authorName} numberOfLines={1}>{author?.name || 'Usuario'}</Text>
                    {author?.username && <Text style={styles.authorHandle}>@{author.username}</Text>}
                  </View>
                </View>

                <Text style={styles.problemTitle}>{prob.title}</Text>

                {/* Calificaciones */}
                <View style={styles.ratingsRow}>
                  <View style={styles.ratingCol}>
                    <Text style={styles.ratingLabel}>Calificación: </Text>
                    <View style={styles.starsWrapper}>
                      {renderStars(ratingData.rating, '#F59E0B')}
                      {ratingData.count > 0 && (
                        <Text style={styles.ratingCount}>({ratingData.rating})</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.ratingCol}>
                    <Text style={styles.ratingLabel}>Dificultad: </Text>
                    <View style={styles.starsWrapper}>
                      {renderStars(ratingData.difficulty, '#EF4444')}
                      {ratingData.count > 0 && (
                        <Text style={styles.ratingCount}>({ratingData.difficulty})</Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Etiquetas */}
                {prob.tags && prob.tags.length > 0 && (
                  <View style={styles.cardTags}>
                    {prob.tags.map((tag: string) => (
                      <Text key={tag} style={styles.cardTagText}>#{tag}</Text>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* FAB para agregar nuevo problema */}
      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8}
        onPress={() => navigation.push('ProblemEditor', { type: 'problem' })}
      >
        <Feather name="plus" size={24} color="#000000" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerFilters: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  tagsContainer: {
    marginBottom: theme.spacing.sm,
  },
  tagsContent: {
    paddingRight: theme.spacing.lg,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tagChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: theme.colors.primary,
  },
  tagText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tagTextActive: {
    color: theme.colors.primary,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: 80,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: theme.spacing.sm,
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: theme.spacing.xl,
  },
  problemCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  authorMeta: {
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  authorName: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  authorHandle: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  problemTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginVertical: theme.spacing.xs,
  },
  ratingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  ratingCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  starsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingCount: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginLeft: 4,
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  cardTagText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: theme.colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
});
