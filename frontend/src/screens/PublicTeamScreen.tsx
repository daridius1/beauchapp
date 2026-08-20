import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../theme/theme';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PublicShell } from '../components/PublicShell';
import { SectionHeading } from '../components/SectionHeading';
import { PagedMatchList } from '../components/leagues/PagedMatchList';
import { TeamCrest, matchDisplayName } from '../components/leagues/TeamCrest';
import { publicLeagueService, PublicTeamData } from '../services/publicLeagueService';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicTeam'>;

// Un equipo visto sin cuenta, al que se llega explorando la liga.
//
// El plantel se muestra sin enlace a cuentas: el backend no expone a qué estudiante
// está vinculado cada jugador, porque desde acá no hay perfiles a los que navegar.
export const PublicTeamScreen: React.FC<Props> = ({ route, navigation }) => {
  const { teamId } = route.params;
  const [data, setData] = useState<PublicTeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setData(await publicLeagueService.getTeam(teamId));
    } catch (err) {
      console.error('Error cargando el equipo:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await withMinimumDelay(fetchData, 400);
  }, [fetchData]);

  const teamName = matchDisplayName(data?.team, 'Equipo');

  return (
    <PublicShell title={teamName} onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={onRefresh}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : !data ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No se pudo cargar el equipo.</Text></View>
      ) : (
        <>
          <View style={styles.header}>
            <TeamCrest team={data.team} size={70} />
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{teamName}</Text>
              {!!data.team.username && <Text style={styles.handle}>@{data.team.username}</Text>}
              {!!data.bio && <Text style={styles.bio} numberOfLines={2}>{data.bio}</Text>}
            </View>
          </View>

          <SectionHeading title="Jugadores" marginTop={18} />
          {data.players.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>Este equipo todavía no tiene plantel.</Text></View>
          ) : (
            data.players.map((p, idx) => (
              <View key={p.id} style={[styles.playerRow, idx === data.players.length - 1 && styles.playerRowLast]}>
                <PlayerAvatar player={p} size={32} />
                <Text style={styles.playerName}>{p.name}</Text>
              </View>
            ))
          )}

          <SectionHeading title="Partidos" marginTop={18} />
          <PagedMatchList
            matches={data.matches}
            emptyText="Este equipo todavía no tiene partidos."
            onPressMatch={(matchId) => navigation.navigate('PublicMatch', { matchId })}
          />
        </>
      )}
    </PublicShell>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerInfo: { flex: 1, minWidth: 0 },
  name: { fontSize: 19, fontWeight: '800', color: '#ffffff' },
  handle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  bio: { fontSize: 12, color: theme.colors.textMuted, marginTop: 5 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#161616' },
  playerRowLast: { borderBottomWidth: 0 },
  playerName: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '600', color: '#ffffff' },
  empty: { padding: theme.spacing.lg, alignItems: 'center' },
  emptyText: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
});
