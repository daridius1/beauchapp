import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'CommunityDetail'>;

export const CommunityDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { communityId } = route.params;
  const { user } = useAuth();
  
  const [community, setCommunity] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [userMembership, setUserMembership] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCommunityData = async () => {
    try {
      const commRecord = await pb.collection('communities').getOne(communityId);
      setCommunity(commRecord);

      const membersRecords = await pb.collection('community_members').getFullList({
        filter: `community = "${communityId}" && status = "active"`,
        expand: 'user',
      });
      setMembers(membersRecords);

      if (user) {
        try {
          const userMem = await pb.collection('community_members').getFirstListItem(
            `community = "${communityId}" && user = "${user.id}"`
          );
          setUserMembership(userMem);
        } catch (err: any) {
          if (err.status !== 404) {
            console.error('Error fetching user membership:', err);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching community details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunityData();
  }, [communityId, user]);

  const handleJoinOrLeave = async () => {
    if (!user) return;
    setActionLoading(true);

    try {
      if (userMembership) {
        const newStatus = userMembership.status === 'active' ? 'inactive' : 'active';
        await pb.collection('community_members').update(userMembership.id, {
          status: newStatus
        });
      } else {
        await pb.collection('community_members').create({
          user: user.id,
          community: communityId,
          status: 'active'
        });
      }
      
      await fetchCommunityData();
    } catch (error) {
      console.error('Error updating membership:', error);
      Alert.alert("Error", "No se pudo actualizar tu estado en la comunidad.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>No se encontró la comunidad.</Text>
      </View>
    );
  }

  const isCurrentlyActive = userMembership?.status === 'active';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!!community.description && (
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionTitle}>Acerca de la comunidad</Text>
            <Text style={styles.communityDesc}>{community.description}</Text>
          </View>
        )}
        
        {user && (
          <TouchableOpacity 
            style={[styles.actionButton, isCurrentlyActive ? styles.actionButtonLeave : styles.actionButtonJoin]}
            onPress={handleJoinOrLeave}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name={isCurrentlyActive ? "log-out" : "user-plus"} size={18} color="#fff" />
                <Text style={styles.actionButtonText}>
                  {isCurrentlyActive ? 'Salir de la comunidad' : 'Unirse a la comunidad'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.membersSection}>
          <Text style={styles.sectionTitle}>
            <Feather name="users" size={16} color={theme.colors.text} /> Miembros Activos ({members.length})
          </Text>
          {members.length > 0 ? (
            <View style={styles.membersList}>
              {members.map((memRecord: any) => {
                const member = memRecord.expand?.user;
                if (!member) return null;
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <View style={styles.avatarMini}>
                      <Text style={styles.avatarMiniText}>
                        {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>
                    <Text style={styles.memberName}>{member.name || member.username}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.noMembersText}>Aún no hay miembros activos en esta comunidad.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  descriptionCard: {
    backgroundColor: theme.colors.cardBg,
    padding: theme.spacing.lg,
    borderRadius: 12,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  communityDesc: {
    fontSize: 15,
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: theme.spacing.xl,
    gap: 8,
  },
  actionButtonJoin: {
    backgroundColor: theme.colors.primary,
  },
  actionButtonLeave: {
    backgroundColor: theme.colors.error,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  membersSection: {
    marginTop: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  membersList: {
    gap: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarMiniText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberName: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  noMembersText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 16,
  }
});
