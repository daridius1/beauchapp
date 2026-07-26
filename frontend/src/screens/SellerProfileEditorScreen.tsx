import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Feather } from '@expo/vector-icons';
import { marketplaceService, SellerProfileRecord } from '../services/marketplaceService';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerProfileEditor'>;

export const SellerProfileEditorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user: currentUser } = useAuth();
  const sellerProfileId = route.params?.sellerProfileId;

  const [existingProfile, setExistingProfile] = useState<SellerProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [bio, setBio] = useState('');
  const [wallAnnouncement, setWallAnnouncement] = useState('');
  const [wspPhone, setWspPhone] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [contactNotes, setContactNotes] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let profile: SellerProfileRecord | null = null;
        if (sellerProfileId) {
          profile = await marketplaceService.getSellerProfileById(sellerProfileId);
        } else {
          profile = await marketplaceService.getSellerProfile(currentUser.id);
        }

        setExistingProfile(profile);
        if (profile) {
          setBio(profile.bio || '');
          setWallAnnouncement(profile.wall_announcement || '');
          setWspPhone(profile.wsp_phone || '');
          setInstagramHandle(profile.instagram_handle || '');
          setContactNotes(profile.contact_notes || '');
        }
      } catch (err) {
        console.error('Error fetching seller profile for editing:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [sellerProfileId, currentUser]);

  const handleSave = async () => {
    if (!currentUser) {
      Toast.show({
        type: 'error',
        text1: 'Autenticación requerida',
        text2: 'Debes iniciar sesión para guardar tu perfil de vendedor.',
      });
      return;
    }

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
        text1: existingProfile ? 'Perfil de Vendedor Actualizado' : '¡Perfil de Vendedor Activado!',
        text2: 'Tus datos y muro de tienda han sido guardados.',
      });

      // Navegar directamente a la vista del Perfil de Vendedor
      navigation.replace('SellerProfile', { sellerProfileId: updated.id });
    } catch (err: any) {
      console.error('Error saving seller profile:', err);
      Toast.show({
        type: 'error',
        text1: 'Error al guardar',
        text2: err.message || 'No se pudieron guardar los cambios.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Banner de Presentación */}
        <View style={styles.headerCard}>
          <View style={styles.headerTitleRow}>
            <Feather name="shopping-bag" size={22} color={theme.colors.primary} />
            <Text style={styles.headerTitle}>
              {existingProfile ? 'Editar Perfil de Vendedor' : 'Activar Perfil de Vendedor'}
            </Text>
          </View>
          <Text style={styles.headerSub}>
            Configura la información de tu tienda, datos de contacto y publica avisos en tu muro de vendedor.
          </Text>
        </View>

        {/* Formulario */}
        <View style={styles.formCard}>
          {/* Bio / Presentación de la Tienda */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Presentación / Bio de la Tienda</Text>
            <Text style={styles.helpText}>Describe qué productos o servicios ofreces a la comunidad</Text>
            <TextInput
              style={[styles.input, { height: 75 }]}
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
            <Text style={styles.helpText}>
              Escribe novedades o avisos destacados para quienes visiten tu perfil de tienda
            </Text>
            <TextInput
              style={[styles.input, { height: 75 }]}
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
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>
                {existingProfile ? 'Guardar Cambios' : 'Activar y Ver Mi Tienda'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  formCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  helpText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginBottom: 6,
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
    marginTop: 8,
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
