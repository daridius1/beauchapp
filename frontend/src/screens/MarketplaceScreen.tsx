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
  marketplaceService,
  MarketplaceItemRecord,
  CATEGORIES,
  SellerProfileRecord,
} from '../services/marketplaceService';
import { MarketplaceItemCard } from '../components/marketplace/MarketplaceItemCard';
import { SelectorModal } from '../components/SelectorModal';
import { withMinimumDelay } from '../utils/refresh';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'Marketplace'>;

export const MarketplaceScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user: currentUser } = useAuth();
  const initialCategory = route.params?.initialCategory || 'all';

  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showTagModal, setShowTagModal] = useState<boolean>(false);

  const [items, setItems] = useState<MarketplaceItemRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [mySellerProfile, setMySellerProfile] = useState<SellerProfileRecord | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      await withMinimumDelay(async () => {
        // Los items del marketplace y el perfil de vendedor propio son independientes, en paralelo.
        const [itemsResult, profileResult] = await Promise.allSettled([
          marketplaceService.getMarketplaceItems({
            category: activeCategory,
            query: activeSearch,
            tag: activeTags.join(','),
          }),
          currentUser ? marketplaceService.getSellerProfile(currentUser.id) : Promise.resolve(null),
        ]);

        if (itemsResult.status !== 'fulfilled') throw itemsResult.reason;
        setItems(itemsResult.value.items);

        if (currentUser) {
          setMySellerProfile(profileResult.status === 'fulfilled' ? profileResult.value : null);
        }
      }, 300);
    } catch (err) {
      console.error('Error loading marketplace:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory, activeSearch, activeTags, currentUser]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => loadItems(), 400);
      setLoading(false);
    });
    return () => sub.remove();
  }, [loadItems]);

  const onRefresh = () => {
    setRefreshing(true);
    loadItems();
  };

  // No se busca mientras se escribe: solo al confirmar (Enter / tecla "buscar" del teclado),
  // igual que en Problemas y Reseñas — nada de consultar la API en cada tecla.
  const handleSearch = () => {
    setActiveSearch(searchQuery.trim());
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
  };

  const handleOpenMySellerProfile = () => {
    if (!currentUser) {
      Toast.show({
        type: 'error',
        text1: 'Autenticación requerida',
        text2: 'Debes iniciar sesión para acceder a tu perfil de vendedor.',
      });
      return;
    }

    if (mySellerProfile) {
      navigation.navigate('SellerProfile', { sellerProfileId: mySellerProfile.id });
    } else {
      navigation.navigate('SellerProfileEditor');
    }
  };

  // Extraer sub-tags únicos populares de los productos cargados
  const popularTags = Array.from(
    new Set(items.flatMap((i) => (Array.isArray(i.tags) ? i.tags : [])))
  ).slice(0, 8);

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        {/* Acciones del Header (Arriba de todo) */}
        <View style={styles.headerActionsRow}>
          <TouchableOpacity style={styles.mySellerBtn} onPress={handleOpenMySellerProfile}>
            <Text style={styles.mySellerBtnText}>
              {mySellerProfile ? 'Perfil de Vendedor' : 'Activar Perfil de Vendedor'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar productos o servicios..."
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

        {/* Filtros de Categoría y Etiqueta con Selector Modal */}
        <View style={styles.filtersRow}>
          {/* Categoría Selector Filter */}
          <TouchableOpacity 
            onPress={() => {
              if (activeCategory !== 'all') {
                setActiveCategory('all');
              } else {
                setShowCategoryModal(true);
              }
            }}
            style={{ flex: 1, marginRight: theme.spacing.xs }}
          >
            <View style={{ pointerEvents: 'none' }}>
              <TextInput
                style={styles.filterInput}
                placeholder="Categoría"
                placeholderTextColor={theme.colors.textMuted}
                value={activeCategory !== 'all' ? (CATEGORIES.find(c => c.id === activeCategory)?.label || activeCategory) : ''}
                editable={false}
              />
            </View>
          </TouchableOpacity>

          {/* Etiqueta Selector Filter */}
          <TouchableOpacity 
            onPress={() => setShowTagModal(true)}
            style={{ flex: 1 }}
          >
            <View style={{ pointerEvents: 'none' }}>
              <TextInput
                style={styles.filterInput}
                placeholder="Etiqueta"
                placeholderTextColor={theme.colors.textMuted}
                value=""
                editable={false}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Chips de Etiquetas Seleccionadas */}
        {activeTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {activeTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.subTagChipActive}
                  onPress={() => setActiveTags((prev) => prev.filter((t) => t !== tag))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.subTagChipTextActive}>{tag}</Text>
                  <Feather name="x" size={12} color="#ffffff" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Item Feed */}
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
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="box" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No hay productos disponibles</Text>
            <Text style={styles.emptySub}>
              {activeSearch.trim() || activeTags.length > 0
                ? 'Prueba ajustando tu búsqueda o filtros.'
                : 'Sé el primero en publicar un producto o servicio en Beauchapp.'}
            </Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {items.map((item) => (
              <View key={item.id} style={styles.gridItem}>
                <MarketplaceItemCard
                  item={item}
                  onPress={() => navigation.navigate('MarketplaceItemDetail', { itemId: item.id })}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Selector Modals para Filtro de Búsqueda con Texto (Estándar de la Plataforma) */}
      <SelectorModal
        visible={showCategoryModal}
        title="Filtrar por Categoría"
        placeholder="Buscar categoría..."
        suggestions={CATEGORIES.map((c) => c.label)}
        allowCustom={false}
        onSelect={(label) => {
          if (!label) {
            setActiveCategory('all');
          } else {
            const matched = CATEGORIES.find((c) => c.label.toLowerCase() === label.toLowerCase());
            setActiveCategory(matched ? matched.id : 'all');
          }
        }}
        onClose={() => setShowCategoryModal(false)}
      />

      <SelectorModal
        visible={showTagModal}
        title="Filtrar por Etiqueta"
        placeholder="Buscar etiqueta..."
        suggestions={popularTags}
        allowCustom={true}
        onSelect={(tagVal) => {
          if (tagVal) {
            const clean = tagVal.trim().replace(/^#/, '');
            if (clean && !activeTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
              setActiveTags((prev) => [...prev, clean]);
            }
          }
        }}
        onClose={() => setShowTagModal(false)}
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
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 2,
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
  headerActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    marginBottom: 10,
  },
  mySellerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  mySellerBtnText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  publishBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  publishBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  tagsBar: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  subTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  subTagChipActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  subTagChipText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  subTagChipTextActive: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '48%',
  },
});
