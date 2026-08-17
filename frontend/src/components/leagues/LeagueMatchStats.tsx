import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { theme } from '../../theme/theme';
import { MatchSummary } from '../../utils/matchEvents';

interface LeagueMatchStatsProps {
  summary: MatchSummary;
  teamAName: string;
  teamBName: string;
}

export const LeagueMatchStats: React.FC<LeagueMatchStatsProps> = ({
  summary,
  teamAName,
  teamBName,
}) => {
  const statRows = [
    {
      label: 'Goles',
      valA: summary.scoreA,
      valB: summary.scoreB,
    },
    {
      label: 'Tarjetas Amarillas',
      valA: summary.cardsA.yellow,
      valB: summary.cardsB.yellow,
    },
    {
      label: 'Tarjetas Rojas',
      valA: summary.cardsA.red,
      valB: summary.cardsB.red,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Cabecera de Equipos */}
      <View style={styles.headerRow}>
        <Text style={styles.teamHeaderLeft} numberOfLines={1}>
          {teamAName}
        </Text>
        <Text style={styles.headerLabel}>Estadística</Text>
        <Text style={styles.teamHeaderRight} numberOfLines={1}>
          {teamBName}
        </Text>
      </View>

      {/* Filas de Estadísticas */}
      {statRows.map((row, idx) => (
        <View key={idx} style={styles.statRow}>
          <Text style={styles.statValueLeft}>{row.valA}</Text>
          <View style={styles.statCenter}>
            <Text style={styles.statLabel}>{row.label}</Text>
          </View>
          <Text style={styles.statValueRight}>{row.valB}</Text>
        </View>
      ))}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    marginBottom: 4,
  },
  teamHeaderLeft: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'left',
  },
  headerLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
  },
  teamHeaderRight: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  statValueLeft: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  statCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  statValueRight: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
