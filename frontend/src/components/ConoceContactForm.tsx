import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { ConoceContactFields, conoceContactService } from '../services/conoceContactService';

type FieldKey = keyof ConoceContactFields;

interface FieldConfig {
  key: FieldKey;
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad';
  showAtBadge?: boolean;
}

const FIELDS: FieldConfig[] = [
  { key: 'instagram', icon: <FontAwesome name="instagram" size={18} color="#E1306C" />, label: 'Instagram', placeholder: 'tu_usuario', showAtBadge: true },
  { key: 'whatsapp', icon: <FontAwesome name="whatsapp" size={18} color="#25D366" />, label: 'WhatsApp', placeholder: '+56912345678', keyboardType: 'phone-pad' },
  { key: 'telegram', icon: <FontAwesome name="paper-plane" size={16} color="#0088cc" />, label: 'Telegram', placeholder: 'tu_usuario', showAtBadge: true },
];

// Contacto único que se usa en todos los "Conoce Beauchef" (Tinder, Mascotas, Música,
// Películas, Videojuegos, Libros y Comics): se llena una sola vez acá y el backend lo
// revela a quien haga match en cualquiera de esas categorías (ver conoce_contacts.pb.js).
// Cada red se guarda por separado (botón al final de su fila) — no hay un solo "Guardar"
// para las 4 juntas.
export const ConoceContactForm: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contactId, setContactId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<FieldKey, string>>({ instagram: '', whatsapp: '', telegram: '' });
  const [savingField, setSavingField] = useState<FieldKey | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const contact = await conoceContactService.getMyContact(user.id);
        setContactId(contact?.id || null);
        setValues({
          instagram: contact?.instagram || '',
          whatsapp: contact?.whatsapp || '',
          telegram: contact?.telegram || '',
        });
      } catch (err) {
        console.error('Error cargando contacto de Conoce Beauchef:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const setFieldValue = (key: FieldKey, text: string) => {
    const clean = key === 'whatsapp' ? text : text.replace(/^@+/, '');
    setValues((prev) => ({ ...prev, [key]: clean }));
  };

  const handleSaveField = async (key: FieldKey) => {
    if (!user) return;
    try {
      setSavingField(key);
      const saved = await conoceContactService.saveMyContact(user.id, { [key]: values[key].trim() }, contactId);
      setContactId(saved.id);
      Toast.show({ type: 'success', text1: `${FIELDS.find((f) => f.key === key)?.label} guardado` });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'No se pudo guardar', text2: err?.message || '' });
    } finally {
      setSavingField(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Feather name="phone" size={18} color={theme.colors.text} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.title}>Tu contacto para matches</Text>
          <Text style={styles.subtitle}>Se muestra cuando hagas match en cualquier categoría de acá abajo.</Text>
        </View>
        {loading && <ActivityIndicator size="small" color={theme.colors.textMuted} />}
      </View>

      {!loading && (
        <View style={styles.form}>
          {FIELDS.map((field, idx) => (
            <View key={field.key} style={[styles.row, idx < FIELDS.length - 1 && styles.rowSeparator]}>
              <View style={styles.icon}>{field.icon}</View>
              {field.showAtBadge && <Text style={styles.atBadge}>@</Text>}
              <TextInput
                style={styles.input}
                placeholder={field.placeholder}
                placeholderTextColor={theme.colors.textMuted}
                value={values[field.key]}
                onChangeText={(text) => setFieldValue(field.key, text)}
                keyboardType={field.keyboardType}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.saveFieldBtn, savingField === field.key && styles.saveFieldBtnDisabled]}
                onPress={() => handleSaveField(field.key)}
                disabled={savingField === field.key}
              >
                {savingField === field.key ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.saveFieldBtnText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  subtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  form: { paddingBottom: theme.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowSeparator: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  icon: { width: 24, alignItems: 'center' },
  atBadge: { color: theme.colors.text, fontSize: 15, fontWeight: '800', marginLeft: 4 },
  input: { flex: 1, color: theme.colors.text, fontSize: 14, paddingVertical: 6, marginLeft: 8 },
  saveFieldBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 10,
  },
  saveFieldBtnDisabled: { opacity: 0.6 },
  saveFieldBtnText: { color: '#000', fontSize: 13, fontWeight: '800' },
});
