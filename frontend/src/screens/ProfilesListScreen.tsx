import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, DeviceEventEmitter } from 'react-native';
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
    filter = 'type = "student"';
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

  return (
    <View style={styles.container}>
      {refreshing && (
        <View style={styles.refreshIndicatorContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
        ) : (
          profiles.length === 0 ? (
            <Text style={styles.emptyText}>{emptyText}</Text>
          ) : (
            profiles.map((profile) => (
              <TouchableOpacity 
                key={profile.id} 
                style={styles.itemContainer}
                onPress={() => navigation.push('UserProfile', { userId: profile.id, title: profile.name })}
              >
                <View style={{ marginRight: theme.spacing.md }}>
                  <Avatar user={profile} size={40} />
                </View>
                <Text style={styles.itemName}>
                  {profile.name || profile.username}
                </Text>
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
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
