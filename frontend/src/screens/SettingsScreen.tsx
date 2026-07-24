import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Platform, ScrollView, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Avatar } from '../components/Avatar';
import { Feather } from '@expo/vector-icons';
import { compressImage } from '../utils/imageCompressor';
import Toast from 'react-native-toast-message';

import { organizationService, OrganizationMemberRecord } from '../services/organizationService';
import { OrgChip } from '../components/OrgChip';
import { User } from '../context/AuthContext';

export const SettingsScreen: React.FC = () => {
  const { user, developerMode, setDeveloperMode } = useAuth();
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  // Configuración de Chip para Organizaciones
  const [chipText, setChipText] = useState(user?.chip_text || '');
  const [chipColor, setChipColor] = useState(user?.chip_color || '#38bdf8');

  // Gestión de Integrantes para Organizaciones
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  const [members, setMembers] = useState<OrganizationMemberRecord[]>([]);
  const [editingRoles, setEditingRoles] = useState<{ [membershipId: string]: string }>({});
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<User[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.type === 'organization') {
      loadMembers();
    }
  }, [user?.id]);

  const loadMembers = async () => {
    if (!user || user.type !== 'organization') return;
    setLoadingMembers(true);
    try {
      const data = await organizationService.getOrganizationMembers(user.id);
      setMembers(data);
    } catch (err) {
      console.error('Error cargando integrantes:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  if (!user) return null;

  // Formatear el tipo de perfil de forma amigable
  const getAccountTypeLabel = () => {
    if (user.type === 'organization') {
      if (user.subtype === 'center') return 'Centro de Estudiantes';
      if (user.subtype === 'community') return 'Comunidad';
      if (user.subtype === 'team') return 'Equipo';
      return 'Organización';
    }
    return 'Usuario Estudiante';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Toast.show({
        type: 'error',
        text1: 'Archivo inválido',
        text2: 'Solo se permiten archivos de imagen.',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Comprimir la imagen usando la utilidad existente
      const compressedBlob = await compressImage(file, true, 'image/jpeg');
      const compressedFile = new File(
        [compressedBlob], 
        file.name.replace(/\.[^/.]+$/, "") + ".jpg", 
        { type: 'image/jpeg' }
      );
      
      // Crear preview local
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(URL.createObjectURL(compressedFile));
      setAvatarFile(compressedFile);
    } catch (err) {
      console.error('Error procesando la imagen:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No se pudo procesar la imagen seleccionada.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Campo requerido',
        text2: 'El nombre no puede estar vacío.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      
      if (user.type === 'organization') {
        formData.append('chip_text', chipText.trim());
        formData.append('chip_color', chipColor.trim());
      }

      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      await pb.collection('users').update(user.id, formData);
      await pb.collection('users').authRefresh();

      Toast.show({
        type: 'success',
        text1: 'Perfil actualizado',
        text2: 'Tus cambios han sido guardados exitosamente.',
      });
      
      setIsEditingProfile(false);
      setAvatarFile(null);
    } catch (err: any) {
      console.error('Error al guardar el perfil:', err);
      Toast.show({
        type: 'error',
        text1: 'Error al guardar',
        text2: err.message || 'No se pudieron guardar los cambios.',
      });
    } finally {
      setIsSaving(false);
    }
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

  const handleAddMember = async (student: User, role: string = '') => {
    try {
      await organizationService.addMember(user.id, student.id, role);
      Toast.show({
        type: 'success',
        text1: 'Integrante agregado',
        text2: `${student.name} ahora es parte de tu organización.`,
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

  const handleCancel = () => {
    setName(user.name || '');
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarFile(null);
    setIsEditingProfile(false);
  };

  const triggerFileSelect = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Tarjeta de Cuenta */}
      <View style={styles.accountCard}>
        <View style={styles.avatarWrapper}>
          {avatarPreview ? (
            <Image source={{ uri: avatarPreview }} style={{ width: 70, height: 70, borderRadius: 35 }} />
          ) : (
            <Avatar user={user} size={70} />
          )}
        </View>

        <View style={styles.accountInfo}>
          <Text style={styles.accountName}>{user.name}</Text>
          <Text style={styles.accountUsername}>@{user.username}</Text>
          <Text style={styles.accountEmail}>{user.email}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{getAccountTypeLabel()}</Text>
          </View>
        </View>
      </View>

      {/* Sección Editar Perfil */}
      <Text style={styles.sectionTitle}>Perfil</Text>
      
      <View style={styles.optionCard}>
        <TouchableOpacity 
          style={styles.optionHeader} 
          onPress={() => setIsEditingProfile(!isEditingProfile)}
          activeOpacity={0.7}
        >
          <View style={styles.optionTitleRow}>
            <Feather name="user" size={20} color={theme.colors.primary} style={styles.optionIcon} />
            <View>
              <Text style={styles.optionTitle}>Editar Datos Básicos</Text>
              <Text style={styles.optionSubtitle}>Cambia tu nombre público y foto de perfil</Text>
            </View>
          </View>
          <Feather 
            name={isEditingProfile ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={theme.colors.textMuted} 
          />
        </TouchableOpacity>

        {isEditingProfile && (
          <View style={styles.editForm}>
            {/* Picker de Avatar */}
            <View style={styles.avatarPickerContainer}>
              <TouchableOpacity 
                style={styles.avatarPickerTouch} 
                onPress={triggerFileSelect}
                disabled={isSaving}
              >
                <View style={styles.avatarContainer}>
                  {avatarPreview ? (
                    <Image source={{ uri: avatarPreview }} style={{ width: 100, height: 100, borderRadius: 50 }} />
                  ) : (
                    <Avatar user={user} size={100} />
                  )}
                  <View style={styles.cameraOverlay}>
                    <Feather name="camera" size={16} color="#000000" />
                  </View>
                </View>
              </TouchableOpacity>
              
              {Platform.OS === 'web' && (
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              )}
              <Text style={styles.avatarPickerHelp}>Presiona el círculo para cambiar tu foto</Text>
            </View>

            {/* Inputs */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombre público</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ingresa tu nombre..."
                placeholderTextColor={theme.colors.textMuted}
                maxLength={40}
                editable={!isSaving}
              />
            </View>

            {/* Configuración de Chip / Badge personalizada para organizaciones */}
            {user.type === 'organization' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Texto de la Insignia (Chip)</Text>
                  <TextInput
                    style={styles.input}
                    value={chipText}
                    onChangeText={setChipText}
                    placeholder={`Por defecto: ${name || user.username}`}
                    placeholderTextColor={theme.colors.textMuted}
                    maxLength={25}
                    editable={!isSaving}
                  />
                  <Text style={styles.avatarPickerHelp}>Texto corto que aparecerá en los perfiles de tus integrantes</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Color de la Insignia</Text>
                  <View style={styles.colorPaletteRow}>
                    {['#38bdf8', '#ff4444', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#ffffff'].map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: color },
                          chipColor === color && styles.colorCircleSelected,
                        ]}
                        onPress={() => setChipColor(color)}
                      />
                    ))}
                  </View>
                </View>

                {/* Previsualización del Chip */}
                <View style={styles.chipPreviewContainer}>
                  <Text style={styles.inputLabel}>Vista Previa:</Text>
                  <OrgChip
                    organization={{
                      ...user,
                      chip_text: chipText,
                      chip_color: chipColor,
                    }}
                  />
                </View>
              </>
            )}

            {/* Acciones */}
            <View style={styles.actionsRow}>
              <TouchableOpacity 
                style={[styles.btn, styles.btnCancel]} 
                onPress={handleCancel}
                disabled={isSaving}
              >
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.btn, styles.btnSave]} 
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.btnSaveText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

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
              {/* Buscador de Estudiantes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Agregar Integrante (Estudiante)</Text>
                <TextInput
                  style={styles.input}
                  value={searchStudentQuery}
                  onChangeText={handleSearchStudents}
                  placeholder="Buscar estudiante por nombre o @username..."
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              {searchingStudents && (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 8 }} />
              )}

              {/* Resultados de Búsqueda */}
              {studentSearchResults.length > 0 && (
                <View style={styles.searchResultsList}>
                  {studentSearchResults.map((student) => (
                    <View key={student.id} style={styles.memberRow}>
                      <Avatar user={student} size={34} />
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{student.name}</Text>
                        <Text style={styles.memberSub}>@{student.username}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.addMemberBtn}
                        onPress={() => handleAddMember(student)}
                      >
                        <Feather name="user-plus" size={14} color="#000000" />
                        <Text style={styles.addMemberBtnText}>Agregar</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

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

                      {/* Asignación / Edición de Rol */}
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
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>
      )}

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
              <Text style={styles.optionSubtitle}>Muestra el ID único de las publicaciones en el feed</Text>
            </View>
          </View>
          <Feather 
            name={developerMode ? "check-square" : "square"} 
            size={22} 
            color={developerMode ? theme.colors.primary : theme.colors.textMuted} 
          />
        </TouchableOpacity>
      </View>
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
    backgroundColor: theme.colors.cardBg,
    borderRadius: 16,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  badgeText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
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
    backgroundColor: theme.colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
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
  editForm: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  avatarPickerContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  avatarPickerTouch: {
    position: 'relative',
    borderRadius: 50,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.cardBg,
    elevation: 2,
  },
  avatarPickerHelp: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  btnCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  btnCancelText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  btnSave: {
    backgroundColor: theme.colors.primary,
  },
  btnSaveText: {
    color: '#000000',
    fontWeight: '700',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
    transform: [{ scale: 1.15 }],
  },
  chipPreviewContainer: {
    marginBottom: theme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: theme.spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
});
