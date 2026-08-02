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
import { SocialInput } from '../components/SocialInput';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerProfileEditor'>;

export const SellerProfileEditorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user: currentUser } = useAuth();
  const sellerProfileId = route.params?.sellerProfileId;

  const [existingProfile, setExistingProfile] = useState<SellerProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [bio, setBio] = useState('');
  const [wspPhone, setWspPhone] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [telegramHandle, setTelegramHandle] = useState('');
  const [signalPhone, setSignalPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

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
          setWspPhone(profile.wsp_phone || '');
          setInstagramHandle(profile.instagram_handle || '');
          setTelegramHandle(profile.telegram_handle || '');
          setSignalPhone(profile.signal_phone || '');
          setContactEmail(profile.contact_email || '');
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
        wsp_phone: wspPhone.trim(),
        instagram_handle: instagramHandle.trim(),
        telegram_handle: telegramHandle.trim(),
        signal_phone: signalPhone.trim(),
        contact_email: contactEmail.trim(),
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


        {/* Formulario */}
        <View style={styles.formCard}>
          {/* Descripción */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Descripción</Text>
            <Text style={styles.helpText}>Describe brevemente tu tienda o servicios</Text>
            <TextInput
              style={[styles.input, { height: 75 }]}
              multiline
              value={bio}
              onChangeText={setBio}
              placeholder="Ej: Venta de alfajores caseros, tortas por encargo y libros de Beauchef..."
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          {/* Contacto */}
          <Text style={styles.sectionHeaderTitle}>Contacto</Text>

          {/* Instagram */}
          <SocialInput
            label="Instagram"
            type="instagram"
            value={instagramHandle}
            onChangeText={setInstagramHandle}
            placeholder="tu_usuario"
          />

          {/* WhatsApp */}
          <SocialInput
            label="WhatsApp"
            type="whatsapp"
            value={wspPhone}
            onChangeText={setWspPhone}
            placeholder="+56912345678"
            showAtPrefix={false}
            keyboardType="phone-pad"
          />

          {/* Telegram */}
          <SocialInput
            label="Telegram"
            type="telegram"
            value={telegramHandle}
            onChangeText={setTelegramHandle}
            placeholder="tu_usuario"
          />

          {/* Signal */}
          <SocialInput
            label="Signal"
            type="signal"
            value={signalPhone}
            onChangeText={setSignalPhone}
            placeholder="tu_usuario"
            showAtPrefix={true}
          />

          {/* Correo Electrónico */}
          <SocialInput
            label="Correo Electrónico"
            type="email"
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="ejemplo@domain.com"
            showAtPrefix={false}
            keyboardType="email-address"
          />

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

  formCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  sectionHeaderTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 6,
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
