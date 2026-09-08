import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { MatchEvent, Team, LineupEntry, isDeletedEvent } from '../../utils/matchEvents';
import { LeagueBadge } from './LeagueBadge';
import { PlayerAvatar } from '../PlayerAvatar';

interface LeagueMatchLineupsProps {
  rosterA: LineupEntry[];
  rosterB: LineupEntry[];
  teamAName: string;
  teamBName: string;
  events: MatchEvent[];
}

// Ya no existe la convocatoria: se pinta el plantel COMPLETO de cada equipo (todo
// team_players cuenta como disponible para el partido), no un subconjunto elegido por
// el árbitro. `rosterA`/`rosterB` vienen ya en la forma LineupEntry (ver
// rosterToLineupEntries en utils/matchEvents.ts) para reusar el mismo layout de
// columnas con los distintivos de gol/tarjeta por jugador.
export const LeagueMatchLineups: React.FC<LeagueMatchLineupsProps> = ({
  rosterA,
  rosterB,
  teamAName,
  teamBName,
  events,
}) => {
  const hasRosterA = rosterA && rosterA.length > 0;
  const hasRosterB = rosterB && rosterB.length > 0;

  if (!hasRosterA && !hasRosterB) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="users" size={24} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
        <Text style={styles.emptyTitle}>Sin jugadores registrados</Text>
        <Text style={styles.emptySub}>Ninguno de los dos equipos tiene jugadores cargados en su plantel.</Text>
      </View>
    );
  }

  // Mapear eventos por jugador para mostrar distintivos (goles, tarjetas)
  const playerEventsA: Record<string, { goals: number; yellow: number; red: boolean }> = {};
  const playerEventsB: Record<string, { goals: number; yellow: number; red: boolean }> = {};

  (events || []).forEach((ev) => {
    if (isDeletedEvent(ev)) return;
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

  // `mirrored` invierte la columna derecha para que las dos se lean hacia el centro:
  // cara-nombre a la izquierda, nombre-cara a la derecha. Se hace con row-reverse en vez
  // de duplicar el JSX, así el orden de los hijos es uno solo y no puede divergir.
  const renderTeamColumn = (
    team: Team,
    name: string,
    lineup: LineupEntry[],
    eventMap: Record<string, any>,
    mirrored = false
  ) => (
    <View style={styles.column}>
      <View style={styles.columnHeader}>
        <Text style={[styles.teamTitle, mirrored && styles.textRight]} numberOfLines={1}>
          {name}
        </Text>
      </View>

      {(() => {
        // El DT no es "uno más" al final del plantel: tiene su propio lugar arriba de
        // la lista de jugadores, separado y distinguible a simple vista.
        const dt = lineup.find((p) => p.isDT);
        const players = lineup.filter((p) => !p.isDT);

        const renderPlayerRow = (player: LineupEntry, idx: number, dtStyle = false) => {
          const stats = eventMap[player.name];
          const hasGoals = stats && stats.goals > 0;
          const hasRed = stats && stats.red;
          const hasYellow = stats && !hasRed && stats.yellow > 0;

          return (
            <View
              key={player.playerId || idx}
              style={[styles.playerRow, dtStyle && styles.dtRow, mirrored && styles.rowMirrored]}
            >
              {/* La cara del jugador viene del roster del equipo (team_players.photo),
                  leído en vivo — a diferencia de antes, ya no queda una copia guardada
                  en el evento, así que el plantel siempre refleja el roster actual. */}
              <PlayerAvatar
                player={{
                  id: player.playerId || undefined,
                  collectionId: 'team_players',
                  photo: player.photo || undefined,
                }}
                size={26}
              />
              <View style={[styles.playerNameRow, mirrored && styles.rowMirrored]}>
                <Text style={[styles.playerName, mirrored && styles.textRight]} numberOfLines={1}>
                  {player.name}
                </Text>
                {/* Banda de capitán — misma "C" que ya identifica al capitán en la
                    vista de plantel (TeamProfileScreen/PublicTeamScreen/EditTeamScreen),
                    para que sea reconocible como el mismo distintivo en toda la app. */}
                {!!player.isCaptain && (
                  <View style={styles.captainBadge}>
                    <Text style={styles.captainBadgeText}>C</Text>
                  </View>
                )}
                {dtStyle && (
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>DT</Text>
                  </View>
                )}
              </View>
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
        };

        return (
          <>
            {dt && (
              <View style={styles.dtSection}>
                {renderPlayerRow(dt, -1, true)}
              </View>
            )}
            {players.length === 0 ? (
              <Text style={[styles.mutedText, mirrored && styles.textRight]}>Sin registrar</Text>
            ) : (
              players.map((player, idx) => renderPlayerRow(player, idx))
            )}
          </>
        );
      })()}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.columnsRow}>
        {renderTeamColumn('A', teamAName, rosterA || [], playerEventsA)}
        <View style={styles.columnDivider} />
        {renderTeamColumn('B', teamBName, rosterB || [], playerEventsB, true)}
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
  // Envuelve nombre + banda de capitán: si playerName llevara flex:1 directo en
  // playerRow, la banda quedaría empujada al otro extremo de la fila (junto a los
  // distintivos de gol/tarjeta) en vez de al lado del nombre.
  playerNameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  playerName: {
    color: '#dddddd',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  // Misma "C" dorada que el resto de la app usa para el capitán (ver roleBadge en
  // TeamProfileScreen/PublicTeamScreen/EditTeamScreen) — acá con su propio nombre
  // porque esta fila ya tiene un roleBadge distinto para el DT.
  captainBadge: {
    backgroundColor: '#F5B400',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  captainBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
  },
  // Columna derecha: el mismo orden de hijos, leído de derecha a izquierda.
  rowMirrored: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  playerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // El DT vive en su propio bloque, separado del plantel por un divisor propio,
  // para que quede claro que no es "un jugador más".
  dtSection: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  dtRow: {
    borderBottomWidth: 0,
    paddingVertical: 2,
  },
  roleBadge: { backgroundColor: theme.colors.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  roleBadgeText: { color: '#000000', fontSize: 10, fontWeight: '800' },
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
