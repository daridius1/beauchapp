import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Platform, ScrollView, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Avatar } from '../components/Avatar';
import { Feather } from '@expo/vector-icons';
import { compressImage } from '../utils/imageCompressor';
import Toast from 'react-native-toast-message';

export const SettingsScreen: React.FC = () => {
  const { user, developerMode, setDeveloperMode } = useAuth();
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
});
