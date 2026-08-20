import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { pb } from '../services/pocketbase';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';
import { Avatar } from '../components/Avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'PollasList'>;

// Entrada global a la Beaupolla.
//
// La polla no es una app suelta: hay UNA POR LIGA, y solo en las que la habilitaron.
// Por eso la entrada de Beauchapps no puede abrir "la polla" directamente —necesita
// saber cuál— y lo que abre es esta lista. Sin ella la polla solo se alcanzaba entrando
// primero a la liga, que es un camino que nadie encuentra por su cuenta.
export const PollasListScreen: React.FC<Props> = ({ navigation }) => {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeagues = useCallback(async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      await withMinimumDelay(async () => {
        const res = await pb.collection('users').getFullList({
          filter: `type = "organization" && subtype = "league" && pollaEnabled = true`,
          sort: 'name',
        });
        setLeagues(res);
      }, 400);
    } catch (err) {
      console.error('Error cargando las pollas:', err);
    } finally {
      if (!hideLoading) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeagues();
    }, [fetchLeagues])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await fetchLeagues(true);
      setLoading(false);
    });
    return () => sub.remove();
  }, [fetchLeagues]);

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
        <View style={styles.emptyContainer}>
          <Feather name="target" size={24} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>Todavía no hay ninguna polla abierta</Text>
          <Text style={styles.emptySub}>
            Cuando una liga habilite su Beaupolla, va a aparecer acá.
          </Text>
        </View>
      ) : (
        leagues.map((league, idx) => (
          <TouchableOpacity
            key={league.id}
            style={[styles.row, idx === leagues.length - 1 && styles.rowLast]}
            activeOpacity={0.7}
            onPress={() => navigation.push('Polla', { leagueId: league.id })}
          >
            <Avatar user={league} size={36} />
            <View style={styles.info}>
              <Text style={styles.name}>{league.name || league.username}</Text>
              {!!league.username && <Text style={styles.handle}>@{league.username}</Text>}
            </View>
            <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 60 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  rowLast: { borderBottomWidth: 0 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  handle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  emptyContainer: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  emptySub: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 17 },
});
