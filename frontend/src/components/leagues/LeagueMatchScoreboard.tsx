import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { TeamCrest, matchDisplayName } from './TeamCrest';
import { LiveMatchInfo } from './LeagueMatchRow';

interface TeamData {
  id: string;
  name?: string;
  username?: string;
  avatar?: string;
  matchAlias?: string;
  matchPhoto?: string;
}

interface LeagueMatchScoreboardProps {
  match: {
    id: string;
    scoreA?: number;
    scoreB?: number;
    status: 'confirmed' | 'played' | 'cancelled' | 'suspended';
    blockCode: string;
    expand?: {
      teamA?: TeamData;
      teamB?: TeamData;
      stage?: { id: string; name: string };
      league?: { id: string; name: string; username: string };
    };
  };
  referee?: {
    id: string;
    name?: string;
    username?: string;
    avatar?: string;
  } | null;
  formattedDate: string;
  live?: LiveMatchInfo;
  onPressTeamA?: () => void;
  onPressTeamB?: () => void;
  onPressLeague?: () => void;
  onPressReferee?: () => void;
}

export const LeagueMatchScoreboard: React.FC<LeagueMatchScoreboardProps> = ({
  match,
  referee,
  formattedDate,
  live,
  onPressTeamA,
  onPressTeamB,
  onPressLeague,
  onPressReferee,
}) => {
  const teamA = match.expand?.teamA;
  const teamB = match.expand?.teamB;
  const stage = match.expand?.stage;
  const league = match.expand?.league;

  const nameA = matchDisplayName(teamA, 'Equipo A');
  const nameB = matchDisplayName(teamB, 'Equipo B');

  const isLive = !!live;
  const isHalftime = isLive && live!.isHalftime;
  const isPaused = isLive && !isHalftime && !live!.running;
  const isPlayed = match.status === 'played';
  const isCancelled = match.status === 'cancelled';
  const isSuspended = match.status === 'suspended';
  const isConfirmed = match.status === 'confirmed';

  const scoreA = isLive ? live!.scoreA : match.scoreA ?? 0;
  const scoreB = isLive ? live!.scoreB : match.scoreB ?? 0;
  const aWon = isPlayed && scoreA > scoreB;
  const bWon = isPlayed && scoreB > scoreA;

  return (
    <View style={styles.container}>
      {/* Barra superior de metadatos */}
      <View style={styles.metaHeader}>
        <View style={styles.metaLeft}>
          {!!league && (
            <TouchableOpacity onPress={onPressLeague} activeOpacity={0.7} style={styles.leagueTag}>
              <Text style={styles.leagueText}>{league.name || league.username}</Text>
            </TouchableOpacity>
          )}
          {!!stage?.name && (
            <Text style={styles.stageText}>
              {league ? '· ' : ''}{stage.name}
            </Text>
          )}
        </View>

        <View style={styles.statusRow}>
          {isLive && <View style={[styles.liveDot, (isPaused || isHalftime) && styles.liveDotPaused]} />}
          <Text
            style={[
              styles.statusText,
              isLive && !isPaused && !isHalftime && styles.statusLive,
              (isPaused || isHalftime) && styles.statusPaused,
              isPlayed && styles.statusPlayed,
              isConfirmed && !isLive && styles.statusConfirmed,
              (isCancelled || isSuspended) && styles.statusCancelled,
            ]}
          >
            {isHalftime
              ? 'ENTRETIEMPO'
              : isPaused
              ? 'PAUSADO'
              : isLive
              ? 'EN VIVO'
              : isPlayed
              ? 'FINALIZADO'
              : isConfirmed
              ? 'POR JUGAR'
              : isSuspended
              ? 'SUSPENDIDO'
              : 'CANCELADO'}
          </Text>
        </View>
      </View>

      {/* Marcador Principal */}
      <View style={styles.mainScoreboard}>
        {/* Equipo A */}
        <TouchableOpacity
          style={styles.teamSection}
          onPress={onPressTeamA}
          activeOpacity={0.7}
          disabled={!onPressTeamA}
        >
          <View style={styles.avatarWrapper}>
            <TeamCrest team={teamA ? { ...teamA, collectionId: 'users' } : { name: nameA }} size={56} />
          </View>
          <Text style={[styles.teamName, aWon && styles.teamNameWinner]} numberOfLines={2}>
            {nameA}
          </Text>
        </TouchableOpacity>

        {/* Centro: Marcador o VS */}
        <View style={styles.centerScoreSection}>
          {isPlayed || isLive ? (
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreDigit, aWon && styles.scoreDigitWinner, isLive && styles.scoreDigitLive]}>
                {scoreA}
              </Text>
              <Text style={styles.scoreSeparator}>-</Text>
              <Text style={[styles.scoreDigit, bWon && styles.scoreDigitWinner, isLive && styles.scoreDigitLive]}>
                {scoreB}
              </Text>
            </View>
          ) : (
            <Text style={styles.vsText}>vs</Text>
          )}
          {isLive && !isHalftime && (
            <Text style={styles.liveStatusLabel} numberOfLines={1}>
              {live!.minuteLabel}
            </Text>
          )}
        </View>

        {/* Equipo B */}
        <TouchableOpacity
          style={styles.teamSection}
          onPress={onPressTeamB}
          activeOpacity={0.7}
          disabled={!onPressTeamB}
        >
          <View style={styles.avatarWrapper}>
            <TeamCrest team={teamB ? { ...teamB, collectionId: 'users' } : { name: nameB }} size={56} />
          </View>
          <Text style={[styles.teamName, bWon && styles.teamNameWinner]} numberOfLines={2}>
            {nameB}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Barra inferior: Fecha y Árbitro */}
      <View style={styles.footerMeta}>
        <View style={styles.dateBlock}>
          <Feather name="calendar" size={12} color={theme.colors.textMuted} style={{ marginRight: 5 }} />
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>

        {isPlayed && referee && (
          <TouchableOpacity
            style={styles.refereeBlock}
            onPress={onPressReferee}
            activeOpacity={0.7}
            disabled={!onPressReferee}
          >
            <Feather name="user-check" size={12} color={theme.colors.textMuted} style={{ marginRight: 5 }} />
            <Text style={styles.refereeLabel}>
              Árbitro: <Text style={styles.refereeName}>{referee.name || referee.username}</Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
    marginBottom: theme.spacing.md,
  },
  metaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
    marginBottom: theme.spacing.md,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 4,
  },
  leagueTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leagueText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  stageText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  liveDotPaused: {
    backgroundColor: '#94a3b8',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusLive: {
    color: '#f59e0b',
  },
  statusPaused: {
    color: '#94a3b8',
  },
  statusPlayed: {
    color: '#888888',
  },
  statusConfirmed: {
    color: '#38bdf8',
  },
  statusCancelled: {
    color: '#ef4444',
  },
  mainScoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  avatarWrapper: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#222222',
    padding: 2,
    backgroundColor: '#000000',
  },
  teamName: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  teamNameWinner: {
    color: '#ffffff',
    fontWeight: '800',
  },
  centerScoreSection: {
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scoreDigit: {
    fontSize: 34,
    fontWeight: '800',
    color: '#777777',
    minWidth: 32,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  scoreDigitWinner: {
    color: '#ffffff',
  },
  scoreDigitLive: {
    color: '#ffffff',
  },
  liveStatusLabel: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  scoreSeparator: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
  },
  vsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666666',
    textTransform: 'lowercase',
  },
  footerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#161616',
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
    gap: 8,
  },
  dateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  refereeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refereeLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  refereeName: {
    color: theme.colors.text,
    fontWeight: '700',
  },
});
