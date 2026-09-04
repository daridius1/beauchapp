import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { theme } from '../../theme/theme';

interface Props {
  currentUser: any;
  matchUser: any;
  onNavigateToUser: (userId: string) => void;
  onClose: () => void;
}

// Aviso simple de "es un match" — sin datos de contacto (esos son específicos de Tinder
// Beauchef, acá no aplican): solo confirma el match e invita a ver el perfil de la persona.
export const PetMatchModal: React.FC<Props> = ({ currentUser, matchUser, onNavigateToUser, onClose }) => {
  return (
    <View style={styles.overlay}>
      <View style={styles.popup}>
        <FontAwesome name="heart" size={56} color="#10B981" />
        <Text style={styles.title}>¡Es un Match!</Text>
        <Text style={styles.subtitle}>A vos y a {matchUser?.name || 'esta persona'} aman a los animales.</Text>

        <View style={styles.avatarsRow}>
          <Avatar user={currentUser} size={72} />
          <View style={styles.heartBadge}>
            <FontAwesome name="heart" size={20} color="#EF4444" />
          </View>
          <TouchableOpacity activeOpacity={0.7} onPress={() => matchUser?.id && onNavigateToUser(matchUser.id)}>
            <Avatar user={matchUser} size={72} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Seguir viendo</Text>
        </TouchableOpacity>
      </View>
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
  popup: { alignItems: 'center', maxWidth: 360, width: '100%' },
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
  closeBtn: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  closeBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
