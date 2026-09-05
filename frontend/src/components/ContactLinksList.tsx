import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { ConoceContactFields, openSocialLink } from '../services/conoceContactService';

interface Props {
  contact: Partial<ConoceContactFields> | null | undefined;
  loading?: boolean;
}

interface ContactRow {
  key: 'instagram' | 'whatsapp' | 'telegram';
  icon: React.ReactNode;
  label: string;
  value: string;
}

// Contacto de un match, en cualquier "Conoce Beauchef" (antes exclusivo de Tinder). Lista
// simple con separadores entre filas, sin tarjetas ni fondos de color por plataforma — la
// versión anterior apilaba una "burbuja" de color sólido por cada red y se veía pesada.
export const ContactLinksList: React.FC<Props> = ({ contact, loading }) => {
  if (loading) {
    return <ActivityIndicator size="small" color={theme.colors.textMuted} />;
  }

  const { instagram, whatsapp, telegram } = contact || {};

  const rows: ContactRow[] = [
    instagram && { key: 'instagram', icon: <FontAwesome name="instagram" size={18} color="#E1306C" />, label: 'Instagram', value: `@${instagram}` },
    whatsapp && { key: 'whatsapp', icon: <FontAwesome name="whatsapp" size={18} color="#25D366" />, label: 'WhatsApp', value: whatsapp },
    telegram && { key: 'telegram', icon: <FontAwesome name="paper-plane" size={16} color="#0088cc" />, label: 'Telegram', value: `@${telegram}` },
  ].filter(Boolean) as ContactRow[];

  if (rows.length === 0) {
    return <Text style={styles.emptyText}>No especificó datos de contacto.</Text>;
  }

  return (
    <View>
      {rows.map((row, idx) => (
        <TouchableOpacity
          key={row.key}
          style={[styles.row, idx < rows.length - 1 && styles.rowSeparator]}
          onPress={() => openSocialLink(row.key, row.value.replace(/^@+/, ''))}
        >
          <View style={styles.icon}>{row.icon}</View>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value} numberOfLines={1}>{row.value}</Text>
          <Feather name="external-link" size={14} color={theme.colors.textMuted} style={styles.external} />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowSeparator: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  icon: { width: 24, alignItems: 'center' },
  label: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginLeft: 10 },
  value: { flex: 1, color: theme.colors.textMuted, fontSize: 13, marginLeft: 10, textAlign: 'right' },
  external: { marginLeft: 8 },
  emptyText: { fontStyle: 'italic', color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
});
