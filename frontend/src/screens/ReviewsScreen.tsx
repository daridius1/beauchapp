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
  DeviceEventEmitter,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Feather } from '@expo/vector-icons';
import {
  reviewsService,
  CourseRecord,
  ProfessorRecord,
  DualRatingSummary,
} from '../services/reviewsService';
import { CourseListItem } from '../components/CourseListItem';
import { ProfessorListItem } from '../components/ProfessorListItem';
import { SelectorModal } from '../components/SelectorModal';
import { withMinimumDelay } from '../utils/refresh';

type Props = NativeStackScreenProps<RootStackParamList, 'Reviews'>;

type Mode = 'courses' | 'professors';

export const ReviewsScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();

  const [mode, setMode] = useState<Mode>('courses');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);

  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [professors, setProfessors] = useState<ProfessorRecord[]>([]);
  const [ratings, setRatings] = useState<Record<string, DualRatingSummary>>({});

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    reviewsService.getCourseAreas().then(setAreas).catch(() => {});
  }, []);

  // No se busca mientras se escribe: solo al confirmar (Enter / tecla "buscar" del teclado),
  // igual que en Problemas — nada de sugerencias en vivo ni de esperar una pausa para tipear.
  const handleSearch = () => {
    setActiveQuery(searchQuery.trim());
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveQuery('');
  };

  const loadRatings = async (targetMode: Mode, ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const summaries = targetMode === 'courses'
        ? await reviewsService.getCourseRatingSummaries(ids, user?.id)
        : await reviewsService.getProfessorRatingSummaries(ids, user?.id);
      setRatings((prev) => ({ ...prev, ...summaries }));
    } catch (err) {
      console.error('Error loading rating summaries:', err);
    }
  };

  const fetchResults = useCallback(async (pageNum = 1, isLoadMore = false, hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      if (mode === 'courses') {
        const res = await reviewsService.searchCourses({ query: activeQuery, area: areaFilter, page: pageNum });
        setCourses((prev) => (isLoadMore ? [...prev, ...res.items] : res.items));
        setHasMore(res.page < res.totalPages);
        setPage(res.page);
        loadRatings('courses', res.items.map((c) => c.id));
      } else {
        const res = await reviewsService.searchProfessors({ query: activeQuery, page: pageNum });
        setProfessors((prev) => (isLoadMore ? [...prev, ...res.items] : res.items));
        setHasMore(res.page < res.totalPages);
        setPage(res.page);
        loadRatings('professors', res.items.map((p) => p.id));
      }
    } catch (err) {
      console.error('Error searching reviews:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeQuery, areaFilter]);

  useEffect(() => {
    fetchResults(1, false);
  }, [fetchResults]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchResults(1, false, true));
      setLoading(false);
    });
    return () => sub.remove();
  }, [fetchResults]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchResults(1, false, true);
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 500;
    if (isCloseToBottom && hasMore && !loadingMore && !loading) {
      setLoadingMore(true);
      fetchResults(page + 1, true, true);
    }
  };

  const results = mode === 'courses' ? courses : professors;

  return (
    <View style={styles.container}>
      <View style={styles.searchHeader}>
        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'courses' && styles.segmentBtnActive]}
            onPress={() => setMode('courses')}
          >
            <Text style={[styles.segmentText, mode === 'courses' && styles.segmentTextActive]}>Ramos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'professors' && styles.segmentBtnActive]}
            onPress={() => setMode('professors')}
          >
            <Text style={[styles.segmentText, mode === 'professors' && styles.segmentTextActive]}>Profesores</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={mode === 'courses' ? 'Buscar ramo por nombre o código...' : 'Buscar profesor por nombre...'}
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Feather name="x" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {mode === 'courses' && (
          <TouchableOpacity
            onPress={() => (areaFilter ? setAreaFilter('') : setShowAreaModal(true))}
            style={{ marginTop: 8 }}
          >
            <View pointerEvents="none">
              <TextInput
                style={styles.filterInput}
                placeholder="Área"
                placeholderTextColor={theme.colors.textMuted}
                value={areaFilter}
                editable={false}
              />
            </View>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name={mode === 'courses' ? 'book-open' : 'user'} size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {mode === 'courses' ? 'No se encontraron ramos' : 'No se encontraron profesores'}
            </Text>
            <Text style={styles.emptySub}>Prueba ajustando tu búsqueda o filtros.</Text>
          </View>
        ) : mode === 'courses' ? (
          courses.map((course) => (
            <CourseListItem
              key={course.id}
              course={course}
              rating={ratings[course.id]}
              onPress={() => navigation.navigate('CourseDetail', { courseId: course.id })}
            />
          ))
        ) : (
          professors.map((professor) => (
            <ProfessorListItem
              key={professor.id}
              professor={professor}
              rating={ratings[professor.id]}
              onPress={() => navigation.navigate('ProfessorDetail', { professorId: professor.id })}
            />
          ))
        )}

        {loadingMore && <ActivityIndicator size="small" color={theme.colors.text} style={{ padding: 20 }} />}
      </ScrollView>

      <SelectorModal
        visible={showAreaModal}
        title="Filtrar por Área"
        placeholder="Buscar área..."
        suggestions={areas}
        allowCustom={false}
        onSelect={(label) => setAreaFilter(label)}
        onClose={() => setShowAreaModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  segmentRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
  },
  segmentBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.cardBg,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  segmentTextActive: {
    color: theme.colors.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
  },
  filterInput: {
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
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
