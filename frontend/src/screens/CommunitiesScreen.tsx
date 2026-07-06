import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Communities'>;

export const CommunitiesScreen: React.FC<Props> = ({ navigation }) => {
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFirstLoad = useRef(true);

  const fetchCommunities = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      
      const records = await pb.collection('communities').getFullList({
        sort: '+name',
        expand: 'members',
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
        <Text style={styles.pageTitle}>Comunidades</Text>
        <Text style={styles.pageSubtitle}>Descubre y conéctate con los distintos grupos de la facultad.</Text>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
        ) : (
          communities.length === 0 ? (
            <Text style={styles.emptyText}>Aún no hay comunidades creadas.</Text>
          ) : (
            communities.map((community) => {
              const members = community.expand?.members || [];
              return (
                <View key={community.id} style={styles.communityCard}>
                  <Text style={styles.communityName}>{community.name}</Text>
                  {!!community.description && (
                    <Text style={styles.communityDesc}>{community.description}</Text>
                  )}
                  
                  <View style={styles.membersSection}>
                    <Text style={styles.membersTitle}>
                      <Feather name="users" size={14} color={theme.colors.textMuted} /> Miembros ({members.length})
                    </Text>
                    {members.length > 0 ? (
                      <View style={styles.membersList}>
                        {members.map((member: any) => (
                          <View key={member.id} style={styles.memberChip}>
                            <View style={styles.avatarMini}>
                              <Text style={styles.avatarMiniText}>
                                {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                              </Text>
                            </View>
                            <Text style={styles.memberName}>{member.name}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.noMembersText}>No hay miembros en esta comunidad.</Text>
                    )}
                  </View>
                </View>
              );
            })
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
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
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
  communityCard: {
    backgroundColor: theme.colors.cardBg,
    padding: theme.spacing.lg,
    borderRadius: 12,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  communityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  communityDesc: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  membersSection: {
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  membersTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  avatarMini: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  avatarMiniText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  memberName: {
    color: theme.colors.text,
    fontSize: 13,
  },
  noMembersText: {
    color: '#555',
    fontSize: 13,
    fontStyle: 'italic',
  }
});
