import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
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

export const TacaTacaArbitrator: React.FC<Props> = ({ ladder, initialMode, navigation }) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [step, setStep] = useState<'setup' | 'live'>('setup');

  const [mode, setMode] = useState<'1v1' | '2v2'>(initialMode || '1v1');

  const [teamRed, setTeamRed] = useState<StudentUser[]>([]);
  const [teamBlue, setTeamBlue] = useState<StudentUser[]>([]);

  const [scoreRed, setScoreRed] = useState<number>(0);
  const [scoreBlue, setScoreBlue] = useState<number>(0);
  const [goalHistory, setGoalHistory] = useState<('red' | 'blue')[]>([]);

  const targetScore = ladder.max_score || 7;
  const isTerminal = scoreRed >= targetScore || scoreBlue >= targetScore;

  const handleGoal = (team: 'red' | 'blue') => {
    if (isTerminal) return;

    if (team === 'red') {
      setScoreRed((prev) => prev + 1);
      setGoalHistory((prev) => [...prev, 'red']);
    } else {
      setScoreBlue((prev) => prev + 1);
      setGoalHistory((prev) => [...prev, 'blue']);
    }
  };

  const handleUndoGoal = () => {
    if (goalHistory.length === 0) return;
    const lastGoal = goalHistory[goalHistory.length - 1];
    setGoalHistory((prev) => prev.slice(0, -1));
    if (lastGoal === 'red') {
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
        goalHistory,
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

  const redNamesLabel = teamRed.map((p) => p?.name).filter(Boolean).join(', ') || 'Equipo Rojo';
  const blueNamesLabel = teamBlue.map((p) => p?.name).filter(Boolean).join(', ') || 'Equipo Azul';

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
        /* MARCADOR EN VIVO DE TACA TACA */
        <View style={styles.liveContainer}>
          {/* Primera fila: 2 Cuadrados de Puntaje */}
          <View style={styles.scoreSquaresRow}>
            {/* Cuadrado Lado Rojo */}
            <TouchableOpacity
              style={[styles.squareScoreCard, styles.squareScoreCardRed, isTerminal && styles.disabled]}
              activeOpacity={0.8}
              onPress={() => handleGoal('red')}
              disabled={isTerminal}
            >
              <Text style={styles.redLabel} numberOfLines={1}>{redNamesLabel}</Text>
              <Text style={styles.scoreValRed}>{scoreRed}</Text>
            </TouchableOpacity>

            {/* Cuadrado Lado Azul */}
            <TouchableOpacity
              style={[styles.squareScoreCard, styles.squareScoreCardBlue, isTerminal && styles.disabled]}
              activeOpacity={0.8}
              onPress={() => handleGoal('blue')}
              disabled={isTerminal}
            >
              <Text style={styles.blueLabel} numberOfLines={1}>{blueNamesLabel}</Text>
              <Text style={styles.scoreValBlue}>{scoreBlue}</Text>
            </TouchableOpacity>
          </View>

          {/* Abajo: Cuadrado Centrado para Deshacer Gol */}
          <View style={styles.undoContainerCentered}>
            <TouchableOpacity
              style={[styles.undoSquareBtn, goalHistory.length === 0 && styles.disabled]}
              onPress={handleUndoGoal}
              disabled={goalHistory.length === 0 || isTerminal}
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
