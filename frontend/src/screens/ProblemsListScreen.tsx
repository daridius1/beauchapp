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
import { Feather, FontAwesome } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { SelectorModal } from '../components/SelectorModal';

type Props = NativeStackScreenProps<RootStackParamList, 'ProblemsList'>;

export const ProblemsListScreen: React.FC<Props> = ({ navigation }) => {
  const [problems, setProblems] = useState<any[]>([]);
  const [ratingsMap, setRatingsMap] = useState<Record<string, { rating: number, difficulty: number, count: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const [ramoQuery, setRamoQuery] = useState('');
  const [activeRamo, setActiveRamo] = useState('');
  const [semestreQuery, setSemestreQuery] = useState('');
  const [activeSemestre, setActiveSemestre] = useState('');
  const [instanciaQuery, setInstanciaQuery] = useState('');
  const [activeInstancia, setActiveInstancia] = useState('');

  const [ramoSuggestions, setRamoSuggestions] = useState<string[]>([]);
  const [semestreSuggestions, setSemestreSuggestions] = useState<string[]>([]);
  const [instanciaSuggestions, setInstanciaSuggestions] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  
  const [showRamoModal, setShowRamoModal] = useState(false);
  const [showSemestreModal, setShowSemestreModal] = useState(false);
  const [showInstanciaModal, setShowInstanciaModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const records = await pb.collection('problems').getFullList({
          filter: 'parent = null',
          fields: 'ramo,semestre,instancia,tags',
        });
        const uniqueRamos = Array.from(new Set(records.map(r => r.ramo).filter(Boolean))) as string[];
        const uniqueSemestres = Array.from(new Set(records.map(r => r.semestre).filter(Boolean))) as string[];
        const uniqueInstancias = Array.from(new Set(records.map(r => r.instancia).filter(Boolean))) as string[];
        const uniqueTags = Array.from(new Set(records.flatMap(r => r.tags || []).filter(Boolean))) as string[];
        setRamoSuggestions(uniqueRamos);
        setSemestreSuggestions(uniqueSemestres);
        setInstanciaSuggestions(uniqueInstancias);
        setTagSuggestions(uniqueTags);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      }
    };
    fetchSuggestions();
  }, []);



  const fetchProblems = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);

      // 1. Obtener problemas
      let filterConditions: string[] = ['parent = null'];
      if (activeSearch) {
        const safeSearch = activeSearch.replace(/"/g, '\\"');
        filterConditions.push(`title ~ "${safeSearch}"`);
      }
      activeTags.forEach(tag => {
        const safeTag = tag.replace(/"/g, '\\"');
        filterConditions.push(`tags ~ "${safeTag}"`);
      });
      if (activeRamo) {
        const safeRamo = activeRamo.replace(/"/g, '\\"');
        filterConditions.push(`ramo ~ "${safeRamo}"`);
      }
      if (activeSemestre) {
        const safeSemestre = activeSemestre.replace(/"/g, '\\"');
        filterConditions.push(`semestre ~ "${safeSemestre}"`);
      }
      if (activeInstancia) {
        const safeInstancia = activeInstancia.replace(/"/g, '\\"');
        filterConditions.push(`instancia ~ "${safeInstancia}"`);
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
    }, [activeSearch, activeTags, activeRamo, activeSemestre, activeInstancia])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', () => {
      onRefresh();
    });
    return () => sub.remove();
  }, [activeSearch, activeTags, activeRamo, activeSemestre, activeInstancia]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProblems(true);
  };

  const handleSearch = () => {
    setActiveSearch(searchQuery.trim());
    setActiveRamo(ramoQuery.trim());
    setActiveSemestre(semestreQuery.trim());
    setActiveInstancia(instanciaQuery.trim());
  };

  const clearSearch = () => {
    setSearchQuery('');
    setRamoQuery('');
    setSemestreQuery('');
    setInstanciaQuery('');
    setActiveSearch('');
    setActiveRamo('');
    setActiveSemestre('');
    setActiveInstancia('');
    setActiveTags([]);
  };



  const renderStars = (value: number, color: string) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (value >= i) {
        stars.push(
          <FontAwesome
            key={i}
            name="star"
            size={12}
            color={color}
            style={{ marginRight: 2 }}
          />
        );
      } else if (value >= i - 0.75) {
        stars.push(
          <FontAwesome
            key={i}
            name="star-half-o"
            size={12}
            color={color}
            style={{ marginRight: 2 }}
          />
        );
      } else {
        stars.push(
          <FontAwesome
            key={i}
            name="star"
            size={12}
            color="#262626"
            style={{ marginRight: 2 }}
          />
        );
      }
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
          {(searchQuery.length > 0 || ramoQuery.length > 0 || semestreQuery.length > 0 || instanciaQuery.length > 0) && (
            <TouchableOpacity onPress={clearSearch} style={{ marginRight: 8 }}>
              <Feather name="x" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtros académicos exclusivos */}
        <View style={[styles.academicFiltersRow, { zIndex: 1 }]}>
          {/* Ramo Filter */}
          <TouchableOpacity 
            onPress={() => {
              if (ramoQuery) {
                setRamoQuery('');
                setActiveRamo('');
              } else {
                setShowRamoModal(true);
              }
            }}
            style={{ flex: 1, marginRight: theme.spacing.xs }}
          >
            <View pointerEvents="none">
              <TextInput
                style={styles.academicFilterInput}
                placeholder="Ramo"
                placeholderTextColor={theme.colors.textMuted}
                value={ramoQuery}
                editable={false}
              />
            </View>
          </TouchableOpacity>

          {/* Semestre Filter */}
          <TouchableOpacity 
            onPress={() => {
              if (semestreQuery) {
                setSemestreQuery('');
                setActiveSemestre('');
              } else {
                setShowSemestreModal(true);
              }
            }}
            style={{ flex: 1, marginRight: theme.spacing.xs }}
          >
            <View pointerEvents="none">
              <TextInput
                style={styles.academicFilterInput}
                placeholder="Semestre"
                placeholderTextColor={theme.colors.textMuted}
                value={semestreQuery}
                editable={false}
              />
            </View>
          </TouchableOpacity>

          {/* Instancia Filter */}
          <TouchableOpacity 
            onPress={() => {
              if (instanciaQuery) {
                setInstanciaQuery('');
                setActiveInstancia('');
              } else {
                setShowInstanciaModal(true);
              }
            }}
            style={{ flex: 1 }}
          >
            <View pointerEvents="none">
              <TextInput
                style={styles.academicFilterInput}
                placeholder="Instancia"
                placeholderTextColor={theme.colors.textMuted}
                value={instanciaQuery}
                editable={false}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Etiqueta Filter (debajo de la fila horizontal) */}
        <TouchableOpacity 
          onPress={() => setShowTagModal(true)}
          style={{ marginBottom: theme.spacing.xs }}
        >
          <View pointerEvents="none">
            <TextInput
              style={styles.academicFilterInput}
              placeholder="Filtrar por Etiqueta (Agregar...)"
              placeholderTextColor={theme.colors.textMuted}
              value=""
              editable={false}
            />
          </View>
        </TouchableOpacity>

        {/* Chips de etiquetas de búsqueda activas */}
        {activeTags.length > 0 && (
          <View style={styles.activeTagsRow}>
            {activeTags.map((tag, idx) => (
              <TouchableOpacity 
                key={idx} 
                onPress={() => setActiveTags(activeTags.filter(t => t !== tag))} 
                style={styles.tagChipEditable}
              >
                <Text style={styles.tagChipEditableText}>#{tag} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Modales de Selección */}
        <SelectorModal
          visible={showRamoModal}
          title="Seleccionar Ramo"
          placeholder="Buscar ramo (ej. MA1001)..."
          suggestions={ramoSuggestions}
          allowCustom={false}
          onSelect={(val) => {
            setRamoQuery(val);
            setActiveRamo(val);
          }}
          onClose={() => setShowRamoModal(false)}
        />

        <SelectorModal
          visible={showSemestreModal}
          title="Seleccionar Semestre"
          placeholder="Buscar semestre (ej. 2024-1)..."
          suggestions={semestreSuggestions}
          allowCustom={false}
          onSelect={(val) => {
            setSemestreQuery(val);
            setActiveSemestre(val);
          }}
          onClose={() => setShowSemestreModal(false)}
        />

        <SelectorModal
          visible={showInstanciaModal}
          title="Seleccionar Instancia"
          placeholder="Buscar instancia (ej. C1)..."
          suggestions={instanciaSuggestions}
          allowCustom={false}
          onSelect={(val) => {
            setInstanciaQuery(val);
            setActiveInstancia(val);
          }}
          onClose={() => setShowInstanciaModal(false)}
        />

        <SelectorModal
          visible={showTagModal}
          title="Seleccionar Etiqueta"
          placeholder="Buscar etiqueta (ej. cálculo)..."
          suggestions={tagSuggestions.filter(t => !activeTags.includes(t))}
          allowCustom={false}
          onSelect={(val) => {
            if (val && !activeTags.includes(val)) {
              setActiveTags([...activeTags, val]);
            }
          }}
          onClose={() => setShowTagModal(false)}
        />
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
            const author = prob.deleted ? null : prob.expand?.author;
            const ratingData = ratingsMap[prob.id] || { rating: 0, difficulty: 0, count: 0 };
            
            return (
              <TouchableOpacity 
                key={prob.id} 
                style={styles.problemCard}
                activeOpacity={0.7}
                onPress={() => navigation.push('ProblemDetail', { problemId: prob.id, type: 'problem' })}
              >
                <View style={styles.cardHeader}>
                  <Avatar user={author} size={30} />
                  <View style={styles.authorMeta}>
                    <Text style={styles.authorName} numberOfLines={1}>{author?.name || (prob.deleted ? 'Usuario Anónimo' : 'Usuario')}</Text>
                    {!!author?.username && <Text style={styles.authorHandle}>@{author.username}</Text>}
                  </View>
                </View>
                {/* Academic Metadata Badges */}
                {!!(prob.ramo || prob.semestre || prob.instancia) && (
                  <View style={styles.academicBadgesRow}>
                    {!!prob.ramo && (
                      <View style={[styles.academicBadge, { backgroundColor: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.3)' }]}>
                        <Text style={[styles.academicBadgeText, { color: '#38BDF8' }]}>{prob.ramo}</Text>
                      </View>
                    )}
                    {!!prob.semestre && (
                      <View style={[styles.academicBadge, { backgroundColor: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.3)' }]}>
                        <Text style={[styles.academicBadgeText, { color: '#34D399' }]}>{prob.semestre}</Text>
                      </View>
                    )}
                    {!!prob.instancia && (
                      <View style={[styles.academicBadge, { backgroundColor: 'rgba(248, 113, 113, 0.1)', borderColor: 'rgba(248, 113, 113, 0.3)' }]}>
                        <Text style={[styles.academicBadgeText, { color: '#F87171' }]}>{prob.instancia}</Text>
                      </View>
                    )}
                  </View>
                )}

                <Text style={styles.problemTitle}>{prob.title}</Text>

                {/* Calificaciones */}
                <View style={styles.ratingsRow}>
                  <View style={styles.ratingCol}>
                    <Text style={styles.ratingLabel}>Enunciado: </Text>
                    <View style={styles.starsWrapper}>
                      {renderStars(ratingData.rating, '#F59E0B')}
                      {ratingData.count > 0 ? (
                        <Text style={styles.ratingCount}>{ratingData.rating} ({ratingData.count})</Text>
                      ) : (
                        <Text style={styles.ratingCount}>Sin notas</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.ratingCol}>
                    <Text style={styles.ratingLabel}>Dificultad: </Text>
                    <View style={styles.starsWrapper}>
                      {renderStars(ratingData.difficulty, '#EF4444')}
                      {ratingData.count > 0 ? (
                        <Text style={styles.ratingCount}>{ratingData.difficulty} ({ratingData.count})</Text>
                      ) : (
                        <Text style={styles.ratingCount}>Sin notas</Text>
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
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  ratingCol: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    width: 75,
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
  academicFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    marginTop: 2,
  },
  academicFilterInput: {
    width: '100%',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  academicBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 2,
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
  suggestionsContainer: {
    position: 'absolute',
    top: 38,
    left: 0,
    right: 0,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    maxHeight: 120,
    zIndex: 999,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222222',
  },
  suggestionItemText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  activeTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: theme.spacing.md,
  },
  tagChipEditable: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagChipEditableText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
});
