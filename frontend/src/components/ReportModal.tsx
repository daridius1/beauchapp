import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { reportsService } from '../services/reportsService';
import Toast from 'react-native-toast-message';

interface Props {
  visible: boolean;
  onClose: () => void;
  targetType?: string;
  targetId?: string;
  heading?: string;
  titlePlaceholder?: string;
  messagePlaceholder?: string;
}

export const ReportModal: React.FC<Props> = ({
  visible,
  onClose,
  targetType,
  targetId,
  heading = 'Reportar',
  titlePlaceholder = 'Un resumen corto (ej. "Insultos en un comentario")',
  messagePlaceholder = 'Cuéntanos qué pasó...',
}) => {
  const [reportTitle, setReportTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!reportTitle.trim() && !!message.trim() && !submitting;

  const handleClose = () => {
    if (submitting) return;
    setReportTitle('');
    setMessage('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await reportsService.submitReport({ targetType, targetId, title: reportTitle, message });
      Toast.show({ type: 'success', text1: 'Reporte enviado', text2: 'Gracias, lo vamos a revisar.' });
      setReportTitle('');
      setMessage('');
      onClose();
    } catch (err: any) {
      console.error('Error submitting report:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'No se pudo enviar el reporte.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Feather name="flag" size={24} color="#ffffff" />
          </View>

          <Text style={styles.title}>{heading}</Text>

          <TextInput
            style={styles.titleInput}
            placeholder={titlePlaceholder}
            placeholderTextColor={theme.colors.textMuted}
            value={reportTitle}
            onChangeText={setReportTitle}
            editable={!submitting}
            maxLength={100}
          />

          <TextInput
            style={styles.input}
            placeholder={messagePlaceholder}
            placeholderTextColor={theme.colors.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            editable={!submitting}
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={handleClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, !canSubmit && styles.confirmBtnDisabled]}
              activeOpacity={0.7}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>Enviar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxWidth: 380,
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
  titleInput: {
    width: '100%',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 10,
  },
  input: {
    width: '100%',
    minHeight: 100,
    maxHeight: 200,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});
