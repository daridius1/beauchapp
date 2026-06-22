import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { pb } from '../services/pocketbase';
import { theme } from './HomeScreen';
import { RootStackParamList } from '../types/navigation';

interface Contest {
  id: string;
  name: string;
  description: string;
  active: boolean;
  created: string;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Contests'>;

export const ContestsScreen: React.FC<Props> = ({ navigation }) => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContests = async () => {
      try {
        setLoading(true);
        setError(null);
        // Obtener solo concursos activos
        const records = await pb.collection('contests').getFullList<Contest>({
          filter: 'active = true',
          sort: '-created',
        });
        setContests(records);
      } catch (err: any) {
        console.error('Error al cargar concursos:', err);
        setError('No se pudieron cargar los concursos. Por favor intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    fetchContests();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Cargando concursos...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Concursos Disponibles</Text>
        <Text style={styles.subtitle}>
          Participa y predice marcadores para competir con la comunidad de Beauchef.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : contests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay concursos activos en este momento.</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {contests.map((contest) => (
            <TouchableOpacity
              key={contest.id}
              style={styles.contestItem}
              onPress={() => navigation.navigate('WorldCupContest', { contestId: contest.id })}
              activeOpacity={0.8}
            >
              <View style={styles.contestInfo}>
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>ACTIVO</Text>
                </View>
                <Text style={styles.contestName}>{contest.name}</Text>
                <Text style={styles.contestDescription}>{contest.description}</Text>
              </View>
              <View style={styles.arrowContainer}>
                <Text style={styles.arrowText}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  headerSection: {
    marginVertical: theme.spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  errorContainer: {
    padding: theme.spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: theme.borderRadius.md,
    marginVertical: theme.spacing.md,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  listContainer: {
    marginTop: theme.spacing.sm,
  },
  contestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  contestInfo: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  badgeContainer: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgeText: {
    color: theme.colors.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  contestName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  contestDescription: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 20,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
});
