import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, DeviceEventEmitter, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'Communities' | 'Centers' | 'Teams' | 'Students'>;

export const ProfilesListScreen: React.FC<Props> = ({ route, navigation }) => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isFirstLoad = useRef(true);

  // Configuración dinámica basada en la ruta
  const routeName = route.name;
  let filter = '';
  let emptyText = '';

  if (routeName === 'Communities') {
    filter = 'type = "organization" && subtype = "community"';
    emptyText = 'Aún no hay comunidades creadas.';
  } else if (routeName === 'Centers') {
    filter = 'type = "organization" && subtype = "center"';
    emptyText = 'Aún no hay centros creados.';
  } else if (routeName === 'Teams') {
    filter = 'type = "organization" && subtype = "team"';
    emptyText = 'Aún no hay equipos creados.';
  } else if (routeName === 'Students') {
    filter = 'type != "organization"';
    emptyText = 'Aún no hay personas registradas.';
  }

  const fetchProfiles = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      const res = await pb.collection('users').getList(1, 100, {
        filter: filter,
        sort: 'name',
      });
      setProfiles(res.items);
    } catch (err) {
      console.error(`Error fetching ${routeName} list:`, err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await Promise.all([
        fetchProfiles(true),
        new Promise(resolve => setTimeout(resolve, 900))
      ]);
      setLoading(false);
    });
    return () => sub.remove();
  }, [routeName]);

  useFocusEffect(
    useCallback(() => {
      fetchProfiles(!isFirstLoad.current);
      isFirstLoad.current = false;
    }, [routeName])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchProfiles(true),
      new Promise(resolve => setTimeout(resolve, 900))
    ]);
    setRefreshing(false);
  };

  const filteredProfiles = profiles.filter(p => 
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {refreshing && (
        <View style={styles.refreshIndicatorContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      {/* Buscador Local de la Categoría */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar..."
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
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
        ) : (
          filteredProfiles.length === 0 ? (
            <Text style={styles.emptyText}>
              {searchQuery.trim().length > 0 ? 'No se encontraron resultados.' : emptyText}
            </Text>
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
                  <Text style={styles.itemName}>
                    {profile.name || 'Usuario'}
                  </Text>
                  {!!profile.username && (
                    <Text style={styles.itemUsername}>
                      @{profile.username}
                    </Text>
                  )}
                </View>
                <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))
          )
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
  refreshIndicatorContainer: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 40,
  },
  emptyText: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
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
  itemUsername: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 2,
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
});
