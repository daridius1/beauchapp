import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../../theme/theme';
import { TeamCrest, matchDisplayName } from './TeamCrest';
import { hourLabel } from '../schedule/AvailabilityGrid';

interface TeamData {
  id: string;
  name?: string;
  username?: string;
  avatar?: string;
  matchAlias?: string;
  matchPhoto?: string;
}

export interface LeagueMatchRowData {
  id: string;
  scoreA?: number;
  scoreB?: number;
  status: 'confirmed' | 'played' | 'cancelled' | 'suspended';
  blockCode: string;
  stage?: string;
  expand?: {
    teamA?: TeamData;
    teamB?: TeamData;
    stage?: { id: string; name: string };
  };
}

export interface LiveMatchInfo {
  scoreA: number;
  scoreB: number;
  running: boolean;
  isHalftime: boolean;
  // Lectura de minuto+tiempo ("35' · 1T") — vacía durante el entretiempo.
  minuteLabel: string;
}

interface LeagueMatchRowProps {
  match: LeagueMatchRowData;
  live?: LiveMatchInfo;
  onPress: () => void;
  isLast?: boolean;
  // La pestaña "Etapas" ya muestra el nombre de la etapa como encabezado de la sección
  // — repetirlo en cada tarjeta ahí es redundante, a diferencia de "Partidos" donde
  // varias etapas se mezclan en una sola lista y sí hace falta distinguirlas.
  hideStage?: boolean;
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
  live,
  onPress,
  isLast = false,
  hideStage = false,
}) => {
  const teamA = match.expand?.teamA;
  const teamB = match.expand?.teamB;
  const stage = match.expand?.stage;

  const nameA = matchDisplayName(teamA, 'Equipo A');
  const nameB = matchDisplayName(teamB, 'Equipo B');

  const isLive = !!live;
  const isHalftime = isLive && live!.isHalftime;
  const isPaused = isLive && !isHalftime && !live!.running;
  const isPlayed = match.status === 'played';
  const isConfirmed = match.status === 'confirmed';
  const isCancelled = match.status === 'cancelled';
  const isSuspended = match.status === 'suspended';

  const scoreA = isLive ? live!.scoreA : match.scoreA ?? 0;
  const scoreB = isLive ? live!.scoreB : match.scoreB ?? 0;
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
          {!hideStage && !!stage?.name && <Text style={styles.stageName}>{stage.name} · </Text>}
          <Text style={styles.dateTimeText}>{formatBlockCode(match.blockCode)}</Text>
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

      {/* Fila principal del Marcador (3 Columnas) */}
      <View style={styles.matchBody}>
        {/* Equipo A */}
        <View style={styles.teamColLeft}>
          <Text
            style={[styles.teamNameLeft, aWon && styles.teamNameWinner]}
            numberOfLines={1}
          >
            {nameA}
          </Text>
          <TeamCrest team={teamA ? { ...teamA, collectionId: 'users' } : { name: nameA }} size={32} />
        </View>

        {/* Marcador Central / VS */}
        <View style={styles.centerCol}>
          {isPlayed || isLive ? (
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreDigit, aWon && styles.scoreDigitWinner, isLive && styles.scoreDigitLive]}>
                {scoreA}
              </Text>
              <Text style={styles.scoreDash}>-</Text>
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
        <View style={styles.teamColRight}>
          <TeamCrest team={teamB ? { ...teamB, collectionId: 'users' } : { name: nameB }} size={32} />
          <Text
            style={[styles.teamNameRight, bWon && styles.teamNameWinner]}
            numberOfLines={1}
          >
            {nameB}
          </Text>
        </View>
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
  scoreDigitLive: {
    color: '#ffffff',
  },
  liveStatusLabel: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
