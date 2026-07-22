import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import { TargetPreview } from './TargetPreview';
import { pb } from '../services/pocketbase';
import Toast from 'react-native-toast-message';

export interface QuoteModalProps {
  visible: boolean;
  targetType: string | null;
  targetId: string | null;
  targetMeta: any | null;
  targetRecord?: any | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const QuoteModal: React.FC<QuoteModalProps> = ({
  visible,
  targetType,
  targetId,
  targetMeta,
  targetRecord,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  if (!visible || !targetType || !targetId) {
    return null;
  }

  const handlePublish = async () => {
    if (!user) {
      Toast.show({ type: 'info', text1: 'Autenticación requerida', text2: 'Inicia sesión para repostear.' });
      return;
    }
    setPosting(true);
    try {
      await pb.collection('posts').create({
        author: user.id,
        content: content.trim() || " ",
        actionType: 'quote',
        targetType: targetType,
        targetId: targetId,
        targetMeta: targetMeta || {},
      });
      Toast.show({ type: 'success', text1: '¡Publicación reposteada!' });
      setContent('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error publishing quote:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo publicar la cita.' });
    } finally {
      setPosting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="repeat" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>Repostear</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
            {/* Input area */}
            <View style={styles.composeRow}>
              <View style={{ marginRight: theme.spacing.sm }}>
                <Avatar user={user} size={36} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Añade un comentario (opcional)..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                maxLength={280}
                value={content}
                onChangeText={setContent}
                autoFocus
              />
            </View>

            {/* Target preview pre-seleccionado */}
            <View style={styles.targetContainer}>
              <TargetPreview
                targetType={targetType}
                targetId={targetId}
                targetMeta={targetMeta}
                expandedTarget={targetRecord}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={onClose}
              disabled={posting}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.publishBtn, posting && styles.publishBtnDisabled]} 
              onPress={handlePublish}
              disabled={posting}
            >
              {posting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.publishBtnText}>Publicar</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#121212',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  targetContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
  },
  cancelBtnText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  publishBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
  },
  publishBtnDisabled: {
    opacity: 0.6,
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
