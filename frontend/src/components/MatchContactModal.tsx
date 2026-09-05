import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { Avatar } from './Avatar';
import { ContactLinksList } from './ContactLinksList';
import { ConoceContact, conoceContactService } from '../services/conoceContactService';

interface Props {
  visible: boolean;
  matchUser: any;
  onClose: () => void;
  onNavigateToUser: (userId: string) => void;
  onUnmatch: () => void;
}

// Modal genérico para ver el contacto de un match, usado por Mascotas, Música, Películas,
// Videojuegos y Libros (Tinder Beauchef tiene su propio modal más completo, con fotos y
// descripción, pero muestra el mismo contacto centralizado vía ContactLinksList).
export const MatchContactModal: React.FC<Props> = ({ visible, matchUser, onClose, onNavigateToUser, onUnmatch }) => {
  const [contact, setContact] = useState<ConoceContact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible || !matchUser?.id) return;
    setLoading(true);
    conoceContactService
      .getContactForUser(matchUser.id)
      .then(setContact)
      .catch(() => setContact(null))
      .finally(() => setLoading(false));
  }, [visible, matchUser?.id]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerTitleRow}
              activeOpacity={0.7}
              onPress={() => matchUser?.id && onNavigateToUser(matchUser.id)}
            >
              <Avatar user={matchUser} size={44} />
              <Text style={styles.name} numberOfLines={1}>{matchUser?.name || 'Usuario'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Contacto</Text>
          <ContactLinksList contact={contact} loading={loading} />

          <TouchableOpacity style={styles.profileBtn} onPress={() => matchUser?.id && onNavigateToUser(matchUser.id)}>
            <Feather name="user" size={16} color={theme.colors.text} style={{ marginRight: 8 }} />
            <Text style={styles.profileBtnText}>Ver perfil</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.unmatchBtn} onPress={onUnmatch}>
            <Feather name="trash-2" size={16} color={theme.colors.error} style={{ marginRight: 8 }} />
            <Text style={styles.unmatchBtnText}>Deshacer match</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  name: { color: theme.colors.text, fontSize: 16, fontWeight: '700', marginLeft: 10, flexShrink: 1 },
  sectionLabel: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
  },
  profileBtnText: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  unmatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 12,
  },
  unmatchBtnText: { color: theme.colors.error, fontSize: 13, fontWeight: '700' },
});
