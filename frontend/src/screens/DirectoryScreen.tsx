import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  FlatList, 
  Dimensions 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'Directory'>;

export const DirectoryScreen: React.FC<Props> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  const [featuredProfiles, setFeaturedProfiles] = useState<any[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  // Fetch featured organization profiles
  const fetchFeatured = async () => {
    try {
      setLoadingFeatured(true);
      const res = await pb.collection('users').getList(1, 10, {
        filter: 'type = "organization"',
        sort: '-created', // Newest first
      });
      
      // Shuffle list to make it dynamic
      const shuffled = [...res.items].sort(() => 0.5 - Math.random());
      setFeaturedProfiles(shuffled.slice(0, 5));
    } catch (err) {
      console.error('Error fetching featured profiles:', err);
    } finally {
      setLoadingFeatured(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchFeatured();
    }, [])
  );

  // Run search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        setSearching(true);
        const filterStr = `name ~ "${searchQuery}" || username ~ "${searchQuery}"`;
        const res = await pb.collection('users').getList(1, 20, {
          filter: filterStr,
          sort: 'name',
        });
        setSearchResults(res.items);
      } catch (err) {
        console.error('Error searching directory:', err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const getSubtypeLabel = (subtype: string) => {
    switch (subtype) {
      case 'center': return 'Centro de Estudiantes';
      case 'team': return 'Equipo Oficial';
      case 'community': return 'Comunidad';
      default: return 'Organización';
    }
  };

  const getSubtypeColor = (val: string) => {
    switch (val) {
      case 'center': return '#8B5CF6'; // Violeta
      case 'team': return '#F59E0B'; // Ámbar/Naranja
      case 'community': return '#3B82F6'; // Azul
      case 'student': return '#10B981'; // Verde/Teal
      default: return theme.colors.primary;
    }
  };

  const categories = [
    {
      id: 'Communities',
      title: 'Comunidades',
      description: 'Grupos libres de estudiantes con intereses comunes, pasatiempos, arte y más.',
      icon: 'users' as const,
      color: '#3B82F6',
    },
    {
      id: 'Centers',
      title: 'Centros de Estudiantes',
      description: 'Órganos de representación estudiantil de plan común y de especialidades.',
      icon: 'award' as const,
      color: '#8B5CF6',
    },
    {
      id: 'Teams',
      title: 'Equipos y Proyectos',
      description: 'Grupos organizados oficiales, deportivos, robótica, investigación y tecnología.',
      icon: 'cpu' as const,
      color: '#F59E0B',
    },
    {
      id: 'Students',
      title: 'Personas',
      description: 'Explora y conecta con perfiles de tus compañeros y otros estudiantes.',
      icon: 'user' as const,
      color: '#10B981',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Buscador Global */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar comunidades, centros, equipos..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {searchQuery.trim().length > 0 ? (
          // Vista de Resultados de Búsqueda
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resultados de búsqueda</Text>
            {searching ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
            ) : searchResults.length === 0 ? (
              <Text style={styles.emptyText}>No se encontraron organizaciones para "{searchQuery}"</Text>
            ) : (
              searchResults.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.searchResultCard}
                  onPress={() => navigation.push('UserProfile', { userId: item.id, title: item.name })}
                >
                  <View style={{ marginRight: theme.spacing.md }}>
                    <Avatar user={item} size={44} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <Text style={{ color: getSubtypeColor(item.subtype || item.type), fontSize: 12, fontWeight: '600' }}>
                      {item.type !== 'organization' ? 'Persona' : getSubtypeLabel(item.subtype)}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          // Vista de Descubrimiento (Opción 2)
          <>
            {/* Categorías */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Categorías</Text>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.push(cat.id as any)}
                >
                  <View style={[styles.iconWrapper, { backgroundColor: cat.color + '15' }]}>
                    <Feather name={cat.icon} size={24} color={cat.color} />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.categoryTitle}>{cat.title}</Text>
                    <Text style={styles.categoryDesc}>{cat.description}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Carrusel de Recomendados */}
            <View style={[styles.section, { marginTop: theme.spacing.lg }]}>
              <Text style={styles.sectionTitle}>Perfiles destacados</Text>
              {loadingFeatured ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 20 }} />
              ) : featuredProfiles.length === 0 ? (
                <Text style={styles.emptyText}>No hay perfiles destacados actualmente.</Text>
              ) : (
                <FlatList
                  data={featuredProfiles}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.featuredCarousel}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.featuredCard}
                      activeOpacity={0.8}
                      onPress={() => navigation.push('UserProfile', { userId: item.id, title: item.name })}
                    >
                      <View style={styles.featuredCardHeader}>
                        <Avatar user={item} size={48} />
                        <View style={styles.badgeWrapper}>
                          <View style={[styles.subtypeBadge, { backgroundColor: getSubtypeColor(item.subtype) + '20', borderColor: getSubtypeColor(item.subtype) + '50' }]}>
                            <Text style={[styles.subtypeBadgeText, { color: getSubtypeColor(item.subtype) }]}>
                              {item.subtype === 'center' ? 'Centro' : item.subtype === 'team' ? 'Equipo' : 'Comu'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      
                      <Text style={styles.featuredName} numberOfLines={1}>{item.name}</Text>
                      {item.username ? <Text style={styles.featuredUsername}>@{item.username}</Text> : null}
                      
                      <Text style={styles.featuredBio} numberOfLines={2}>
                        {item.description || 'Sin descripción disponible.'}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </>
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
  searchContainer: {
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
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  categoryTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  categoryDesc: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  featuredCarousel: {
    paddingRight: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  featuredCard: {
    width: 200,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginRight: theme.spacing.md,
  },
  featuredCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  badgeWrapper: {
    flexDirection: 'row',
  },
  subtypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  subtypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  featuredName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  featuredUsername: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  featuredBio: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  resultName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
});
