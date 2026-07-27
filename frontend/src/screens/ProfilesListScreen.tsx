import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
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
  'Personas (Estudiantes)',
  'Organizaciones',
];

const ORG_SUBTYPE_SUGGESTIONS = [
  'Todas las organizaciones',
  'Comunidades',
  'Centros de Estudiantes',
  'Equipos y Proyectos',
  'Bandas',
];

export const ProfilesListScreen: React.FC<Props> = ({ route, navigation }) => {
  const routeName = route.name;
  const routeParams = route.params as any;

  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtros de Selectores
  const [profileType, setProfileType] = useState<'all' | 'student' | 'organization'>('all');
  const [orgSubtype, setOrgSubtype] = useState<'all' | 'community' | 'center' | 'team' | 'band'>('all');

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

  const fetchProfiles = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);

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

        const res = await pb.collection('users').getList(1, 100, {
          filter: filterParts.join(' && '),
          sort: 'name',
        });
        setProfiles(res.items);
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
  }, [routeName, routeParams?.userId, routeParams?.type, profileType, orgSubtype]);

  useFocusEffect(
    useCallback(() => {
      fetchProfiles(!isFirstLoad.current);
      isFirstLoad.current = false;
    }, [routeName, routeParams?.userId, routeParams?.type, profileType, orgSubtype])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchProfiles(true));
    setRefreshing(false);
  };

  const getProfileTypeLabel = () => {
    if (profileType === 'student') return 'Personas';
    if (profileType === 'organization') return 'Organizaciones';
    return 'Todos los perfiles';
  };

  const getOrgSubtypeLabel = () => {
    if (orgSubtype === 'community') return 'Comunidades';
    if (orgSubtype === 'center') return 'Centros';
    if (orgSubtype === 'team') return 'Equipos y Proyectos';
    if (orgSubtype === 'band') return 'Bandas';
    return 'Todas las orgs';
  };

  const filteredProfiles = profiles.filter(
    (p) =>
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const emptyText =
    routeName === 'FollowList'
      ? routeParams?.type === 'followers'
        ? 'Esta cuenta aún no tiene seguidores.'
        : routeParams?.type === 'following'
        ? 'Esta cuenta aún no sigue a nadie.'
        : routeParams?.type === 'recommendations'
        ? 'Aún nadie ha recomendado a este vendedor.'
        : 'Esta organización aún no tiene integrantes registrados.'
      : 'No se encontraron perfiles con los filtros seleccionados.';

  return (
    <View style={styles.container}>
      {refreshing && (
        <View style={styles.refreshIndicatorContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      {/* Header de Búsqueda y Selectores de Filtro */}
      {routeName !== 'FollowList' && (
        <View style={styles.searchContainer}>
          {/* Barra de Búsqueda por Texto */}
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar perfiles por nombre o @usuario..."
              placeholderTextColor={theme.colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {(searchQuery.length > 0 || profileType !== 'all' || orgSubtype !== 'all') && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setProfileType('all');
                  setOrgSubtype('all');
                }}
              >
                <Feather name="x-circle" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Fila de Selectores de Filtro */}
          <View style={styles.selectorsRow}>
            {/* Selector 1: Tipo de Perfil */}
            <TouchableOpacity
              style={[styles.filterSelectorBtn, profileType !== 'all' && styles.filterSelectorBtnActive]}
              onPress={() => setShowTypeModal(true)}
              activeOpacity={0.7}
            >
              <View style={{ pointerEvents: 'none', flex: 1 }}>
                <Text style={styles.filterLabel}>Tipo de Perfil</Text>
                <Text style={[styles.filterValueText, profileType !== 'all' && styles.filterValueTextActive]} numberOfLines={1}>
                  {getProfileTypeLabel()}
                </Text>
              </View>
              <Feather
                name="chevron-down"
                size={16}
                color={profileType !== 'all' ? theme.colors.primary : theme.colors.textMuted}
              />
            </TouchableOpacity>

            {/* Selector 2: Tipo de Organización */}
            <TouchableOpacity
              style={[styles.filterSelectorBtn, orgSubtype !== 'all' && styles.filterSelectorBtnActive]}
              onPress={() => setShowSubtypeModal(true)}
              activeOpacity={0.7}
            >
              <View style={{ pointerEvents: 'none', flex: 1 }}>
                <Text style={styles.filterLabel}>Organización</Text>
                <Text style={[styles.filterValueText, orgSubtype !== 'all' && styles.filterValueTextActive]} numberOfLines={1}>
                  {getOrgSubtypeLabel()}
                </Text>
              </View>
              <Feather
                name="chevron-down"
                size={16}
                color={orgSubtype !== 'all' ? theme.colors.primary : theme.colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Lista de Resultados */}
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
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
        ) : filteredProfiles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="users" size={40} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : (
          filteredProfiles.map((profile) => (
            <TouchableOpacity
              key={profile.id}
              style={styles.itemContainer}
              onPress={() => navigation.push('UserProfile', { userId: profile.id, title: profile.name })}
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
          ))
        )}
      </ScrollView>

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
          } else if (val === 'Personas (Estudiantes)') {
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
          } else if (val === 'Comunidades') {
            setOrgSubtype('community');
          } else if (val === 'Centros de Estudiantes') {
            setOrgSubtype('center');
          } else if (val === 'Equipos y Proyectos') {
            setOrgSubtype('team');
          } else if (val === 'Bandas') {
            setOrgSubtype('band');
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
  searchContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
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
  selectorsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  filterSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterSelectorBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  filterValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  filterValueTextActive: {
    color: theme.colors.primary,
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
