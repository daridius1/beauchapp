import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme/theme';
import { BeaudleStats } from '../../services/beaudleService';

const BUCKETS = ['1', '2', '3', '4', '5', '6', 'failed'];

interface BeaudleStatsPanelProps {
  stats: BeaudleStats;
  ownBucket: string | null;
}

export function BeaudleStatsPanel({ stats, ownBucket }: BeaudleStatsPanelProps) {
  const dist = stats.guessDistribution || {};
  const maxCount = Math.max(1, ...BUCKETS.map((b) => dist[b] || 0));

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{stats.playersCount}</Text>
          <Text style={styles.summaryLabel}>Jugaron hoy</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{stats.solvedCount}</Text>
          <Text style={styles.summaryLabel}>Lo resolvieron</Text>
        </View>
      </View>

      <Text style={styles.distTitle}>Distribución de intentos</Text>
      {BUCKETS.map((bucket) => {
        const count = dist[bucket] || 0;
        const widthPct = Math.max(6, Math.round((count / maxCount) * 100));
        const isOwn = ownBucket === bucket;
        return (
          <View key={bucket} style={styles.distRow}>
            <Text style={styles.distBucketLabel}>{bucket === 'failed' ? 'X' : bucket}</Text>
            <View style={styles.distBarTrack}>
              <View style={[styles.distBar, { width: `${widthPct}%` }, isOwn && styles.distBarOwn]}>
                <Text style={styles.distBarText}>{count}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  distTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  distBucketLabel: {
    width: 18,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  distBarTrack: {
    flex: 1,
    marginLeft: 6,
  },
  distBar: {
    minWidth: 24,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'flex-end',
  },
  distBarOwn: {
    backgroundColor: '#22c55e',
  },
  distBarText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
});
