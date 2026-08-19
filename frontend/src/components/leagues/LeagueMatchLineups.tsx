import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { MatchEvent, Team, LineupEntry } from '../../utils/matchEvents';
import { LeagueBadge } from './LeagueBadge';
import { PlayerAvatar } from '../PlayerAvatar';

interface LeagueMatchLineupsProps {
  lineupA: LineupEntry[];
  lineupB: LineupEntry[];
  teamAName: string;
  teamBName: string;
  events: MatchEvent[];
}

export const LeagueMatchLineups: React.FC<LeagueMatchLineupsProps> = ({
  lineupA,
  lineupB,
  teamAName,
  teamBName,
  events,
}) => {
  const hasLineupA = lineupA && lineupA.length > 0;
  const hasLineupB = lineupB && lineupB.length > 0;

  if (!hasLineupA && !hasLineupB) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="users" size={24} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
        <Text style={styles.emptyTitle}>Sin convocatoria registrada</Text>
        <Text style={styles.emptySub}>No se especificaron planteles de jugadores para este partido.</Text>
      </View>
    );
  }

  // Mapear eventos por jugador para mostrar distintivos (goles, tarjetas)
  const playerEventsA: Record<string, { goals: number; yellow: number; red: boolean }> = {};
  const playerEventsB: Record<string, { goals: number; yellow: number; red: boolean }> = {};

  (events || []).forEach((ev) => {
    if (ev.type === 'goal' && !ev.ownGoal && ev.player) {
      const player = ev.player;
      const map = ev.team === 'A' ? playerEventsA : playerEventsB;
      if (!map[player]) map[player] = { goals: 0, yellow: 0, red: false };
      map[player].goals += 1;
    } else if (ev.type === 'penalty' && ev.scored && ev.player) {
      const player = ev.player;
      const map = ev.team === 'A' ? playerEventsA : playerEventsB;
      if (!map[player]) map[player] = { goals: 0, yellow: 0, red: false };
      map[player].goals += 1;
    } else if (ev.type === 'yellow_card' && ev.player) {
      const player = ev.player;
      const map = ev.team === 'A' ? playerEventsA : playerEventsB;
      if (!map[player]) map[player] = { goals: 0, yellow: 0, red: false };
      map[player].yellow += 1;
    } else if (ev.type === 'red_card' && ev.player) {
      const player = ev.player;
      const map = ev.team === 'A' ? playerEventsA : playerEventsB;
      if (!map[player]) map[player] = { goals: 0, yellow: 0, red: false };
      map[player].red = true;
    }
  });

  const renderTeamColumn = (team: Team, name: string, lineup: LineupEntry[], eventMap: Record<string, any>) => (
    <View style={styles.column}>
      <View style={styles.columnHeader}>
        <Text style={styles.teamTitle} numberOfLines={1}>
          {name}
        </Text>
      </View>

      {lineup.length === 0 ? (
        <Text style={styles.mutedText}>Sin registrar</Text>
      ) : (
        lineup.map((player, idx) => {
          const stats = eventMap[player.name];
          const hasGoals = stats && stats.goals > 0;
          const hasRed = stats && stats.red;
          const hasYellow = stats && !hasRed && stats.yellow > 0;

          return (
            <View key={player.playerId || idx} style={styles.playerRow}>
              {/* La cara del jugador viene del roster del equipo (team_players.photo),
                  guardada en el propio evento de convocatoria — así el plantel se ve
                  igual aunque el roster cambie después del partido. */}
              <PlayerAvatar
                player={{
                  id: player.playerId || undefined,
                  collectionId: 'team_players',
                  photo: player.photo || undefined,
                }}
                size={26}
              />
              <Text style={styles.playerName} numberOfLines={1}>
                {player.name}
              </Text>
              {!!stats && (
                <View style={styles.playerBadges}>
                  {/* Mostrar tantas pelotitas de fútbol como goles haya metido */}
                  {hasGoals &&
                    Array.from({ length: stats.goals }).map((_, gIdx) => (
                      <LeagueBadge key={`goal-${gIdx}`} type="goal" size="sm" />
                    ))}

                  {/* Si tuvo roja, solo se muestra la roja, no las amarillas */}
                  {hasRed && <LeagueBadge type="red_card" size="sm" />}
                  {hasYellow && <LeagueBadge type="yellow_card" size="sm" />}
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.columnsRow}>
        {renderTeamColumn('A', teamAName, lineupA || [], playerEventsA)}
        <View style={styles.columnDivider} />
        {renderTeamColumn('B', teamBName, lineupB || [], playerEventsB)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: 0,
    marginBottom: theme.spacing.md,
  },
  columnsRow: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
  },
  columnDivider: {
    width: 1,
    backgroundColor: '#1f1f1f',
    marginHorizontal: theme.spacing.md,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    marginBottom: 8,
  },
  teamTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  playerName: {
    color: '#dddddd',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  playerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mutedText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
});
