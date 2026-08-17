import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../../theme/theme';
import { Avatar } from '../Avatar';
import { LeagueMatchRowData } from './LeagueMatchRow';

interface TeamData {
  id: string;
  name?: string;
  username?: string;
  avatar?: string;
}

interface LeagueStandingsTableProps {
  teams: { id: string; expand?: { team?: TeamData } }[];
  matches: LeagueMatchRowData[];
  onPressTeam?: (teamId: string) => void;
}

interface TeamStanding {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dif: number;
  pts: number;
}

export const LeagueStandingsTable: React.FC<LeagueStandingsTableProps> = ({
  teams,
  matches,
  onPressTeam,
}) => {
  const standings = useMemo(() => {
    const map: Record<string, TeamStanding> = {};

    // Inicializar todos los equipos participantes
    teams.forEach((t) => {
      const team = t.expand?.team;
      if (!team) return;
      map[team.id] = {
        id: team.id,
        name: team.name || team.username || 'Equipo',
        username: team.username,
        avatar: team.avatar,
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        gf: 0,
        gc: 0,
        dif: 0,
        pts: 0,
      };
    });

    // Procesar partidos jugados
    matches.forEach((m) => {
      if (m.status !== 'played') return;
      const teamAId = m.expand?.teamA?.id || (m as any).teamA;
      const teamBId = m.expand?.teamB?.id || (m as any).teamB;
      const scoreA = m.scoreA ?? 0;
      const scoreB = m.scoreB ?? 0;

      if (teamAId && map[teamAId]) {
        const row = map[teamAId];
        row.pj += 1;
        row.gf += scoreA;
        row.gc += scoreB;
        row.dif = row.gf - row.gc;
        if (scoreA > scoreB) {
          row.pg += 1;
          row.pts += 3;
        } else if (scoreA === scoreB) {
          row.pe += 1;
          row.pts += 1;
        } else {
          row.pp += 1;
        }
      }

      if (teamBId && map[teamBId]) {
        const row = map[teamBId];
        row.pj += 1;
        row.gf += scoreB;
        row.gc += scoreA;
        row.dif = row.gf - row.gc;
        if (scoreB > scoreA) {
          row.pg += 1;
          row.pts += 3;
        } else if (scoreB === scoreA) {
          row.pe += 1;
          row.pts += 1;
        } else {
          row.pp += 1;
        }
      }
    });

    const list = Object.values(map);
    list.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dif !== a.dif) return b.dif - a.dif;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return b.pg - a.pg;
    });

    return list;
  }, [teams, matches]);

  if (standings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hay equipos registrados en la tabla de posiciones.</Text>
      </View>
    );
  }

  return (
    <View style={styles.tableContainer}>
      {/* Cabecera de la Tabla */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.posCol]}>#</Text>
        <Text style={[styles.headerCell, styles.teamCol]}>EQUIPO</Text>
        <Text style={[styles.headerCell, styles.statCol]}>PJ</Text>
        <Text style={[styles.headerCell, styles.statCol]}>PG</Text>
        <Text style={[styles.headerCell, styles.statCol]}>PE</Text>
        <Text style={[styles.headerCell, styles.statCol]}>PP</Text>
        <Text style={[styles.headerCell, styles.difCol]}>DIF</Text>
        <Text style={[styles.headerCell, styles.ptsCol]}>PTS</Text>
      </View>

      {/* Filas de Equipos */}
      {standings.map((team, idx) => {
        const isTop = idx === 0;
        const isLast = idx === standings.length - 1;
        return (
          <TouchableOpacity
            key={team.id}
            style={[styles.dataRow, isLast && { borderBottomWidth: 0 }]}
            onPress={() => onPressTeam && onPressTeam(team.id)}
            activeOpacity={0.7}
            disabled={!onPressTeam}
          >
            <Text style={[styles.posText, isTop && styles.posTextTop]}>{idx + 1}</Text>

            <View style={styles.teamCell}>
              <Avatar
                user={{
                  id: team.id,
                  collectionId: 'users',
                  avatar: team.avatar,
                  name: team.name,
                  username: team.username,
                }}
                size={22}
              />
              <Text style={styles.teamName} numberOfLines={1}>
                {team.name}
              </Text>
            </View>

            <Text style={styles.statCell}>{team.pj}</Text>
            <Text style={styles.statCell}>{team.pg}</Text>
            <Text style={styles.statCell}>{team.pe}</Text>
            <Text style={styles.statCell}>{team.pp}</Text>
            <Text style={styles.difCell}>
              {team.dif > 0 ? `+${team.dif}` : team.dif}
            </Text>
            <Text style={styles.ptsCell}>{team.pts}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tableContainer: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  headerCell: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  posCol: {
    width: 22,
    textAlign: 'center',
  },
  teamCol: {
    flex: 1,
    textAlign: 'left',
    paddingLeft: 6,
  },
  statCol: {
    width: 24,
    textAlign: 'center',
  },
  difCol: {
    width: 28,
    textAlign: 'center',
  },
  ptsCol: {
    width: 32,
    textAlign: 'center',
    color: '#ffffff',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  posText: {
    width: 22,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  posTextTop: {
    color: theme.colors.primary,
  },
  teamCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 6,
    paddingRight: 4,
  },
  teamName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  statCell: {
    width: 24,
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  difCell: {
    width: 28,
    color: '#888888',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  ptsCell: {
    width: 32,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
