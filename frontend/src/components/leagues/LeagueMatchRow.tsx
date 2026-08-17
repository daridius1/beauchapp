import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../../theme/theme';
import { Avatar } from '../Avatar';
import { hourLabel } from '../schedule/AvailabilityGrid';

interface TeamData {
  id: string;
  name?: string;
  username?: string;
  avatar?: string;
}

export interface LeagueMatchRowData {
  id: string;
  scoreA?: number;
  scoreB?: number;
  status: 'confirmed' | 'played' | 'cancelled';
  blockCode: string;
  stage?: string;
  expand?: {
    teamA?: TeamData;
    teamB?: TeamData;
    stage?: { id: string; name: string };
  };
}

interface LeagueMatchRowProps {
  match: LeagueMatchRowData;
  onPress: () => void;
  onPressTeamA?: () => void;
  onPressTeamB?: () => void;
  isLast?: boolean;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatBlockCode(code: string): string {
  if (!code || code.length < 13) return code || 'Por definir';
  const hour = Number(code.slice(-2));
  const [y, m, d] = code.slice(0, -3).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayLabel = DAY_LABELS[(date.getDay() + 6) % 7];
  return `${dayLabel} ${d} ${MONTH_LABELS[m - 1]} · ${hourLabel(hour)}`;
}

export const LeagueMatchRow: React.FC<LeagueMatchRowProps> = ({
  match,
  onPress,
  onPressTeamA,
  onPressTeamB,
  isLast = false,
}) => {
  const teamA = match.expand?.teamA;
  const teamB = match.expand?.teamB;
  const stage = match.expand?.stage;

  const nameA = teamA?.name || teamA?.username || 'Equipo A';
  const nameB = teamB?.name || teamB?.username || 'Equipo B';

  const isPlayed = match.status === 'played';
  const isConfirmed = match.status === 'confirmed';
  const isCancelled = match.status === 'cancelled';

  const scoreA = match.scoreA ?? 0;
  const scoreB = match.scoreB ?? 0;
  const aWon = isPlayed && scoreA > scoreB;
  const bWon = isPlayed && scoreB > scoreA;

  return (
    <TouchableOpacity
      style={[styles.container, isLast && styles.containerLast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Metadatos superiores: Etapa, Fecha/Hora y Estado */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {!!stage?.name && <Text style={styles.stageName}>{stage.name} · </Text>}
          <Text style={styles.dateTimeText}>{formatBlockCode(match.blockCode)}</Text>
        </View>

        <Text
          style={[
            styles.statusText,
            isPlayed && styles.statusPlayed,
            isConfirmed && styles.statusConfirmed,
            isCancelled && styles.statusCancelled,
          ]}
        >
          {isPlayed ? 'FINALIZADO' : isConfirmed ? 'POR JUGAR' : 'CANCELADO'}
        </Text>
      </View>

      {/* Fila principal del Marcador (3 Columnas) */}
      <View style={styles.matchBody}>
        {/* Equipo A */}
        <TouchableOpacity
          style={styles.teamColLeft}
          onPress={onPressTeamA}
          activeOpacity={0.7}
          disabled={!onPressTeamA}
        >
          <Text
            style={[styles.teamNameLeft, aWon && styles.teamNameWinner]}
            numberOfLines={1}
          >
            {nameA}
          </Text>
          <Avatar
            user={
              teamA
                ? {
                    id: teamA.id,
                    collectionId: 'users',
                    avatar: teamA.avatar,
                    name: teamA.name,
                    username: teamA.username,
                  }
                : { name: nameA }
            }
            size={32}
          />
        </TouchableOpacity>

        {/* Marcador Central / VS */}
        <View style={styles.centerCol}>
          {isPlayed ? (
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreDigit, aWon && styles.scoreDigitWinner]}>
                {scoreA}
              </Text>
              <Text style={styles.scoreDash}>-</Text>
              <Text style={[styles.scoreDigit, bWon && styles.scoreDigitWinner]}>
                {scoreB}
              </Text>
            </View>
          ) : (
            <Text style={styles.vsText}>{isCancelled ? 'CANCELADO' : 'vs'}</Text>
          )}
        </View>

        {/* Equipo B */}
        <TouchableOpacity
          style={styles.teamColRight}
          onPress={onPressTeamB}
          activeOpacity={0.7}
          disabled={!onPressTeamB}
        >
          <Avatar
            user={
              teamB
                ? {
                    id: teamB.id,
                    collectionId: 'users',
                    avatar: teamB.avatar,
                    name: teamB.name,
                    username: teamB.username,
                  }
                : { name: nameB }
            }
            size={32}
          />
          <Text
            style={[styles.teamNameRight, bWon && styles.teamNameWinner]}
            numberOfLines={1}
          >
            {nameB}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  containerLast: {
    borderBottomWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  stageName: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  dateTimeText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
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
  matchBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamColLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingRight: 6,
  },
  teamNameLeft: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  teamColRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingLeft: 6,
  },
  teamNameRight: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'left',
    flexShrink: 1,
  },
  teamNameWinner: {
    color: '#ffffff',
    fontWeight: '800',
  },
  centerCol: {
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  scoreDigit: {
    fontSize: 18,
    fontWeight: '800',
    color: '#777777',
    minWidth: 16,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  scoreDigitWinner: {
    color: '#ffffff',
  },
  scoreDash: {
    fontSize: 15,
    fontWeight: '700',
    color: '#444444',
  },
  vsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
    textTransform: 'lowercase',
  },
});
