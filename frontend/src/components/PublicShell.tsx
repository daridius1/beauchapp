import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';

interface PublicShellProps {
  title: string;
  onBack?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
}

// Marco de las vistas públicas de liga.
//
// Deliberadamente NO trae el Header ni el Sidebar de la app: quien entra sin cuenta
// puede mirar la liga y volver, y nada más. No hay accesos a otras secciones ni nada
// que insinúe que los hay — la única salida es el botón de volver, que termina en la
// pantalla de inicio de sesión.
export const PublicShell: React.FC<PublicShellProps> = ({ title, onBack, refreshing, onRefresh, children }) => (
  <View style={styles.container}>
    <View style={styles.bar}>
      {onBack ? (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backBtn} />
      )}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {onRefresh ? (
        <TouchableOpacity style={styles.backBtn} onPress={onRefresh} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backBtn} />
      )}
    </View>

    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.content}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: { width: 40, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  title: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '700', color: '#ffffff', textAlign: 'center' },
  body: { flex: 1 },
  content: { padding: theme.spacing.md, paddingBottom: 60 },
});
