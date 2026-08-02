import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Linking, Image } from 'react-native';
import { FontAwesome, Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { SIGNAL_LOGO_BASE64 } from '../assets/signalLogo';

export interface SocialContactData {
  instagram?: string;
  telegram?: string;
  whatsapp?: string;
  signal?: string;
  email?: string;
}

interface Props {
  contacts: SocialContactData;
  onMarketplacePress?: () => void;
  style?: any;
}

export const SocialButtonsRow: React.FC<Props> = ({ contacts, onMarketplacePress, style }) => {
  const [activeModal, setActiveModal] = useState<{
    type: 'whatsapp' | 'instagram' | 'telegram' | 'signal' | 'email';
    title: string;
    value: string;
    actionUrl: string;
    iconName?: string;
    iconFamily?: 'FontAwesome' | 'Feather';
    color: string;
  } | null>(null);

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      Toast.show({ type: 'info', text1: 'Copiado al portapapeles' });
    }
  };

  const { instagram, telegram, whatsapp, signal, email } = contacts;

  const hasAnyContact = !!instagram || !!telegram || !!whatsapp || !!signal || !!email || !!onMarketplacePress;
  if (!hasAnyContact) return null;

  return (
    <View style={[styles.contactRow, style]}>
      {/* Botón WhatsApp */}
      {!!whatsapp && (
        <TouchableOpacity
          style={[styles.contactSquareBtn, { borderColor: 'rgba(37, 211, 102, 0.3)', backgroundColor: 'rgba(37, 211, 102, 0.1)' }]}
          activeOpacity={0.7}
          onPress={() => {
            const clean = whatsapp.replace(/[^0-9]/g, '');
            setActiveModal({
              type: 'whatsapp',
              title: 'WhatsApp',
              value: whatsapp,
              actionUrl: `https://wa.me/${clean}`,
              iconName: 'whatsapp',
              iconFamily: 'FontAwesome',
              color: '#25D366',
            });
          }}
        >
          <FontAwesome name="whatsapp" size={18} color="#25D366" />
        </TouchableOpacity>
      )}

      {/* Botón Instagram */}
      {!!instagram && (
        <TouchableOpacity
          style={[styles.contactSquareBtn, { borderColor: 'rgba(225, 48, 108, 0.3)', backgroundColor: 'rgba(225, 48, 108, 0.1)' }]}
          activeOpacity={0.7}
          onPress={() => {
            const handle = instagram.replace(/^@+/, '').trim();
            setActiveModal({
              type: 'instagram',
              title: 'Instagram',
              value: `@${handle}`,
              actionUrl: `https://instagram.com/${handle}`,
              iconName: 'instagram',
              iconFamily: 'Feather',
              color: '#E1306C',
            });
          }}
        >
          <Feather name="instagram" size={18} color="#E1306C" />
        </TouchableOpacity>
      )}

      {/* Botón Telegram */}
      {!!telegram && (
        <TouchableOpacity
          style={[styles.contactSquareBtn, { borderColor: 'rgba(0, 136, 204, 0.3)', backgroundColor: 'rgba(0, 136, 204, 0.1)' }]}
          activeOpacity={0.7}
          onPress={() => {
            const handle = telegram.replace(/^@+/, '').trim();
            setActiveModal({
              type: 'telegram',
              title: 'Telegram',
              value: `@${handle}`,
              actionUrl: `https://t.me/${handle}`,
              iconName: 'telegram',
              iconFamily: 'FontAwesome',
              color: '#229ED9',
            });
          }}
        >
          <FontAwesome name="telegram" size={18} color="#229ED9" />
        </TouchableOpacity>
      )}

      {/* Botón Signal */}
      {!!signal && (
        <TouchableOpacity
          style={[styles.contactSquareBtn, { borderColor: 'rgba(58, 118, 240, 0.3)', backgroundColor: 'rgba(58, 118, 240, 0.1)' }]}
          activeOpacity={0.7}
          onPress={() => {
            const handle = signal.replace(/^@+/, '').trim();
            setActiveModal({
              type: 'signal',
              title: 'Signal',
              value: `@${handle}`,
              actionUrl: `https://signal.me/#p/${handle}`,
              color: '#3A76F0',
            });
          }}
        >
          <Image source={{ uri: SIGNAL_LOGO_BASE64 }} style={{ width: 18, height: 18, borderRadius: 9 }} />
        </TouchableOpacity>
      )}

      {/* Botón Correo Electrónico */}
      {!!email && (
        <TouchableOpacity
          style={[styles.contactSquareBtn, { borderColor: 'rgba(234, 67, 53, 0.3)', backgroundColor: 'rgba(234, 67, 53, 0.1)' }]}
          activeOpacity={0.7}
          onPress={() => {
            setActiveModal({
              type: 'email',
              title: 'Correo Electrónico',
              value: email.trim(),
              actionUrl: `mailto:${email.trim()}`,
              iconName: 'envelope',
              iconFamily: 'FontAwesome',
              color: '#EA4335',
            });
          }}
        >
          <FontAwesome name="envelope" size={18} color="#EA4335" />
        </TouchableOpacity>
      )}

      {/* Botón Marketplace */}
      {!!onMarketplacePress && (
        <TouchableOpacity
          style={[styles.contactSquareBtn, { borderColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}
          activeOpacity={0.7}
          onPress={onMarketplacePress}
        >
          <Feather name="shopping-bag" size={18} color="#f59e0b" />
        </TouchableOpacity>
      )}

      {/* Modal de Acción de Contacto */}
      <Modal
        visible={!!activeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActiveModal(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            {/* Header del Modal */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconCircle, { backgroundColor: `${activeModal?.color}15`, borderColor: activeModal?.color }]}>
                {activeModal?.type === 'signal' ? (
                  <Image source={{ uri: SIGNAL_LOGO_BASE64 }} style={{ width: 34, height: 34, borderRadius: 17 }} />
                ) : (
                  <>
                    {activeModal?.iconFamily === 'FontAwesome' && (
                      <FontAwesome name={activeModal.iconName as any} size={28} color={activeModal.color} />
                    )}
                    {activeModal?.iconFamily === 'Feather' && (
                      <Feather name={activeModal.iconName as any} size={28} color={activeModal.color} />
                    )}
                  </>
                )}
              </View>
              <Text style={styles.modalTitle}>{activeModal?.title}</Text>
            </View>

            {/* Valor del Contacto */}
            <View style={styles.contactValueBox}>
              <Text style={styles.contactValueText} selectable>{activeModal?.value}</Text>
            </View>

            {/* Acciones */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalActionPrimary, { backgroundColor: activeModal?.color }]}
                onPress={() => {
                  if (activeModal?.actionUrl) {
                    Linking.openURL(activeModal.actionUrl).catch(() => {});
                  }
                  setActiveModal(null);
                }}
              >
                <Feather name="external-link" size={16} color="#ffffff" />
                <Text style={styles.modalActionPrimaryText}>Ir al Enlace</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalActionSecondary}
                onPress={() => {
                  if (activeModal?.value) {
                    copyToClipboard(activeModal.value);
                  }
                  setActiveModal(null);
                }}
              >
                <Feather name="copy" size={16} color={theme.colors.text} />
                <Text style={styles.modalActionSecondaryText}>Copiar</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalCloseBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  contactSquareBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  contactValueBox: {
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
  contactValueText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 10,
  },
  modalActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  modalActionPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalActionSecondary: {
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
  modalActionSecondaryText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modalCloseBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalCloseBtnText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
