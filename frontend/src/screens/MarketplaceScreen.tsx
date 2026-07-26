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
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);

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
        const res = await marketplaceService.getMarketplaceItems({
          category: activeCategory,
          query: searchQuery,
          tag: activeTag,
        });
        setItems(res.items);

        if (currentUser) {
          const profile = await marketplaceService.getSellerProfile(currentUser.id);
          setMySellerProfile(profile);
        }
      }, 300);
    } catch (err) {
      console.error('Error loading marketplace:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory, searchQuery, activeTag, currentUser]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const onRefresh = () => {
    setRefreshing(true);
    loadItems();
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
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar productos o servicios..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtros de Categoría y Sub-tag con Selector Modal */}
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

          {/* Sub-tag Selector Filter */}
          <TouchableOpacity 
            onPress={() => {
              if (activeTag) {
                setActiveTag(undefined);
              } else {
                setShowTagModal(true);
              }
            }}
            style={{ flex: 1 }}
          >
            <View style={{ pointerEvents: 'none' }}>
              <TextInput
                style={styles.filterInput}
                placeholder="Sub-tag"
                placeholderTextColor={theme.colors.textMuted}
                value={activeTag ? `#${activeTag}` : ''}
                editable={false}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Acciones del Header */}
        <View style={styles.headerActionsRow}>
          <TouchableOpacity style={styles.mySellerBtn} onPress={handleOpenMySellerProfile}>
            <Text style={styles.mySellerBtnText}>
              {mySellerProfile ? '🛍️ Mi Tienda / Perfil de Vendedor' : 'Activar Perfil de Vendedor'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pestañas de Categoría Principal */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={styles.categoriesRow}>
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                  onPress={() => setActiveCategory(cat.id)}
                >
                  <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Bar de sub-tags populares */}
        {popularTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={styles.tagsBar}>
              {popularTags.map((t) => {
                const isSelected = activeTag === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.subTagChip, isSelected && styles.subTagChipActive]}
                    onPress={() => setActiveTag(isSelected ? undefined : t)}
                  >
                    <Text style={[styles.subTagChipText, isSelected && styles.subTagChipTextActive]}>
                      #{t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
              {searchQuery.trim() || activeTag
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
        title="Filtrar por Sub-tag"
        placeholder="Buscar sub-tag..."
        suggestions={popularTags}
        allowCustom={false}
        onSelect={(tagVal) => {
          if (!tagVal) {
            setActiveTag(undefined);
          } else {
            const clean = tagVal.trim().replace(/^#/, '').toLowerCase();
            setActiveTag(clean);
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
    marginTop: 8,
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
  categoriesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  categoryTabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryTabText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryTabTextActive: {
    color: '#000000',
  },
  tagsBar: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  subTagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  subTagChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  subTagChipText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  subTagChipTextActive: {
    color: theme.colors.primary,
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
