import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

const CORRECT_COLOR = '#22c55e';

interface BeaudleSuccessModalProps {
  visible: boolean;
  guessCount: number;
  courseName?: string;
  courseCode?: string;
  onClose: () => void;
}

export const BeaudleSuccessModal: React.FC<BeaudleSuccessModalProps> = ({
  visible,
  guessCount,
  courseName,
  courseCode,
  onClose,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <View style={styles.iconContainer}>
            <Feather name="check" size={28} color="#000000" />
          </View>

          <Text style={styles.title}>¡Lo lograste!</Text>
          <Text style={styles.message}>
            Adivinaste el ramo secreto de hoy en {guessCount} intento{guessCount === 1 ? '' : 's'}.
          </Text>
          {!!courseName && (
            <Text style={styles.courseText}>{courseName} ({courseCode})</Text>
          )}

          <TouchableOpacity style={styles.closeBtn} activeOpacity={0.7} onPress={onClose}>
            <Text style={styles.closeBtnText}>Ver resultados</Text>
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
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CORRECT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 18,
  },
  courseText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  closeBtn: {
    marginTop: 20,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});
