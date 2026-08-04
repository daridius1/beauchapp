import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Animated, Platform } from 'react-native';
import { theme } from '../../theme/theme';
import { ladderService } from '../../services/ladderService';
import { Ladder } from '../../types/ladder';
import { useAuth } from '../../context/AuthContext';
import { pb } from '../../services/pocketbase';
import { Avatar } from '../Avatar';
import Toast from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';
import { MatchSetupStep, StudentUser } from './MatchSetupStep';
import { ConfirmExitModal } from '../ConfirmExitModal';

interface Props {
  ladder: Ladder;
  navigation: any;
}

interface RallyRecord {
  team: 'red' | 'blue';
  points: number;
}

interface HistorySnap {
  scoreRed: number;
  scoreBlue: number;
  accumulator: number;
  activeTurn: 'red' | 'blue';
  rallies: RallyRecord[];
}

export const TipTapArbitrator: React.FC<Props> = ({ ladder, navigation }) => {
  const { user: currentUser } = useAuth();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [hasSavedMatch, setHasSavedMatch] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<any>(null);

  const [step, setStep] = useState<'setup' | 'live'>('setup');

  const [playerRed, setPlayerRed] = useState<StudentUser[]>([]);
  const [playerBlue, setPlayerBlue] = useState<StudentUser[]>([]);

  const [scoreRed, setScoreRed] = useState<number>(0);
  const [scoreBlue, setScoreBlue] = useState<number>(0);
  const [accumulator, setAccumulator] = useState<number>(1);
  const [activeTurn, setActiveTurn] = useState<'red' | 'blue'>('red');
  const [rallies, setRallies] = useState<RallyRecord[]>([]);

  const [undoStack, setUndoStack] = useState<HistorySnap[]>([]);

  const isNavigatingRef = React.useRef<boolean>(false);
  const hasUnsavedData = step === 'live' || scoreRed > 0 || scoreBlue > 0 || playerRed.length > 0 || playerBlue.length > 0;

  useEffect(() => {
    if (!navigation) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (hasSavedMatch || isNavigatingRef.current) {
        return;
      }

      if (!hasUnsavedData) {
        return;
      }

      e.preventDefault();
      setPendingAction(e.data.action);
      setShowExitConfirm(true);
    });

    return unsubscribe;
  }, [navigation, hasUnsavedData, hasSavedMatch]);

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    if (pendingAction) {
      navigation.dispatch(pendingAction);
    }
  };

  const handleCancelExit = () => {
    setShowExitConfirm(false);
    setPendingAction(null);
  };

  const targetScore = 30;

  const checkIsTerminal = (red: number, blue: number): { isTerminal: boolean; winner?: 'red' | 'blue' } => {
    if (red >= targetScore) return { isTerminal: true, winner: 'red' };
    if (blue >= targetScore) return { isTerminal: true, winner: 'blue' };
    return { isTerminal: false };
  };

  const terminalState = checkIsTerminal(scoreRed, scoreBlue);
  const isTerminal = terminalState.isTerminal;

  const saveSnap = () => {
    setUndoStack((prev) => [
      ...prev,
      {
        scoreRed,
        scoreBlue,
        accumulator,
        activeTurn,
        rallies: [...rallies],
      },
    ]);
  };

  const handleSigue = () => {
    if (isTerminal) return;

    saveSnap();

    setAccumulator((prev) => prev + 1);
    setActiveTurn((prev) => (prev === 'red' ? 'blue' : 'red'));
  };

  const handlePierde = () => {
    if (isTerminal) return;

    saveSnap();

    const winner = activeTurn === 'red' ? 'blue' : 'red';
    const potPoints = accumulator;

    if (winner === 'red') {
      setScoreRed((prev) => prev + potPoints);
    } else {
      setScoreBlue((prev) => prev + potPoints);
    }

    setRallies((prev) => [
      ...prev,
      {
        team: winner,
        points: potPoints,
      },
    ]);

    setAccumulator(1);
    setActiveTurn(winner);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const lastSnap = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    setScoreRed(lastSnap.scoreRed);
    setScoreBlue(lastSnap.scoreBlue);
    setAccumulator(lastSnap.accumulator);
    setActiveTurn(lastSnap.activeTurn);
    setRallies(lastSnap.rallies);
  };

  const handleSubmitMatch = async () => {
    if (!isTerminal) return;

    setSubmitting(true);
    try {
      await ladderService.submitArbitratedMatch({
        ladderId: ladder.id,
        mode: '1v1',
        teamRed: playerRed.map((p) => p.id),
        teamBlue: playerBlue.map((p) => p.id),
        scoreRed,
        scoreBlue,
        goalHistory: rallies as any,
      });

      Toast.show({
        type: 'success',
        text1: '¡Partido Guardado!',
        text2: `Resultado final: ${scoreRed} - ${scoreBlue}.`,
      });

      isNavigatingRef.current = true;
      setHasSavedMatch(true);
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
          mode="1v1"
          showModeSelector={false}
          teamRed={playerRed}
          setTeamRed={setPlayerRed}
          teamBlue={playerBlue}
          setTeamBlue={setPlayerBlue}
          onStartMatch={() => {
            setActiveTurn('red');
            setStep('live');
          }}
        />
      ) : (
        /* MARCADOR EN VIVO */
        <View style={styles.liveContainer}>
          <View style={styles.scoreRowCard}>
            <View style={styles.scoreSideCentered}>
              <Text style={styles.redLabel} numberOfLines={1}>{playerRed[0]?.name || 'Equipo Rojo'}</Text>
              <Text style={styles.scoreValRed}>{scoreRed}</Text>
            </View>
            <Text style={styles.vsText}>VS</Text>
            <View style={styles.scoreSideCentered}>
              <Text style={styles.blueLabel} numberOfLines={1}>{playerBlue[0]?.name || 'Equipo Azul'}</Text>
              <Text style={styles.scoreValBlue}>{scoreBlue}</Text>
            </View>
          </View>

          {/* Botón SIGUE con el pozo acumulado y color dinámico según el turno */}
          <TouchableOpacity
            style={[
              styles.bigSigueBtn,
              activeTurn === 'red' ? styles.bigSigueRed : styles.bigSigueBlue,
              isTerminal && styles.disabled
            ]}
            disabled={isTerminal}
            onPress={handleSigue}
            activeOpacity={0.85}
          >
            <Text style={styles.bigSigueTitle}>SIGUE</Text>
            <Text style={styles.bigSiguePozoVal}>{accumulator}</Text>
            <Text style={styles.bigSigueTurnSub}>
              Turno: {activeTurn === 'red' ? (playerRed[0]?.name || 'Rojo') : (playerBlue[0]?.name || 'Azul')}
            </Text>
          </TouchableOpacity>

          {/* Fila Inferior: Botón PIERDE + Botón Cuadrado de RETROCEDER */}
          <View style={styles.bottomActionRow}>
            <TouchableOpacity
              style={[styles.pierdeBtn, isTerminal && styles.disabled]}
              disabled={isTerminal}
              onPress={handlePierde}
              activeOpacity={0.85}
            >
              <Text style={styles.pierdeBtnText}>PIERDE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.undoSquareBtn, undoStack.length === 0 && styles.disabled]}
              disabled={undoStack.length === 0}
              onPress={handleUndo}
              activeOpacity={0.85}
            >
              <Feather name="rotate-ccw" color="#ffffff" size={20} />
            </TouchableOpacity>
          </View>

          {rallies.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ralliesScroll}>
              {rallies.slice().reverse().map((r, idx) => (
                <View key={idx} style={styles.historyChip}>
                  <Text style={[styles.historyChipText, { color: r.team === 'red' ? '#ff4444' : '#38bdf8' }]}>
                    P{rallies.length - idx}: +{r.points}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          {isTerminal && (
            <TouchableOpacity style={styles.finishBtn} disabled={submitting} onPress={handleSubmitMatch}>
              {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.finishBtnText}>Guardar Resultado ({scoreRed} - {scoreBlue})</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      <ConfirmExitModal
        visible={showExitConfirm}
        onConfirm={handleConfirmExit}
        onCancel={handleCancelExit}
      />
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
  setupContainer: {
    gap: theme.spacing.sm,
  },
  playersGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: theme.spacing.sm,
  },
  playerBox: {
    flex: 1,
  },
  redLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ff4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  blueLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
    marginBottom: 8,
    textAlign: 'center',
  },
  playerCardActive: {
    backgroundColor: '#161616',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 104,
    position: 'relative',
  },
  emptySlotCard: {
    backgroundColor: '#121212',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#262626',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    height: 104,
  },
  chipNameRed: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff4444',
    textAlign: 'center',
  },
  chipNameBlue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
    textAlign: 'center',
  },
  playerHandle: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: -2,
  },
  removeCircleBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 2,
    zIndex: 2,
  },
  plusCircleRed: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  plusCircleBlue: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  actionBtnsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#161616',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
  },
  btnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  primaryBtnRight: {
    backgroundColor: theme.colors.text,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.4,
  },
  searchBox: {
    backgroundColor: '#121212',
    borderRadius: 6,
    padding: 10,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  searchTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  searchInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: theme.colors.text,
    fontSize: 12,
  },
  searchRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  searchSub: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  liveContainer: {
    gap: theme.spacing.md,
  },
  scoreRowCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreSideCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValRed: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ff4444',
    marginTop: 2,
  },
  scoreValBlue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#38bdf8',
    marginTop: 2,
  },
  vsText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
  },
  bigSigueBtn: {
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigSigueRed: {
    backgroundColor: '#ff4444',
  },
  bigSigueBlue: {
    backgroundColor: '#38bdf8',
  },
  bigSigueTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1.5,
  },
  bigSiguePozoVal: {
    fontSize: 48,
    fontWeight: '900',
    color: '#000000',
    marginVertical: 2,
  },
  bigSigueTurnSub: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    opacity: 0.9,
  },
  bottomActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pierdeBtn: {
    flex: 1,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#ff4444',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pierdeBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ff4444',
    letterSpacing: 1,
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
  ralliesScroll: {
    flexDirection: 'row',
    marginTop: 4,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  undoBtn: {
    backgroundColor: '#161616',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  historyChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  historyChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  finishBtn: {
    backgroundColor: theme.colors.text,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  finishBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});
