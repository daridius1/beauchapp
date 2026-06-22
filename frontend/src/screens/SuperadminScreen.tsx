import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { pb } from '../services/pocketbase';
import { theme } from './HomeScreen';
import { RootStackParamList } from '../types/navigation';

interface Contest {
  id: string;
  name: string;
  description: string;
  admins: string[];
}

interface User {
  id: string;
  name: string;
  email: string;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Superadmin'>;

export const SuperadminScreen: React.FC<Props> = ({ navigation }) => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [contestAdmins, setContestAdmins] = useState<User[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingAdmins, setLoadingAdmins] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchContests = async () => {
    try {
      setLoading(true);
      setError(null);
      const records = await pb.collection('contests').getFullList<Contest>({
        sort: '-created',
      });
      setContests(records);
      
      // Si ya había un concurso seleccionado, actualizarlo en el estado local
      if (selectedContest) {
        const updated = records.find(c => c.id === selectedContest.id);
        if (updated) {
          setSelectedContest(updated);
        }
      }
    } catch (err: any) {
      console.error('Error al cargar concursos en superadmin:', err);
      setError('Error al obtener la lista de concursos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContests();
  }, []);

  const fetchAdminsDetails = async (adminIds: string[]) => {
    if (!adminIds || adminIds.length === 0) {
      setContestAdmins([]);
      return;
    }
    
    setLoadingAdmins(true);
    try {
      const details = await Promise.all(
        adminIds.map(id => 
          pb.collection('users').getOne<User>(id).catch(() => null)
        )
      );
      setContestAdmins(details.filter((u): u is User => u !== null));
    } catch (err) {
      console.error('Error al cargar detalles de administradores:', err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    if (selectedContest) {
      fetchAdminsDetails(selectedContest.admins || []);
    } else {
      setContestAdmins([]);
    }
  }, [selectedContest]);

  const handleAddAdmin = async () => {
    if (!selectedContest || !newAdminEmail.trim()) return;
    
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const email = newAdminEmail.trim().toLowerCase();
      
      // Buscar usuario en PocketBase por email
      let targetUser: User;
      try {
        targetUser = await pb.collection('users').getFirstListItem<User>(`email = "${email}"`);
      } catch (err) {
        setError(`No se encontró ningún usuario con el correo "${email}". El alumno debe estar registrado primero.`);
        setActionLoading(false);
        return;
      }

      const currentAdmins = selectedContest.admins || [];
      if (currentAdmins.includes(targetUser.id)) {
        setError(`El usuario ya es administrador de este concurso.`);
        setActionLoading(false);
        return;
      }

      const updatedAdmins = [...currentAdmins, targetUser.id];

      // Actualizar concurso en PocketBase
      const updatedContest = await pb.collection('contests').update<Contest>(selectedContest.id, {
        admins: updatedAdmins,
      });

      setSelectedContest(updatedContest);
      setNewAdminEmail('');
      setSuccess('Administrador agregado con éxito.');
      
      // Recargar lista global de concursos
      fetchContests();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error al agregar administrador:', err);
      setError('Ocurrió un error al intentar agregar el administrador.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (!selectedContest) return;
    
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const currentAdmins = selectedContest.admins || [];
      const updatedAdmins = currentAdmins.filter(id => id !== userId);

      // Actualizar concurso en PocketBase
      const updatedContest = await pb.collection('contests').update<Contest>(selectedContest.id, {
        admins: updatedAdmins,
      });

      setSelectedContest(updatedContest);
      setSuccess('Administrador removido con éxito.');
      
      // Recargar lista global de concursos
      fetchContests();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error al remover administrador:', err);
      setError('Ocurrió un error al intentar remover el administrador.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && contests.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Cargando panel de administración...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Panel Superadmin Global</Text>
        <Text style={styles.subtitle}>Gestiona los concursos de la plataforma y asigna administradores locales.</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {success && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Selecciona un Concurso</Text>
      
      <View style={styles.contestsList}>
        {contests.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[
              styles.contestItem,
              selectedContest?.id === c.id && styles.contestItemActive
            ]}
            onPress={() => setSelectedContest(c)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.contestName,
              selectedContest?.id === c.id && styles.contestTextActive
            ]}>
              {c.name}
            </Text>
            <Text style={styles.contestAdminsCount}>
              {c.admins ? c.admins.length : 0} administradores
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedContest && (
        <View style={styles.manageSection}>
          <View style={styles.separator} />
          
          <Text style={styles.manageTitle}>Gestionar: {selectedContest.name}</Text>
          <Text style={styles.manageSubtitle}>Administradores que pueden registrar resultados reales y marcadores.</Text>

          {/* Formulario Agregar Admin */}
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              placeholder="Correo del alumno (@ug.uchile.cl)"
              placeholderTextColor={theme.colors.textMuted}
              value={newAdminEmail}
              onChangeText={setNewAdminEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!actionLoading}
            />
            <TouchableOpacity
              style={[styles.addBtn, actionLoading && styles.disabledBtn]}
              onPress={handleAddAdmin}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.addBtnText}>Agregar Admin</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Lista de Administradores */}
          <Text style={styles.subSectionTitle}>Administradores Actuales</Text>
          
          {loadingAdmins ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 10 }} />
          ) : contestAdmins.length === 0 ? (
            <Text style={styles.noAdminsText}>No hay administradores asignados a este concurso.</Text>
          ) : (
            <View style={styles.adminsList}>
              {contestAdmins.map(admin => (
                <View key={admin.id} style={styles.adminRow}>
                  <View style={styles.adminInfo}>
                    <Text style={styles.adminName}>{admin.name || 'Sin Nombre'}</Text>
                    <Text style={styles.adminEmail}>{admin.email}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.removeBtn, actionLoading && styles.disabledBtn]}
                    onPress={() => handleRemoveAdmin(admin.id)}
                    disabled={actionLoading}
                  >
                    <Text style={styles.removeBtnText}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg * 3,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  headerRow: {
    marginVertical: theme.spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  errorBanner: {
    padding: theme.spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
  },
  successBanner: {
    padding: theme.spacing.md,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  successText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  contestsList: {
    marginBottom: theme.spacing.md,
  },
  contestItem: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  contestItemActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(79, 70, 229, 0.05)',
  },
  contestName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  contestTextActive: {
    color: theme.colors.accent,
  },
  contestAdminsCount: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  manageSection: {
    marginTop: theme.spacing.xs,
  },
  manageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  manageSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  addForm: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
  },
  input: {
    flex: 1,
    height: 42,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 14,
    marginRight: theme.spacing.sm,
  },
  addBtn: {
    height: 42,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  noAdminsText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 10,
  },
  adminsList: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  adminInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  adminName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  removeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: theme.borderRadius.md,
  },
  removeBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
});
