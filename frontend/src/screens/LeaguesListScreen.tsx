import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { pb } from '../services/pocketbase';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'LeaguesList'>;

export const LeaguesListScreen: React.FC<Props> = ({ navigation }) => {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeagues = useCallback(async () => {
    try {
      setLoading(true);
      const res = await pb.collection('users').getFullList({
        filter: `type = "organization" && subtype = "league"`,
        sort: 'name',
      });
      setLeagues(res);
    } catch (err) {
      console.error('Error cargando ligas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeagues();
    }, [fetchLeagues])
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {leagues.length === 0 ? (
        <Text style={styles.mutedText}>Todavía no hay ninguna liga creada.</Text>
      ) : (
        leagues.map((league) => (
          <TouchableOpacity
            key={league.id}
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => navigation.push('LeagueDetail', { leagueId: league.id, name: league.name })}
          >
            <Text style={styles.leagueName}>{league.name || league.username}</Text>
            <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
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
  content: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  mutedText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  leagueName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
});
