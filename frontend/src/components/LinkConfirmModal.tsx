import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';

interface Props {
  visible: boolean;
  url: string | null;
  onClose: () => void;
}

// Mismo patrón que el modal de contacto de SocialButtonsRow (título + valor + "Ir al
// Enlace"/"Copiar"/"Cerrar") — acá genérico para cualquier link que aparezca en el texto
// de un post o comentario, en vez de navegar directo al tocarlo.
export const LinkConfirmModal: React.FC<Props> = ({ visible, url, onClose }) => {
  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      Toast.show({ type: 'info', text1: 'Copiado al portapapeles' });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Feather name="link" size={26} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>Enlace Externo</Text>
          </View>

          <View style={styles.valueBox}>
            <Text style={styles.valueText} numberOfLines={3} selectable>{url}</Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionPrimary}
              onPress={() => {
                if (url) Linking.openURL(url).catch(() => {});
                onClose();
              }}
            >
              <Feather name="external-link" size={16} color="#000000" />
              <Text style={styles.actionPrimaryText}>Ir al Enlace</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSecondary}
              onPress={() => {
                if (url) copyToClipboard(url);
                onClose();
              }}
            >
              <Feather name="copy" size={16} color={theme.colors.text} />
              <Text style={styles.actionSecondaryText}>Copiar</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  valueBox: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  valueText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 10,
  },
  actionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionPrimaryText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  actionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionSecondaryText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  closeBtnText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
