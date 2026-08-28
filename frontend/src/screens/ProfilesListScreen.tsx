import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  DeviceEventEmitter,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { withMinimumDelay } from '../utils/refresh';
import { SelectorModal } from '../components/SelectorModal';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'Directory' | 'Communities' | 'Centers' | 'Teams' | 'Bands' | 'Students' | 'FollowList'
>;

const PROFILE_TYPE_SUGGESTIONS = [
  'Todos los perfiles',
  'Usuarios',
  'Organizaciones',
];

const ORG_SUBTYPE_SUGGESTIONS = [
  'Todas las organizaciones',
  'Organizaciones',
  'Comunidades',
  'Centros de Estudiantes',
  'Equipos',
  'Bandas',
  'Ligas',
];

export const ProfilesListScreen: React.FC<Props> = ({ route, navigation }) => {
  const routeName = route.name;
  const routeParams = route.params as any;

  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // La búsqueda solo se aplica al servidor cuando se confirma (submit), no en cada tecla
  // (mismo patrón que Reseñas/Marketplace/Problemas). Antes de esto, "searchQuery" solo
  // filtraba en el cliente los 100 perfiles ya traídos ordenados por nombre — cualquier
  // usuario cuyo nombre cayera después del corte alfabético (ej. apellidos con "W") nunca
  // aparecía en el resultado sin importar qué se buscara.
  const [activeSearch, setActiveSearch] = useState('');

  const PER_PAGE = 30;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filtros de Selectores
  const [profileType, setProfileType] = useState<'all' | 'student' | 'organization'>('all');
  const [orgSubtype, setOrgSubtype] = useState<'all' | 'community' | 'center' | 'team' | 'band' | 'organization' | 'league'>('all');

  // Modales de Selección
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showSubtypeModal, setShowSubtypeModal] = useState(false);

  const isFirstLoad = useRef(true);

  // Inicializar filtros según la ruta de navegación de origen
  useEffect(() => {
    if (routeName === 'Communities') {
      setProfileType('organization');
      setOrgSubtype('community');
    } else if (routeName === 'Centers') {
      setProfileType('organization');
      setOrgSubtype('center');
    } else if (routeName === 'Teams') {
      setProfileType('organization');
      setOrgSubtype('team');
    } else if (routeName === 'Bands') {
      setProfileType('organization');
      setOrgSubtype('band');
    } else if (routeName === 'Students') {
      setProfileType('student');
      setOrgSubtype('all');
    } else if (routeName === 'Directory') {
      setProfileType('all');
      setOrgSubtype('all');
    }
  }, [routeName]);

  // Desactivar y limpiar automáticamente el filtro de organización si Tipo de Perfil no es 'organization'
  useEffect(() => {
    if (profileType !== 'organization' && orgSubtype !== 'all') {
      setOrgSubtype('all');
    }
  }, [profileType, orgSubtype]);

  const buildUsersFilter = () => {
    let filterParts: string[] = [];

    if (profileType === 'student') {
      filterParts.push('type != "organization"');
    } else if (profileType === 'organization') {
      filterParts.push('type = "organization"');
    }

    if (orgSubtype !== 'all') {
      if (profileType === 'all') {
        filterParts.push(`type = "organization" && subtype = "${orgSubtype}"`);
      } else {
        filterParts.push(`subtype = "${orgSubtype}"`);
      }
    }

    if (activeSearch) {
      const safeSearch = activeSearch.replace(/"/g, '\\"');
      filterParts.push(`(name ~ "${safeSearch}" || username ~ "${safeSearch}")`);
    }

    return filterParts.join(' && ');
  };

  const fetchProfiles = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);

      setHasMore(false);

      if (routeName === 'FollowList') {
        const userId = routeParams?.userId;
        const type = routeParams?.type;

        if (type === 'members') {
          const res = await pb.collection('organization_members').getList(1, 200, {
            filter: `organization = "${userId}" && status = "active"`,
            expand: 'user',
            sort: '-created',
          });
          const mappedUsers = res.items
            .map((item) => {
              const u = item.expand?.user;
              if (!u) return null;
              return {
                ...u,
                memberRole: item.role,
              };
            })
            .filter((user) => !!user);
          setProfiles(mappedUsers);
        } else if (type === 'recommendations') {
          const res = await pb.collection('seller_recommendations').getList(1, 200, {
            filter: `seller = "${userId}"`,
            expand: 'user',
            sort: '-created',
          });
          const mappedUsers = res.items
            .map((item) => item.expand?.user)
            .filter((user) => !!user);
          setProfiles(mappedUsers);
        } else if (type === 'attendees') {
          const res = await pb.collection('activity_attendees').getList(1, 200, {
            filter: `activity = "${userId}"`,
            expand: 'user',
            sort: '-created',
          });
          const mappedUsers = res.items
            .map((item) => item.expand?.user)
            .filter((user) => !!user);
          setProfiles(mappedUsers);
        } else if (type === 'poll_voters') {
          // Acá "userId" es en realidad el ID del post con la encuesta (mismo overload
          // genérico que ya usan members/recommendations/attendees).
          const res = await pb.collection('poll_votes').getList(1, 200, {
            filter: `post = "${userId}" && optionIndex = ${routeParams?.optionIndex}`,
            expand: 'user',
            sort: '-created',
          });
          const mappedUsers = res.items
            .map((item) => item.expand?.user)
            .filter((user) => !!user);
          setProfiles(mappedUsers);
        } else {
          const isFollowers = type === 'followers';
          const filterStr = isFollowers ? `following = "${userId}"` : `follower = "${userId}"`;

          const res = await pb.collection('follows').getList(1, 200, {
            filter: filterStr,
            expand: isFollowers ? 'follower' : 'following',
            sort: '-created',
          });

          const mappedUsers = res.items
            .map((item) => (isFollowers ? item.expand?.follower : item.expand?.following))
            .filter((user) => !!user);

          setProfiles(mappedUsers);
        }
      } else {
        const res = await pb.collection('users').getList(1, PER_PAGE, {
          filter: buildUsersFilter(),
          sort: 'name',
        });
        setProfiles(res.items);
        setPage(1);
        setHasMore(res.page < res.totalPages);
      }
    } catch (err) {
      console.error(`Error fetching profiles list:`, err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchProfiles(true));
      setLoading(false);
    });
    return () => sub.remove();
  }, [routeName, routeParams?.userId, routeParams?.type, profileType, orgSubtype, activeSearch]);

  useFocusEffect(
    useCallback(() => {
      fetchProfiles(!isFirstLoad.current);
      isFirstLoad.current = false;
    }, [routeName, routeParams?.userId, routeParams?.type, profileType, orgSubtype, activeSearch])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchProfiles(true));
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || routeName === 'FollowList') return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await pb.collection('users').getList(nextPage, PER_PAGE, {
        filter: buildUsersFilter(),
        sort: 'name',
      });
      setProfiles((prev) => [...prev, ...res.items]);
      setPage(nextPage);
      setHasMore(res.page < res.totalPages);
    } catch (err) {
      console.error('Error loading more profiles:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = () => {
    setActiveSearch(searchQuery.trim());
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
  };

  const getProfileTypeLabel = () => {
    if (profileType === 'student') return 'Usuarios';
    if (profileType === 'organization') return 'Organizaciones';
    return 'Todos los perfiles';
  };

  const getOrgSubtypeLabel = () => {
    if (orgSubtype === 'organization') return 'Organización';
    if (orgSubtype === 'community') return 'Comunidades';
    if (orgSubtype === 'center') return 'Centros';
    if (orgSubtype === 'team') return 'Equipos';
    if (orgSubtype === 'band') return 'Bandas';
    if (orgSubtype === 'league') return 'Ligas';
    return 'Todas las orgs';
  };

  const emptyText =
    routeName === 'FollowList'
      ? routeParams?.type === 'followers'
        ? 'Esta cuenta aún no tiene seguidores.'
        : routeParams?.type === 'following'
        ? 'Esta cuenta aún no sigue a nadie.'
        : routeParams?.type === 'recommendations'
        ? 'Aún nadie ha recomendado a este vendedor.'
        : routeParams?.type === 'attendees'
        ? 'Aún nadie ha confirmado asistencia a esta actividad.'
        : routeParams?.type === 'poll_voters'
        ? 'Nadie ha votado esta opción todavía.'
        : 'Esta organización aún no tiene integrantes registrados.'
      : 'No se encontraron perfiles con los filtros seleccionados.';

  return (
    <View style={styles.container}>
      {refreshing && (
        <View style={styles.refreshIndicatorContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      {/* Header de Búsqueda y Filtros al estilo Problemas */}
      {routeName !== 'FollowList' && (
        <View style={styles.headerFilters}>
          {/* Barra de Búsqueda por Texto */}
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar perfiles..."
              placeholderTextColor={theme.colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {(searchQuery.length > 0 || profileType !== 'all' || orgSubtype !== 'all') && (
              <TouchableOpacity
                onPress={() => {
                  clearSearch();
                  setProfileType('all');
                  setOrgSubtype('all');
                }}
                style={{ marginRight: 8 }}
              >
                <Feather name="x" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Fila de Filtros horizontales idénticos a los de Problemas */}
          <View style={[styles.filtersRow, { zIndex: 1 }]}>
            {/* Selector 1: Tipo de Perfil */}
            <TouchableOpacity
              onPress={() => {
                if (profileType !== 'all') {
                  setProfileType('all');
                } else {
                  setShowTypeModal(true);
                }
              }}
              style={{ flex: 1, marginRight: theme.spacing.xs }}
            >
              <View style={{ pointerEvents: 'none' }}>
                <TextInput
                  style={styles.filterInput}
                  placeholder="Tipo de Perfil"
                  placeholderTextColor={theme.colors.textMuted}
                  value={profileType === 'all' ? '' : getProfileTypeLabel()}
                  editable={false}
                />
              </View>
            </TouchableOpacity>

            {/* Selector 2: Tipo de Organización (Solo activo si Tipo de Perfil es 'organization') */}
            <TouchableOpacity
              onPress={() => {
                if (profileType !== 'organization') return;
                if (orgSubtype !== 'all') {
                  setOrgSubtype('all');
                } else {
                  setShowSubtypeModal(true);
                }
              }}
              disabled={profileType !== 'organization'}
              style={{ flex: 1, opacity: profileType === 'organization' ? 1 : 0.4 }}
            >
              <View style={{ pointerEvents: 'none' }}>
                <TextInput
                  style={styles.filterInput}
                  placeholder="Tipo de Organización"
                  placeholderTextColor={theme.colors.textMuted}
                  value={profileType === 'organization' && orgSubtype !== 'all' ? getOrgSubtypeLabel() : ''}
                  editable={false}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Lista de Resultados */}
      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(profile) => profile.id}
          contentContainerStyle={styles.scrollContent}
          onEndReachedThreshold={0.3}
          onEndReached={handleLoadMore}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="users" size={40} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 16 }} />
            ) : null
          }
          renderItem={({ item: profile }) => (
            <TouchableOpacity
              style={styles.itemContainer}
              // Sin `title` acá: el header debe decir "Perfil" (estudiantes) o el tipo de
              // organización, nunca el nombre — eso ya lo resuelve ProfileScreen con
              // navigation.setParams una vez que sabe si es organización y de qué subtipo.
              onPress={() => navigation.push('UserProfile', { userId: profile.id })}
            >
              <View style={{ marginRight: theme.spacing.md }}>
                <Avatar user={profile} size={40} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.itemName}>{profile.name || 'Usuario'}</Text>
                  {profile.type === 'organization' && (
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {profile.subtype === 'center'
                          ? 'Centro'
                          : profile.subtype === 'team'
                          ? 'Equipo'
                          : profile.subtype === 'community'
                          ? 'Comunidad'
                          : profile.subtype === 'band'
                          ? 'Banda'
                          : profile.subtype === 'organization'
                          ? 'Organización'
                          : profile.subtype === 'league'
                          ? 'Liga'
                          : 'Org'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.itemSubtitleRow}>
                  {!!profile.username && <Text style={styles.itemUsername}>@{profile.username}</Text>}
                  {!!profile.username && !!profile.memberRole && <Text style={styles.subtitleDot}>•</Text>}
                  {!!profile.memberRole && <Text style={styles.memberRoleText}>{profile.memberRole}</Text>}
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Selector Modal: Tipo de Perfil */}
      <SelectorModal
        visible={showTypeModal}
        title="Tipo de Perfil"
        placeholder="Buscar tipo de perfil..."
        suggestions={PROFILE_TYPE_SUGGESTIONS}
        allowCustom={false}
        onSelect={(val) => {
          if (!val || val === 'Todos los perfiles') {
            setProfileType('all');
          } else if (val === 'Usuarios' || val === 'Personas (Estudiantes)') {
            setProfileType('student');
          } else if (val === 'Organizaciones') {
            setProfileType('organization');
          }
        }}
        onClose={() => setShowTypeModal(false)}
      />

      {/* Selector Modal: Tipo de Organización */}
      <SelectorModal
        visible={showSubtypeModal}
        title="Tipo de Organización"
        placeholder="Buscar tipo de organización..."
        suggestions={ORG_SUBTYPE_SUGGESTIONS}
        allowCustom={false}
        onSelect={(val) => {
          if (!val || val === 'Todas las organizaciones') {
            setOrgSubtype('all');
          } else if (val === 'Organizaciones' || val === 'Organización') {
            setOrgSubtype('organization');
          } else if (val === 'Comunidades') {
            setOrgSubtype('community');
          } else if (val === 'Centros de Estudiantes') {
            setOrgSubtype('center');
          } else if (val === 'Equipos' || val === 'Equipos y Proyectos') {
            setOrgSubtype('team');
          } else if (val === 'Bandas') {
            setOrgSubtype('band');
          } else if (val === 'Ligas') {
            setOrgSubtype('league');
          }
        }}
        onClose={() => setShowSubtypeModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  refreshIndicatorContainer: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  headerFilters: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.background,
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
    marginBottom: theme.spacing.xs,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    marginTop: 2,
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
    paddingTop: theme.spacing.sm,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  typeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  typeBadgeText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  itemSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
    gap: 4,
  },
  itemUsername: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  subtitleDot: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  memberRoleText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
