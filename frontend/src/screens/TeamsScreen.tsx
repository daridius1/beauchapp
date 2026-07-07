import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, DeviceEventEmitter, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Teams'>;

export const TeamsScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFirstLoad = useRef(true);
  
  const isOrganization = user?.type === 'organization';
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      setCreating(true);
      await pb.collection('teams').create({
        name: newTeamName.trim(),
        description: newTeamDesc.trim(),
        owner_org: user?.id
      });
      setNewTeamName('');
      setNewTeamDesc('');
      setShowCreateForm(false);
      fetchTeams();
    } catch (error) {
      console.error('Error creating team:', error);
    } finally {
      setCreating(false);
    }
  };

  const fetchTeams = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      
      const records = await pb.collection('teams').getFullList({
        sort: '+name',
        expand: 'owner_org'
      });
      setTeams(records);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFirstLoad.current = false;
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isFirstLoad.current) {
        fetchTeams();
      }
    }, [])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', () => {
      fetchTeams(true);
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
        <Text style={styles.pageSubtitle}>Descubre los equipos oficiales gestionados por organizaciones de la facultad.</Text>

        {isOrganization && (
          <View style={styles.createSection}>
            <TouchableOpacity 
              style={styles.toggleCreateBtn}
              onPress={() => setShowCreateForm(!showCreateForm)}
            >
              <Feather name={showCreateForm ? 'minus' : 'plus'} size={20} color={theme.colors.text} />
              <Text style={styles.toggleCreateText}>
                {showCreateForm ? 'Cancelar' : 'Crear nuevo equipo'}
              </Text>
            </TouchableOpacity>
            
            {showCreateForm && (
              <View style={styles.createForm}>
                <TextInput 
                  style={styles.input}
                  placeholder="Nombre del equipo"
                  placeholderTextColor={theme.colors.textMuted}
                  value={newTeamName}
                  onChangeText={setNewTeamName}
                />
                <TextInput 
                  style={styles.input}
                  placeholder="Descripción (opcional)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={newTeamDesc}
                  onChangeText={setNewTeamDesc}
                />
                <TouchableOpacity 
                  style={[styles.submitBtn, creating && { opacity: 0.7 }]}
                  onPress={handleCreateTeam}
                  disabled={creating}
                >
                  <Text style={styles.submitBtnText}>
                    {creating ? 'Creando...' : 'Crear Equipo'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
        ) : (
          teams.length === 0 ? (
            <Text style={styles.emptyText}>Aún no hay equipos creados.</Text>
          ) : (
            teams.map((team) => (
              <TouchableOpacity 
                key={team.id} 
                style={styles.teamCard}
                onPress={() => navigation.push('TeamDetail', { teamId: team.id, teamName: team.name })}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.teamName}>
                      {team.name}
                    </Text>
                    {!!team.description && (
                      <Text style={styles.teamDesc} numberOfLines={2}>
                        {team.description}
                      </Text>
                    )}
                    {team.expand?.owner_org && (
                      <Text style={styles.teamOwner}>
                        Gestionado por: {team.expand.owner_org.name || team.expand.owner_org.username}
                      </Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={24} color={theme.colors.textMuted} />
                </View>
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
    padding: theme.spacing.lg,
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
  teamCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  teamName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  teamDesc: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  teamOwner: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  createSection: {
    marginBottom: theme.spacing.xl,
  },
  toggleCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toggleCreateText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  createForm: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    padding: 14,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
