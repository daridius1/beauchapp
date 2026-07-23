import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { theme } from '../../theme/theme';
import { ladderService } from '../../services/ladderService';
import { Ladder } from '../../types/ladder';
import Toast from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';
import { MatchSetupStep, StudentUser } from './MatchSetupStep';

interface Props {
  ladder: Ladder;
  initialMode?: '1v1' | '2v2';
  navigation: any;
}

export const TableTennisArbitrator: React.FC<Props> = ({ ladder, initialMode, navigation }) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [step, setStep] = useState<'setup' | 'live'>('setup');

  const [mode, setMode] = useState<'1v1' | '2v2'>(initialMode || '1v1');

  const [teamRed, setTeamRed] = useState<StudentUser[]>([]);
  const [teamBlue, setTeamBlue] = useState<StudentUser[]>([]);

  const [scoreRed, setScoreRed] = useState<number>(0);
  const [scoreBlue, setScoreBlue] = useState<number>(0);
  const [initialServer, setInitialServer] = useState<'red' | 'blue'>('red');
  const [pointHistory, setPointHistory] = useState<('red' | 'blue')[]>([]);

  const targetScore = ladder.max_score || 11;
  const isDeuce = scoreRed >= targetScore - 1 && scoreBlue >= targetScore - 1;

  const checkIsTerminal = (red: number, blue: number): { isTerminal: boolean; winner?: 'red' | 'blue' } => {
    if (isDeuce) {
      if (red - blue >= 2) return { isTerminal: true, winner: 'red' };
      if (blue - red >= 2) return { isTerminal: true, winner: 'blue' };
      return { isTerminal: false };
    }
    if (red >= targetScore) return { isTerminal: true, winner: 'red' };
    if (blue >= targetScore) return { isTerminal: true, winner: 'blue' };
    return { isTerminal: false };
  };

  const terminalState = checkIsTerminal(scoreRed, scoreBlue);
  const isTerminal = terminalState.isTerminal;

  const redNamesLabel = teamRed.map((p) => p?.name).filter(Boolean).join(', ') || 'Equipo Rojo';
  const blueNamesLabel = teamBlue.map((p) => p?.name).filter(Boolean).join(', ') || 'Equipo Azul';

  const totalPointsPlayed = scoreRed + scoreBlue;
  let currentServerTeam: 'red' | 'blue' = 'red';
  let currentServerPlayerName = '';

  if (mode === '2v2' && teamRed.length >= 2 && teamBlue.length >= 2) {
    const rotation = [
      { team: 'red', name: teamRed[0]?.name || 'Rojo 1' },
      { team: 'blue', name: teamBlue[0]?.name || 'Azul 1' },
      { team: 'red', name: teamRed[1]?.name || 'Rojo 2' },
      { team: 'blue', name: teamBlue[1]?.name || 'Azul 2' },
    ];
    let idx = 0;
    if (isDeuce) {
      const baseBlocks = targetScore - 1;
      const pointsInDeuce = totalPointsPlayed - 2 * baseBlocks;
      idx = (baseBlocks + pointsInDeuce) % 4;
    } else {
      idx = Math.floor(totalPointsPlayed / 2) % 4;
    }
    const active = rotation[idx];
    currentServerTeam = active.team as 'red' | 'blue';
    currentServerPlayerName = active.name;
  } else {
    if (isDeuce) {
      const pointsInDeuce = totalPointsPlayed - 2 * (targetScore - 1);
      currentServerTeam = pointsInDeuce % 2 === 0 ? initialServer : (initialServer === 'red' ? 'blue' : 'red');
    } else {
      const serveBlockIndex = Math.floor(totalPointsPlayed / 2);
      currentServerTeam = serveBlockIndex % 2 === 0 ? initialServer : (initialServer === 'red' ? 'blue' : 'red');
    }
    currentServerPlayerName = currentServerTeam === 'red' ? redNamesLabel : blueNamesLabel;
  }

  const handlePoint = (team: 'red' | 'blue') => {
    if (isTerminal) return;

    if (team === 'red') {
      setScoreRed((prev) => prev + 1);
      setPointHistory((prev) => [...prev, 'red']);
    } else {
      setScoreBlue((prev) => prev + 1);
      setPointHistory((prev) => [...prev, 'blue']);
    }
  };

  const handleUndoPoint = () => {
    if (pointHistory.length === 0) return;
    const lastPoint = pointHistory[pointHistory.length - 1];
    setPointHistory((prev) => prev.slice(0, -1));
    if (lastPoint === 'red') {
      setScoreRed((prev) => Math.max(0, prev - 1));
    } else {
      setScoreBlue((prev) => Math.max(0, prev - 1));
    }
  };

  const handleSubmitMatch = async () => {
    if (!isTerminal) return;

    setSubmitting(true);
    try {
      await ladderService.submitArbitratedMatch({
        ladderId: ladder.id,
        mode,
        teamRed: teamRed.map((p) => p.id),
        teamBlue: teamBlue.map((p) => p.id),
        scoreRed,
        scoreBlue,
        goalHistory: pointHistory as any,
      });

      Toast.show({
        type: 'success',
        text1: '¡Partido Guardado!',
        text2: `Resultado final: ${scoreRed} - ${scoreBlue}.`,
      });

      if (navigation.replace) {
        navigation.replace('LadderDetail', { slug: ladder.slug });
      } else {
        navigation.navigate('LadderDetail', { slug: ladder.slug });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'No se pudo guardar el partido.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {step === 'setup' ? (
        <MatchSetupStep
          mode={mode}
          onChangeMode={setMode}
          teamRed={teamRed}
          setTeamRed={setTeamRed}
          teamBlue={teamBlue}
          setTeamBlue={setTeamBlue}
          onStartMatch={() => setStep('live')}
        />
      ) : (
        /* MARCADOR EN VIVO DE TENIS DE MESA (Puntos, Saque & Deuce) */
        <View style={styles.liveContainer}>
          {/* Header Superior de Saque */}
          <View style={[
            styles.serveHeaderCard,
            currentServerTeam === 'red' ? styles.serveHeaderRed : styles.serveHeaderBlue
          ]}>
            <Text style={[
              styles.serveHeaderTitle,
              currentServerTeam === 'red' ? styles.serveHeaderTextRed : styles.serveHeaderTextBlue
            ]}>
              SAQUE
            </Text>
            <Text style={[
              styles.serveHeaderName,
              currentServerTeam === 'red' ? styles.serveHeaderTextRed : styles.serveHeaderTextBlue
            ]} numberOfLines={1}>
              {currentServerPlayerName}
            </Text>
          </View>

          {/* Primera fila: 2 Cuadrados de Puntaje */}
          <View style={styles.scoreSquaresRow}>
            {/* Cuadrado Lado Rojo */}
            <TouchableOpacity
              style={[
                styles.squareScoreCard,
                styles.squareScoreCardRed,
                currentServerTeam === 'red' && styles.squareScoreCardServerRed,
                isTerminal && styles.disabled
              ]}
              activeOpacity={0.8}
              onPress={() => handlePoint('red')}
              disabled={isTerminal}
            >
              <Text style={styles.redLabel} numberOfLines={1}>{redNamesLabel}</Text>
              <Text style={styles.scoreValRed}>{scoreRed}</Text>
            </TouchableOpacity>

            {/* Cuadrado Lado Azul */}
            <TouchableOpacity
              style={[
                styles.squareScoreCard,
                styles.squareScoreCardBlue,
                currentServerTeam === 'blue' && styles.squareScoreCardServerBlue,
                isTerminal && styles.disabled
              ]}
              activeOpacity={0.8}
              onPress={() => handlePoint('blue')}
              disabled={isTerminal}
            >
              <Text style={styles.blueLabel} numberOfLines={1}>{blueNamesLabel}</Text>
              <Text style={styles.scoreValBlue}>{scoreBlue}</Text>
            </TouchableOpacity>
          </View>

          {/* Abajo: Cuadrado Centrado para Deshacer Punto */}
          <View style={styles.undoContainerCentered}>
            <TouchableOpacity
              style={[styles.undoSquareBtn, pointHistory.length === 0 && styles.disabled]}
              onPress={handleUndoPoint}
              disabled={pointHistory.length === 0 || isTerminal}
              activeOpacity={0.8}
            >
              <Feather name="rotate-ccw" color="#ffffff" size={20} />
            </TouchableOpacity>
          </View>

          {isTerminal && (
            <TouchableOpacity style={styles.finishBtn} disabled={submitting} onPress={handleSubmitMatch}>
              {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.finishBtnText}>Guardar Resultado ({scoreRed} - {scoreBlue})</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  liveContainer: {
    gap: theme.spacing.md,
  },
  disabled: {
    opacity: 0.4,
  },
  serveHeaderCard: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serveHeaderRed: {
    backgroundColor: 'rgba(255, 68, 68, 0.12)',
    borderColor: '#ff4444',
  },
  serveHeaderBlue: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38bdf8',
  },
  serveHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    opacity: 0.85,
  },
  serveHeaderName: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  serveHeaderTextRed: {
    color: '#ff4444',
  },
  serveHeaderTextBlue: {
    color: '#38bdf8',
  },
  scoreSquaresRow: {
    flexDirection: 'row',
    gap: 12,
  },
  squareScoreCard: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareScoreCardRed: {
    borderColor: 'rgba(255, 68, 68, 0.4)',
  },
  squareScoreCardBlue: {
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  squareScoreCardServerRed: Platform.OS === 'web' ? ({
    backgroundImage: 'linear-gradient(to top, rgba(255, 68, 68, 0.35) 0%, rgba(255, 68, 68, 0.08) 50%, transparent 100%)',
    borderBottomWidth: 3,
    borderBottomColor: '#ff4444',
  } as any) : {
    borderBottomWidth: 3,
    borderBottomColor: '#ff4444',
  },
  squareScoreCardServerBlue: Platform.OS === 'web' ? ({
    backgroundImage: 'linear-gradient(to top, rgba(56, 189, 248, 0.35) 0%, rgba(56, 189, 248, 0.08) 50%, transparent 100%)',
    borderBottomWidth: 3,
    borderBottomColor: '#38bdf8',
  } as any) : {
    borderBottomWidth: 3,
    borderBottomColor: '#38bdf8',
  },
  redLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 4,
  },
  blueLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38bdf8',
    textAlign: 'center',
    marginBottom: 4,
  },
  scoreValRed: {
    fontSize: 52,
    fontWeight: '900',
    color: '#ff4444',
  },
  scoreValBlue: {
    fontSize: 52,
    fontWeight: '900',
    color: '#38bdf8',
  },
  undoContainerCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  undoSquareBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  finishBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
});
