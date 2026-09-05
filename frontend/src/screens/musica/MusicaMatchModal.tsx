import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { ContactLinksList } from '../../components/ContactLinksList';
import { theme } from '../../theme/theme';
import { ConoceContact, conoceContactService } from '../../services/conoceContactService';

interface Props {
  currentUser: any;
  matchUser: any;
  onNavigateToUser: (userId: string) => void;
  onClose: () => void;
}

// Aviso de "es un match" + contacto centralizado de Conoce Beauchef (ver
// conoceContactService.ts) — antes esto era exclusivo de Tinder Beauchef.
export const MusicaMatchModal: React.FC<Props> = ({ currentUser, matchUser, onNavigateToUser, onClose }) => {
  const [contact, setContact] = useState<ConoceContact | null>(null);
  const [loadingContact, setLoadingContact] = useState(true);

  useEffect(() => {
    if (!matchUser?.id) return;
    conoceContactService
      .getContactForUser(matchUser.id)
      .then(setContact)
      .catch(() => setContact(null))
      .finally(() => setLoadingContact(false));
  }, [matchUser?.id]);

  return (
    <View style={styles.overlay}>
      <ScrollView style={{ width: '100%' }} contentContainerStyle={styles.popup} showsVerticalScrollIndicator={false}>
        <FontAwesome name="heart" size={56} color="#10B981" />
        <Text style={styles.title}>¡Es un Match!</Text>
        <Text style={styles.subtitle}>A ti y a {matchUser?.name || 'esta persona'} les gusta la misma música.</Text>

        <View style={styles.avatarsRow}>
          <Avatar user={currentUser} size={72} />
          <View style={styles.heartBadge}>
            <FontAwesome name="heart" size={20} color="#EF4444" />
          </View>
          <TouchableOpacity activeOpacity={0.7} onPress={() => matchUser?.id && onNavigateToUser(matchUser.id)}>
            <Avatar user={matchUser} size={72} />
          </TouchableOpacity>
        </View>

        <View style={styles.contactSection}>
          <Text style={styles.contactLabel}>Contacto</Text>
          <ContactLinksList contact={contact} loading={loadingContact} />
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Seguir viendo</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  popup: { alignItems: 'center', maxWidth: 360, width: '100%', alignSelf: 'center', paddingBottom: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: '900', marginTop: theme.spacing.md },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  avatarsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heartBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactSection: { width: '100%', marginTop: theme.spacing.lg },
  contactLabel: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  closeBtn: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  closeBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
