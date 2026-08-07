import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { theme } from '../../theme/theme';
import { ladderService } from '../../services/ladderService';
import { Ladder } from '../../types/ladder';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MatchSetupStep, StudentUser } from './MatchSetupStep';
import { ConfirmExitModal } from '../ConfirmExitModal';

interface Props {
  ladder: Ladder;
  initialMode?: '1v1' | '2v2';
  navigation: any;
}

export const ClashRoyaleArbitrator: React.FC<Props> = ({ ladder, initialMode, navigation }) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [hasSavedMatch, setHasSavedMatch] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<any>(null);

  const [step, setStep] = useState<'setup' | 'live'>('setup');

  const [mode, setMode] = useState<'1v1' | '2v2'>(initialMode || '1v1');

  const [teamRed, setTeamRed] = useState<StudentUser[]>([]);
  const [teamBlue, setTeamBlue] = useState<StudentUser[]>([]);

  const maxCrowns = ladder.max_score || 3;
  const [crownsRed, setCrownsRed] = useState<number>(0);
  const [crownsBlue, setCrownsBlue] = useState<number>(0);

  const isNavigatingRef = React.useRef<boolean>(false);
  const hasUnsavedData = step === 'live' || crownsRed > 0 || crownsBlue > 0 || teamRed.length > 0 || teamBlue.length > 0;

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

  // Tocar una corona la deja en esa cantidad; volver a tocar la corona ya activa
  // más a la derecha la resta en 1 (funciona como corrección rápida sin botón aparte).
  const handleSetCrowns = (team: 'red' | 'blue', value: number) => {
    if (team === 'red') {
      setCrownsRed((prev) => (prev === value ? value - 1 : value));
    } else {
      setCrownsBlue((prev) => (prev === value ? value - 1 : value));
    }
  };

  const handleSubmitMatch = async () => {
    setSubmitting(true);
    try {
      await ladderService.submitArbitratedMatch({
        ladderId: ladder.id,
        mode,
        teamRed: teamRed.map((p) => p.id),
        teamBlue: teamBlue.map((p) => p.id),
        scoreRed: crownsRed,
        scoreBlue: crownsBlue,
        goalHistory: [],
      });

      Toast.show({
        type: 'success',
        text1: '¡Partido Guardado!',
        text2: `Coronas finales: ${crownsRed} - ${crownsBlue}.`,
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

  const redPlayers = teamRed.map((p) => p?.name).filter(Boolean);
  const bluePlayers = teamBlue.map((p) => p?.name).filter(Boolean);

  const renderCrowns = (team: 'red' | 'blue', count: number) => {
    const color = team === 'red' ? '#ff4444' : '#38bdf8';
    return (
      <View style={styles.crownRow}>
        {Array.from({ length: maxCrowns }).map((_, idx) => {
          const filled = idx < count;
          return (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              onPress={() => handleSetCrowns(team, idx + 1)}
            >
              <MaterialCommunityIcons
                name={filled ? 'crown' : 'crown-outline'}
                size={26}
                color={filled ? color : theme.colors.border}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    );
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
        /* MARCADOR DE CLASH ROYALE (Coronas finales por equipo) */
        <View style={styles.liveContainer}>
          <View style={styles.scoreSquaresRow}>
            {/* Cuadrado Lado Rojo */}
            <View style={[styles.squareScoreCard, styles.squareScoreCardRed]}>
              <View style={styles.cardNamesContainer}>
                {redPlayers.length > 0 ? (
                  redPlayers.map((name, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && (
                        <View style={styles.nameSeparatorRow}>
                          <View style={styles.nameDotRed} />
                        </View>
                      )}
                      <Text style={styles.redLabel} numberOfLines={1}>{name}</Text>
                    </React.Fragment>
                  ))
                ) : (
                  <Text style={styles.redLabel} numberOfLines={1}>Equipo Rojo</Text>
                )}
              </View>

              <Text style={styles.scoreValRed}>{crownsRed}</Text>
              {renderCrowns('red', crownsRed)}
            </View>

            {/* Cuadrado Lado Azul */}
            <View style={[styles.squareScoreCard, styles.squareScoreCardBlue]}>
              <View style={styles.cardNamesContainer}>
                {bluePlayers.length > 0 ? (
                  bluePlayers.map((name, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && (
                        <View style={styles.nameSeparatorRow}>
                          <View style={styles.nameDotBlue} />
                        </View>
                      )}
                      <Text style={styles.blueLabel} numberOfLines={1}>{name}</Text>
                    </React.Fragment>
                  ))
                ) : (
                  <Text style={styles.blueLabel} numberOfLines={1}>Equipo Azul</Text>
                )}
              </View>

              <Text style={styles.scoreValBlue}>{crownsBlue}</Text>
              {renderCrowns('blue', crownsBlue)}
            </View>
          </View>

          <TouchableOpacity style={styles.finishBtn} disabled={submitting} onPress={handleSubmitMatch}>
            {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.finishBtnText}>Guardar Resultado ({crownsRed} - {crownsBlue})</Text>}
          </TouchableOpacity>
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
  liveContainer: {
    gap: theme.spacing.md,
  },
  scoreSquaresRow: {
    flexDirection: 'row',
    gap: 12,
  },
  squareScoreCard: {
    flex: 1,
    minHeight: 160,
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
  cardNamesContainer: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
  },
  nameSeparatorRow: {
    height: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  nameDotRed: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ff4444',
    opacity: 0.6,
  },
  nameDotBlue: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#38bdf8',
    opacity: 0.6,
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
  crownRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
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
