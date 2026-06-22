import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from './HomeScreen';

interface ProfileScreenProps {
  onNavigate: (screen: string) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onNavigate }) => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    onNavigate('Home');
  };

  if (!user) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.messageText}>Inicia sesión para ver tu perfil y estadísticas.</Text>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onNavigate('Login')}
        >
          <Text style={styles.actionButtonText}>Iniciar Sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Placeholder para historial de partidos (se integrará dinámicamente más adelante)
  const matches: any[] = [
    // { id: '1', opponent: 'Diego Silva', score: '3 - 1', result: 'Victoria', discipline: 'Taca-Taca', date: '19 Jun 2026', eloDiff: '+16' }
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <Text style={styles.profileName}>{user.name}</Text>
        <Text style={styles.profileEmail}>{user.email}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statTitle}>Puntaje ELO</Text>
          <Text style={styles.statValue}>{user.elo ?? 1200}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statTitle}>Partidas</Text>
          <Text style={styles.statValue}>{matches.length}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Historial de Partidos</Text>

      {matches.length === 0 ? (
        <View style={styles.emptyMatchesBox}>
          <Text style={styles.emptyText}>Aún no registras partidos en Beauchapp.</Text>
          <TouchableOpacity 
            style={styles.registerMatchBtn}
            onPress={() => onNavigate('RegisterMatch')}
          >
            <Text style={styles.registerMatchBtnText}>Registrar mi primer partido</Text>
          </TouchableOpacity>
        </View>
      ) : (
        matches.map((match: any) => (
          <View key={match.id} style={styles.matchCard}>
            <View style={styles.matchMain}>
              <View>
                <Text style={styles.opponentText}>vs. {match.opponent}</Text>
                <Text style={styles.disciplineText}>{match.discipline} • {match.date}</Text>
              </View>
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreText}>{match.score}</Text>
              </View>
            </View>
            <View style={styles.matchFooter}>
              <Text style={[styles.resultText, match.result === 'Victoria' ? styles.winText : styles.lossText]}>
                {match.result}
              </Text>
              <Text style={styles.eloDiffText}>{match.eloDiff} ELO</Text>
            </View>
          </View>
        ))
      )}

      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg * 2,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  messageText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: theme.borderRadius.md,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '800',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    paddingLeft: theme.spacing.xs,
  },
  emptyMatchesBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  registerMatchBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  registerMatchBtnText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700',
  },
  matchCard: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  matchMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  opponentText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  disciplineText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  scoreContainer: {
    backgroundColor: theme.colors.background,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  scoreText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  matchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  resultText: {
    fontSize: 13,
    fontWeight: '700',
  },
  winText: {
    color: '#4ade80',
  },
  lossText: {
    color: '#f87171',
  },
  eloDiffText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
});
