import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';
import { OrgAccountRef } from '../types/league';
import { Avatar } from '../components/Avatar';
import { PublicShell } from '../components/PublicShell';
import { publicLeagueService } from '../services/publicLeagueService';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicLeagues'>;

// Punto de entrada público. Desde acá se llega a una liga, y desde una liga a sus
// partidos y equipos. No hay buscador ni acceso a ninguna otra sección de la app.
export const PublicLeaguesScreen: React.FC<Props> = ({ navigation }) => {
  const [leagues, setLeagues] = useState<OrgAccountRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLeagues(await publicLeagueService.listLeagues());
    } catch (err) {
      console.error('Error cargando las ligas públicas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await withMinimumDelay(fetchData, 400);
  }, [fetchData]);

  return (
    <PublicShell
      title="Ligas de Beauchef"
      onBack={() => navigation.navigate('Login')}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : leagues.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Todavía no hay ligas para mostrar.</Text>
        </View>
      ) : (
        leagues.map((l, idx) => (
          <TouchableOpacity
            key={l.id}
            style={[styles.row, idx === leagues.length - 1 && styles.rowLast]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('PublicLeague', { leagueId: l.id })}
          >
            <Avatar user={l} size={38} />
            <View style={styles.info}>
              <Text style={styles.name}>{l.name || l.username}</Text>
              {!!l.username && <Text style={styles.handle}>@{l.username}</Text>}
            </View>
            <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        ))
      )}
    </PublicShell>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  rowLast: { borderBottomWidth: 0 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  handle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  empty: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyText: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
});
