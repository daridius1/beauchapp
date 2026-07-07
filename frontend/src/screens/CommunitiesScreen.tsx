import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'Communities'>;

export const CommunitiesScreen: React.FC<Props> = ({ navigation }) => {
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFirstLoad = useRef(true);

  const fetchCommunities = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      
      const records = await pb.collection('users').getFullList({
        filter: 'type = "organization" && subtype = "community"',
        sort: '+name',
      });
      setCommunities(records);
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFirstLoad.current = false;
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isFirstLoad.current) {
        fetchCommunities();
      }
    }, [])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', () => {
      fetchCommunities(true);
    });
    return () => sub.remove();
  }, []);

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
          communities.length === 0 ? (
            <Text style={styles.emptyText}>Aún no hay comunidades creadas.</Text>
          ) : (
            communities.map((community) => (
              <TouchableOpacity 
                key={community.id} 
                style={styles.itemContainer}
                onPress={() => navigation.push('UserProfile', { userId: community.id, title: community.name })}
              >
                <View style={{ marginRight: theme.spacing.md }}>
                  <Avatar user={community} size={40} />
                </View>
                <Text style={styles.itemName}>
                  {community.name || community.username}
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
  pageSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
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
