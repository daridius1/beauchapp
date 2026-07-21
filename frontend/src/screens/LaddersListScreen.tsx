import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { theme } from '../theme/theme';
import { ladderService } from '../services/ladderService';
import { Ladder } from '../types/ladder';
import { withMinimumDelay } from '../utils/refresh';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { Feather } from '@expo/vector-icons';

type LaddersListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LaddersList'>;

interface Props {
  navigation: LaddersListScreenNavigationProp;
}

export const LaddersListScreen: React.FC<Props> = ({ navigation }) => {
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchLadders = async (hideLoading = false) => {
    if (!hideLoading) setLoading(true);
    try {
      await withMinimumDelay(async () => {
        const data = await ladderService.getLadders();
        setLadders(data);
      }, 400);
    } catch (err) {
      console.error('Error fetching ladders:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLadders();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLadders(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <View style={styles.headerBox}>
        <View style={styles.headerIconContainer}>
          <Feather name="award" color="#ffffff" size={28} />
        </View>
        <Text style={styles.title}>Ladders & Competencias</Text>
        <Text style={styles.subtitle}>
          Rankings oficiales de la FCFM. Compite, registra tus marcadores en vivo y sube en la tabla de posiciones.
        </Text>
      </View>

      {ladders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay ladders activos en este momento.</Text>
        </View>
      ) : (
        ladders.map((ladder) => (
          <TouchableOpacity
            key={ladder.id}
            style={styles.ladderCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('LadderDetail', { slug: ladder.slug })}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBox}>
                <Feather name="activity" color="#ffffff" size={20} />
              </View>
              <View style={styles.cardTitleBox}>
                <Text style={styles.ladderName}>{ladder.name}</Text>
                <View style={styles.modeBadge}>
                  <Text style={styles.modeBadgeText}>
                    {ladder.allowed_modes?.join(' / ') || '2v2'}
                  </Text>
                </View>
              </View>
            </View>

            {!!ladder.description && (
              <Text style={styles.description} numberOfLines={2}>
                {ladder.description}
              </Text>
            )}

            <View style={styles.cardFooter}>
              <Text style={styles.actionText}>Ver Tabla de Posiciones</Text>
              <Feather name="arrow-right" color="#ffffff" size={16} />
            </View>
          </TouchableOpacity>
        ))
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
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  ladderCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTitleBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ladderName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  modeBadge: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#aaaaaa',
  },
  description: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
