import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';

export interface InfoModalSection {
  title: string;
  body: string;
}

interface InfoModalProps {
  visible: boolean;
  title: string;
  sections: InfoModalSection[];
  onClose: () => void;
}

// Modal de ayuda genérico y reutilizable — mismo patrón visual que ya se probó en
// Beaumarket/Beaudle (icono, título, secciones con divisor, botón cerrar), pero acá
// parametrizado por título/secciones en vez de tener el contenido escrito adentro, para
// no repetir el mismo componente por cada ladder/vista nueva que necesite uno.
export const InfoModal: React.FC<InfoModalProps> = ({ visible, title, sections, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <View style={styles.iconContainer}>
            <Feather name="info" size={22} color="#ffffff" />
          </View>

          <Text style={styles.title}>{title}</Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {sections.map((s, i) => (
              <View key={s.title} style={[styles.section, i !== sections.length - 1 && styles.sectionDivider]}>
                <Text style={styles.sectionTitle}>{s.title}</Text>
                <Text style={styles.sectionBody}>{s.body}</Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} activeOpacity={0.7} onPress={onClose}>
            <Text style={styles.closeBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: '#0c0c0c',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  scroll: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  section: {
    paddingBottom: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  sectionBody: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  closeBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
