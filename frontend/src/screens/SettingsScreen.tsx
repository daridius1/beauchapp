import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Avatar } from '../components/Avatar';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { organizationService, OrganizationMemberRecord } from '../services/organizationService';
import { accountService } from '../services/accountService';
import { User } from '../context/AuthContext';
import { UserSelectorModal } from '../components/UserSelectorModal';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { user, developerMode, setDeveloperMode, logout } = useAuth();

  // Eliminar cuenta
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Gestión de Integrantes para Organizaciones
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  const [members, setMembers] = useState<OrganizationMemberRecord[]>([]);
  const [editingRoles, setEditingRoles] = useState<{ [membershipId: string]: string }>({});
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<User[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [showUserSelectorModal, setShowUserSelectorModal] = useState(false);

  useEffect(() => {
    if (user?.type === 'organization') {
      loadMembers();
    }
  }, [user?.id]);

  const loadMembers = async () => {
    if (!user || user.type !== 'organization') return;
    setLoadingMembers(true);
    try {
      const data = await organizationService.getOrganizationMembersForManagement(user.id);
      setMembers(data);
    } catch (err) {
      console.error('Error cargando integrantes:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;
    setDeletingAccount(true);
    try {
      await accountService.deleteAccount(deletePassword);
      setShowDeleteModal(false);
      setDeletePassword('');
      Toast.show({
        type: 'success',
        text1: 'Cuenta eliminada',
        text2: 'Tu cuenta y tus datos personales fueron eliminados.',
      });
      logout();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'No se pudo eliminar la cuenta',
        text2: err?.data?.error || err?.message || 'Intenta de nuevo.',
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  if (!user) return null;

  // Formatear el tipo de perfil de forma amigable
  const getAccountTypeLabel = () => {
    if (user.type === 'organization') {
      if (user.subtype === 'center') return 'Centro de Estudiantes';
      if (user.subtype === 'community') return 'Comunidad';
      if (user.subtype === 'team') return 'Equipo';
      if (user.subtype === 'band') return 'Banda / Grupo Musical';
      if (user.subtype === 'organization') return 'Organización';
      if (user.subtype === 'league') return 'Liga';
      return 'Organización';
    }
    return 'Estudiante';
  };

  const handleSearchStudents = async (text: string) => {
    setSearchStudentQuery(text);
    if (!text.trim()) {
      setStudentSearchResults([]);
      return;
    }
    setSearchingStudents(true);
    try {
      const results = await organizationService.searchStudents(text);
      const existingUserIds = new Set(members.map((m) => m.user));
      setStudentSearchResults(results.filter((s) => !existingUserIds.has(s.id)));
    } catch (err) {
      console.error('Error buscando estudiantes:', err);
    } finally {
      setSearchingStudents(false);
    }
  };

  const handleAddMember = async (student: { id: string; name: string }, role: string = '') => {
    try {
      await organizationService.addMember(user.id, student.id, role);
      Toast.show({
        type: 'success',
        text1: 'Invitación enviada',
        text2: `${student.name} tiene que aceptarla para quedar como integrante.`,
      });
      setSearchStudentQuery('');
      setStudentSearchResults([]);
      loadMembers();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error al agregar',
        text2: err.message || 'No se pudo agregar al integrante.',
      });
    }
  };

  const handleUpdateRole = async (membershipId: string, role: string) => {
    try {
      await organizationService.updateMemberRole(membershipId, role);
      Toast.show({
        type: 'success',
        text1: 'Rol actualizado',
        text2: 'Se ha asignado el nuevo rol.',
      });
      loadMembers();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'No se pudo actualizar el rol.',
      });
    }
  };

  const handleRemoveMember = async (membershipId: string, studentName: string) => {
    try {
      await organizationService.removeMember(membershipId);
      Toast.show({
        type: 'info',
        text1: 'Integrante removido',
        text2: `${studentName} ha sido removido de la organización.`,
      });
      loadMembers();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'No se pudo remover al integrante.',
      });
    }
  };


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Tarjeta de Cuenta */}
      <View style={styles.accountCard}>
        <View style={styles.avatarWrapper}>
          <Avatar user={user} size={70} />
        </View>

        <View style={styles.accountInfo}>
          <Text style={styles.accountName}>{user.name}</Text>
          <Text style={styles.accountUsername}>@{user.username}</Text>
          <Text style={styles.accountEmail}>{user.email}</Text>
          <Text style={styles.badgeText}>{getAccountTypeLabel()}</Text>
        </View>
      </View>

      {/* Sección Editar Perfil */}
      <Text style={styles.sectionTitle}>Perfil</Text>
      
      <View style={styles.optionCard}>
        <TouchableOpacity
          style={styles.optionHeader}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.7}
        >
          <View style={styles.optionTitleRow}>
            <Feather name="user" size={20} color={theme.colors.primary} style={styles.optionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Editar Datos</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Sección Editar Equipo (solo cuentas de organización subtype=team) */}
      {user.type === 'organization' && user.subtype === 'team' && (
        <View style={[styles.optionCard, { marginTop: theme.spacing.md }]}>
          <TouchableOpacity
            style={styles.optionHeader}
            onPress={() => navigation.navigate('EditTeam')}
            activeOpacity={0.7}
          >
            <View style={styles.optionTitleRow}>
              <Feather name="shield" size={20} color={theme.colors.primary} style={styles.optionIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Editar Equipo</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Sección Gestión de Integrantes (Solo para Organizaciones) */}
      {user.type === 'organization' && (
        <View style={[styles.optionCard, { marginTop: theme.spacing.md }]}>
          <TouchableOpacity 
            style={styles.optionHeader} 
            onPress={() => setIsManagingMembers(!isManagingMembers)}
            activeOpacity={0.7}
          >
            <View style={styles.optionTitleRow}>
              <Feather name="users" size={20} color={theme.colors.primary} style={styles.optionIcon} />
              <View>
                <Text style={styles.optionTitle}>Integrantes de la Organización</Text>
                <Text style={styles.optionSubtitle}>{members.length} miembros activos</Text>
              </View>
            </View>
            <Feather 
              name={isManagingMembers ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={theme.colors.textMuted} 
            />
          </TouchableOpacity>

          {isManagingMembers && (
            <View style={styles.membersForm}>
              {/* Buscador de Estudiantes con Modal */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Agregar Integrante (Estudiante)</Text>
                <TouchableOpacity
                  onPress={() => setShowUserSelectorModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={{ pointerEvents: 'none' }}>
                    <TextInput
                      style={styles.input}
                      placeholder="Buscar estudiante para agregar..."
                      placeholderTextColor={theme.colors.textMuted}
                      editable={false}
                    />
                  </View>
                </TouchableOpacity>
              </View>

              <UserSelectorModal
                visible={showUserSelectorModal}
                title="Agregar Integrante"
                placeholder="Buscar estudiante por nombre o @username..."
                excludeUserIds={members.map((m) => m.user || m.expand?.user?.id).filter(Boolean) as string[]}
                onSelect={(student) => handleAddMember(student)}
                onClose={() => setShowUserSelectorModal(false)}
              />

              {/* Lista de Integrantes Actuales */}
              <Text style={[styles.inputLabel, { marginTop: theme.spacing.md }]}>
                Integrantes Actuales ({members.length})
              </Text>
              
              {loadingMembers ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
              ) : members.length === 0 ? (
                <Text style={styles.noMembersText}>Aún no has agregado integrantes a tu organización.</Text>
              ) : (
                members.map((m) => {
                  const student = m.expand?.user;
                  if (!student) return null;
                  const isPending = m.status === 'pending';
                  const currentRoleInput = editingRoles[m.id] !== undefined ? editingRoles[m.id] : (m.role || '');

                  return (
                    <View key={m.id} style={styles.memberCardContainer}>
                      <View style={styles.memberRow}>
                        <Avatar user={student} size={36} />
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{student.name}</Text>
                          <Text style={styles.memberSub}>@{student.username}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeMemberBtn}
                          onPress={() => handleRemoveMember(m.id, student.name)}
                        >
                          <Feather name="trash-2" size={14} color="#ff4444" />
                        </TouchableOpacity>
                      </View>

                      {/* Mientras no acepte la invitación, no tiene sentido dejar editarle
                          el rol todavía — se muestra el estado en su lugar. */}
                      {isPending ? (
                        <Text style={styles.pendingInviteText}>Invitación pendiente</Text>
                      ) : (
                        <View style={styles.memberRoleRow}>
                          <TextInput
                            style={styles.roleInput}
                            value={currentRoleInput}
                            onChangeText={(text) => setEditingRoles((prev) => ({ ...prev, [m.id]: text }))}
                            placeholder="Rol / Cargo (ej. Presidente, Capitán, Delegado)..."
                            placeholderTextColor={theme.colors.textMuted}
                          />
                          {editingRoles[m.id] !== undefined && editingRoles[m.id] !== (m.role || '') && (
                            <TouchableOpacity
                              style={styles.saveRoleBtn}
                              onPress={() => handleUpdateRole(m.id, editingRoles[m.id])}
                            >
                              <Text style={styles.saveRoleBtnText}>Guardar</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>
      )}

      {/* Sección Usuarios Bloqueados */}
      <View style={[styles.optionCard, { marginTop: theme.spacing.md }]}>
        <TouchableOpacity
          style={styles.optionHeader}
          onPress={() => navigation.navigate('BlockedUsers')}
          activeOpacity={0.7}
        >
          <View style={styles.optionTitleRow}>
            <Feather name="slash" size={20} color={theme.colors.error} style={styles.optionIcon} />
            <View>
              <Text style={styles.optionTitle}>Usuarios Bloqueados</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Sección Ayuda */}
      <Text style={[styles.sectionTitle, { marginTop: theme.spacing.xl }]}>Ayuda</Text>

      <View style={styles.optionCard}>
        <TouchableOpacity
          style={styles.optionHeader}
          onPress={() => navigation.navigate('Info')}
          activeOpacity={0.7}
        >
          <View style={styles.optionTitleRow}>
            <Feather name="info" size={20} color={theme.colors.primary} style={styles.optionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Info y Políticas</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Sección Opciones Avanzadas */}
      <Text style={[styles.sectionTitle, { marginTop: theme.spacing.xl }]}>Opciones Avanzadas</Text>

      <View style={styles.optionCard}>
        <TouchableOpacity 
          style={styles.optionHeader} 
          onPress={() => {
            const nextState = !developerMode;
            setDeveloperMode(nextState);
            Toast.show({
              type: 'info',
              text1: nextState ? 'Modo Desarrollador Activado 🛠️' : 'Modo Desarrollador Desactivado',
              text2: nextState ? 'Los IDs de los posts se mostrarán en la interfaz.' : 'Se han ocultado los identificadores.',
            });
          }}
          activeOpacity={0.7}
        >
          <View style={styles.optionTitleRow}>
            <Feather name="code" size={20} color={theme.colors.primary} style={styles.optionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Modo Desarrollador</Text>
            </View>
          </View>
          <Feather 
            name={developerMode ? "check-square" : "square"} 
            size={22} 
            color={developerMode ? theme.colors.primary : theme.colors.textMuted} 
          />
        </TouchableOpacity>
      </View>

      {/* Zona de Peligro */}
      <Text style={[styles.sectionTitle, { marginTop: theme.spacing.xl }]}>Zona de Peligro</Text>

      <View style={styles.optionCard}>
        <TouchableOpacity
          style={styles.optionHeader}
          onPress={() => setShowDeleteModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.optionTitleRow}>
            <Feather name="trash-2" size={20} color={theme.colors.error} style={styles.optionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: theme.colors.error }]}>Eliminar Cuenta</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>¿Eliminar tu cuenta?</Text>
            <Text style={styles.modalText}>
              Esta acción es permanente. Se borran tu nombre, correo, foto, redes sociales y
              cualquier otro dato que te identifique. El contenido que hayas publicado (posts,
              partidos, apuestas) queda, pero atribuido a "Cuenta eliminada". Si quieres volver a
              registrarte con este correo, tendrás que esperar 7 días.
            </Text>
            <Text style={styles.modalLabel}>Ingresa tu contraseña para confirmar</Text>
            <TextInput
              style={styles.modalInput}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Contraseña"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                }}
                disabled={deletingAccount}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDeleteBtn, (!deletePassword || deletingAccount) && styles.modalDeleteBtnDisabled]}
                onPress={handleDeleteAccount}
                disabled={!deletePassword || deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalDeleteBtnText}>Eliminar cuenta</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  avatarWrapper: {
    marginRight: theme.spacing.md,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  accountUsername: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginBottom: 2,
  },
  accountEmail: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  badgeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.md,
    paddingLeft: theme.spacing.xs,
  },
  optionCard: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    marginRight: theme.spacing.md,
  },
  optionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  optionSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 15,
  },
  membersForm: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  searchResultsList: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    padding: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 10,
  },
  memberName: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  memberSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  addMemberBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
  removeMemberBtn: {
    padding: 8,
  },
  memberCardContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
    padding: 6,
  },
  memberRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  pendingInviteText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  roleInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    color: theme.colors.text,
  },
  saveRoleBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveRoleBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '700',
  },
  noMembersText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    marginVertical: 8,
  },
  chipsSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectableChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 4,
    marginBottom: 6,
  },
  selectableChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  yearSelectableChip: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  yearChipSelected: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  yearChipTextSelected: {
    color: '#000000',
  },
  deptSelectableChip: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
  },
  deptChipSelected: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  deptChipTextSelected: {
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  modalText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: theme.spacing.md,
  },
  modalLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 15,
    marginBottom: theme.spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
  },
  modalDeleteBtnDisabled: {
    opacity: 0.5,
  },
  modalDeleteBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
