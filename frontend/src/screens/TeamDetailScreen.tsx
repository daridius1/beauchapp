import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, DeviceEventEmitter } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { UserSearchAutocomplete } from '../components/UserSearchAutocomplete';

type Props = NativeStackScreenProps<RootStackParamList, 'TeamDetail'>;

export const TeamDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { teamId, teamName } = route.params;
  const { user } = useAuth();
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [addingFromBtn, setAddingFromBtn] = useState(false);

  const isOwner = user?.id === teamId;
  const isAdmin = isOwner;

  const fetchTeamData = useCallback(async () => {
    try {
      const [teamData, membersData] = await Promise.all([
        pb.collection('users').getOne(teamId, { expand: 'owner' }),
        pb.collection('organization_members').getFullList({
          filter: `organization = "${teamId}"`,
          sort: 'created',
          expand: 'user'
        })
      ]);
      setTeam(teamData);
      setMembers(membersData);
    } catch (error) {
      console.error('Error fetching team details:', error);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const handleAddMember = async (queryOrUser: string | any, fromButton = false) => {
    try {
      if (fromButton) {
        setAddingFromBtn(true);
      }
      let finalUser = null;
      
      if (typeof queryOrUser === 'string') {
        if (!queryOrUser.trim()) return;
        const query = queryOrUser.trim().toLowerCase();
        const users = await pb.collection('users').getFullList({
          filter: `username = "${query}"`,
        });
        if (users.length === 0) {
          Alert.alert('Error', 'Usuario no encontrado. Revisa el username exacto.');
          return;
        }
        finalUser = users[0];
      } else {
        finalUser = queryOrUser;
      }

      if (!finalUser) return;

      // Comprobar si ya es miembro
      const existingMember = members.find(m => m.user === finalUser.id);
      if (existingMember) {
        if (existingMember.status === 'active') {
          Alert.alert('Error', 'El usuario ya pertenece a este equipo');
          return;
        } else {
          // Si existía como inactivo, lo reactivamos
          await pb.collection('organization_members').update(existingMember.id, {
            status: 'active'
          });
          fetchTeamData();
          return;
        }
      }

      await pb.collection('organization_members').create({
        organization: teamId,
        user: finalUser.id,
        status: 'active'
      });

      fetchTeamData();
    } catch (error: any) {
      console.error('Error adding member:', error);
      Alert.alert('Error', error.message || 'No se pudo agregar al miembro');
    } finally {
      setAddingFromBtn(false);
    }
  };

  const handleToggleStatus = async (memberId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await pb.collection('organization_members').update(memberId, {
        status: newStatus
      });
      fetchTeamData();
    } catch (error: any) {
      Alert.alert('Error', 'No se pudo cambiar el estado');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!team) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Equipo no encontrado.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{team.name}</Text>
          {!!team.description && <Text style={styles.description}>{team.description}</Text>}
          {team.expand?.owner && (
            <Text style={styles.ownerText}>
              Gestionado por: {team.expand.owner.name || team.expand.owner.username}
            </Text>
          )}
        </View>

        {isAdmin && (
          <View style={[styles.adminSection, { zIndex: 10 }]}>
            <Text style={styles.sectionTitle}>Añadir Integrante</Text>
            <UserSearchAutocomplete
              onSelectUser={(user) => handleAddMember(user, false)}
              onButtonPress={(username) => handleAddMember(username, true)}
              isProcessing={addingFromBtn}
            />
          </View>
        )}

        {
          (() => {
            const activeMembers = members.filter(member => member.status === 'active');
            return (
              <>
                <Text style={styles.sectionTitle}>Integrantes ({activeMembers.length})</Text>
                {activeMembers.length === 0 ? (
                  <Text style={styles.emptyText}>Aún no hay integrantes en este equipo.</Text>
                ) : (
                  activeMembers.map(member => {
                    const isCurrentMember = member.user === user?.id;
                    const canDeactivate = isAdmin || isCurrentMember;

                    return (
                      <View key={member.id} style={styles.memberCard}>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>
                            {member.expand?.user?.name || member.expand?.user?.username}
                          </Text>
                          <Text style={styles.memberUsername}>@{member.expand?.user?.username}</Text>
                        </View>
                        
                        {canDeactivate && (
                          <View style={styles.memberActions}>
                            <TouchableOpacity 
                              style={styles.actionBtn}
                              onPress={() => handleToggleStatus(member.id, member.status)}
                            >
                              <Feather name="x" size={20} color={theme.colors.danger} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            );
          })()
        }
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
  errorText: {
    color: theme.colors.text,
    fontSize: 16,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  ownerText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  adminSection: {
    backgroundColor: theme.colors.cardBg,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: 10,
    color: theme.colors.text,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionName: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  suggestionUsername: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  emptyText: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
  memberCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberCardInactive: {
    opacity: 0.6,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 2,
  },
  memberUsername: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  adminBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  adminBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  inactiveBadge: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.3)',
  },
  inactiveBadgeText: {
    color: theme.colors.danger,
    fontSize: 12,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    padding: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  }
});
