import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { MatchEvent, Team, annotateEventsWithHalfTime } from '../../utils/matchEvents';
import { LeagueBadge, EventBadgeType } from './LeagueBadge';

interface LeagueMatchTimelineProps {
  events: MatchEvent[];
  teamAName: string;
  teamBName: string;
}

export const LeagueMatchTimeline: React.FC<LeagueMatchTimelineProps> = ({
  events,
  teamAName,
  teamBName,
}) => {
  if (!events || events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="clock" size={24} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
        <Text style={styles.emptyTitle}>Sin eventos registrados</Text>
        <Text style={styles.emptySub}>No se han registrado incidencias en este encuentro.</Text>
      </View>
    );
  }

  const renderedItems: React.ReactNode[] = [];

  const annotated = annotateEventsWithHalfTime(events).filter(
    ({ event: e }) => e.type !== 'lineup' && e.type !== 'half_end'
  );

  annotated.forEach(({ event: ev, relativeMs }, idx) => {
    const relativeLabel = relativeMs !== null ? Math.floor(relativeMs / 60000) : null;

    if (ev.type === 'half_start') {
      const halfLabel = `${ev.half}° Tiempo`;
      renderedItems.push(
        <View key={`half-start-${idx}`} style={styles.periodMarker}>
          <Text style={styles.periodMarkerText}>{halfLabel}</Text>
        </View>
      );
      return;
    }

    const nextEv = annotated[idx + 1]?.event;
    const isLastInBlock = !nextEv || nextEv.type === 'half_start';

    if (ev.type === 'goal') {
      const isA = ev.team === 'A';
      const teamName = isA ? teamAName : teamBName;
      const badgeType: EventBadgeType = ev.ownGoal ? 'own_goal' : 'goal';

      renderedItems.push(
        <View key={`goal-${idx}`} style={[styles.eventRow, isLastInBlock && { borderBottomWidth: 0 }]}>
          <View style={styles.eventLeft}>
            <LeagueBadge type={badgeType} size="sm" />
            <Text style={styles.playerName} numberOfLines={1}>
              {ev.player}
            </Text>
            <Text style={styles.teamTag} numberOfLines={1}>
              {teamName}
            </Text>
          </View>

          <View style={styles.eventRight}>
            {relativeLabel !== null && (
              <Text style={styles.minuteTag}>{relativeLabel}'</Text>
            )}
          </View>
        </View>
      );
      return;
    }

    if (ev.type === 'yellow_card' || ev.type === 'red_card') {
      const isA = ev.team === 'A';
      const teamName = isA ? teamAName : teamBName;
      const badgeType: EventBadgeType = ev.type === 'yellow_card' ? 'yellow_card' : 'red_card';

      renderedItems.push(
        <View key={`card-${idx}`} style={[styles.eventRow, isLastInBlock && { borderBottomWidth: 0 }]}>
          <View style={styles.eventLeft}>
            <LeagueBadge type={badgeType} size="sm" />
            <Text style={styles.playerName} numberOfLines={1}>
              {ev.player}
            </Text>
            <Text style={styles.teamTag} numberOfLines={1}>
              {teamName}
            </Text>
          </View>

          <View style={styles.eventRight}>
            {relativeLabel !== null && (
              <Text style={styles.minuteTag}>{relativeLabel}'</Text>
            )}
          </View>
        </View>
      );
      return;
    }

    if (ev.type === 'penalty') {
      const isA = ev.team === 'A';
      const teamName = isA ? teamAName : teamBName;
      const badgeType: EventBadgeType = ev.scored ? 'penalty_scored' : 'penalty_missed';

      renderedItems.push(
        <View key={`pen-${idx}`} style={[styles.eventRow, isLastInBlock && { borderBottomWidth: 0 }]}>
          <View style={styles.eventLeft}>
            <LeagueBadge type={badgeType} size="sm" />
            <Text style={styles.playerName} numberOfLines={1}>
              {ev.player}
            </Text>
            <Text style={styles.teamTag} numberOfLines={1}>
              {teamName}
            </Text>
          </View>

          <View style={styles.eventRight}>
            {relativeLabel !== null && (
              <Text style={styles.minuteTag}>{relativeLabel}'</Text>
            )}
          </View>
        </View>
      );
      return;
    }
  });

  return <View style={styles.container}>{renderedItems}</View>;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: 0,
    marginBottom: theme.spacing.md,
  },
  periodMarker: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: '#222222',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    marginVertical: 4,
  },
  periodMarkerText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  eventLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  playerName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  teamTag: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  eventRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 32,
  },
  minuteTag: {
    color: '#aaaaaa',
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
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
