import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { theme } from '../../theme/theme';
import { Feather } from '@expo/vector-icons';
import { marketplaceService, SellerProfileRecord } from '../../services/marketplaceService';
import Toast from 'react-native-toast-message';

interface Props {
  visible: boolean;
  sellerProfile?: SellerProfileRecord | null;
  onSuccess: (updated: SellerProfileRecord) => void;
  onClose: () => void;
}

export const SellerProfileEditorModal: React.FC<Props> = ({
  visible,
  sellerProfile,
  onSuccess,
  onClose,
}) => {
  const [bio, setBio] = useState('');
  const [wallAnnouncement, setWallAnnouncement] = useState('');
  const [wspPhone, setWspPhone] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [contactNotes, setContactNotes] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setBio(sellerProfile?.bio || '');
      setWallAnnouncement(sellerProfile?.wall_announcement || '');
      setWspPhone(sellerProfile?.wsp_phone || '');
      setInstagramHandle(sellerProfile?.instagram_handle || '');
      setContactNotes(sellerProfile?.contact_notes || '');
    }
  }, [visible, sellerProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await marketplaceService.upsertSellerProfile({
        bio: bio.trim(),
        wall_announcement: wallAnnouncement.trim(),
        wsp_phone: wspPhone.trim(),
        instagram_handle: instagramHandle.trim(),
        contact_notes: contactNotes.trim(),
      });

      Toast.show({
        type: 'success',
        text1: sellerProfile ? 'Perfil de Vendedor Actualizado' : '¡Perfil de Vendedor Creado!',
        text2: 'Tus datos de vendedor y muro de tienda han sido guardados.',
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Error saving seller profile:', err);
      Toast.show({
        type: 'error',
        text1: 'Error al guardar',
        text2: err.message || 'No se pudieron guardar los datos.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {sellerProfile ? 'Editar Perfil de Vendedor' : 'Activar Perfil de Vendedor'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Bio / Presentación de la Tienda */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Presentación / Bio de la Tienda</Text>
                <TextInput
                  style={[styles.input, { height: 70 }]}
                  multiline
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Ej: Venta de alfajores caseros, tortas por encargo y libros de Beauchef..."
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              {/* Muro del Vendedor (Aviso del día) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Aviso / Posteo en tu Muro de Tienda</Text>
                <Text style={styles.helpText}>Publica avisos o actualizaciones para quienes visiten tu tienda</Text>
                <TextInput
                  style={[styles.input, { height: 70 }]}
                  multiline
                  value={wallAnnouncement}
                  onChangeText={setWallAnnouncement}
                  placeholder="Ej: ¡Hoy estaré en el Patio Central vendiendo brownie vegano de 12:30 a 15:00!"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              {/* Teléfono WhatsApp */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>WhatsApp de Contacto (opcional)</Text>
                <Text style={styles.helpText}>Formato con código de país o 9 dígitos (ej: +56912345678 o 912345678)</Text>
                <TextInput
                  style={styles.input}
                  value={wspPhone}
                  onChangeText={setWspPhone}
                  placeholder="+56912345678"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Usuario Instagram */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Usuario Instagram (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={instagramHandle}
                  onChangeText={setInstagramHandle}
                  placeholder="@tu_tienda_beauchef"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="none"
                />
              </View>

              {/* Notas de Entrega / Ubicación */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notas de Entrega / Ubicación habitual (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={contactNotes}
                  onChangeText={setContactNotes}
                  placeholder="Ej: Entregas presenciales en Patio Central / Sala de Alumnos DFI"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              {/* Botón Guardar */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.disabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {sellerProfile ? 'Guardar Cambios' : 'Activar Perfil de Vendedor'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  keyboardView: {
    width: '100%',
  },
  content: {
    backgroundColor: '#0c0c0c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#222222',
    maxHeight: '85%',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  formScroll: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  helpText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.5,
  },
});
