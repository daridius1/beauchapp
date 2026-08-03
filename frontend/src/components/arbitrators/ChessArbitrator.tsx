import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { theme } from '../../theme/theme';
import { ladderService } from '../../services/ladderService';
import { Ladder } from '../../types/ladder';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../Avatar';
import Toast from 'react-native-toast-message';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { MatchSetupStep, StudentUser } from './MatchSetupStep';
import { ConfirmExitModal } from '../ConfirmExitModal';

interface Props {
  ladder: Ladder;
  navigation: any;
}

type ChessResultType = 'red_win' | 'draw' | 'blue_win' | null;

export const ChessArbitrator: React.FC<Props> = ({ ladder, navigation }) => {
  const { user: currentUser } = useAuth();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [hasSavedMatch, setHasSavedMatch] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<any>(null);

  const [step, setStep] = useState<'setup' | 'live'>('setup');

  const [playerRed, setPlayerRed] = useState<StudentUser[]>([]);
  const [playerBlue, setPlayerBlue] = useState<StudentUser[]>([]);

  const [selectedResult, setSelectedResult] = useState<ChessResultType>(null);

  const isNavigatingRef = React.useRef<boolean>(false);
  const hasUnsavedData = step === 'live' || selectedResult !== null || playerRed.length > 0 || playerBlue.length > 0;

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

  const handleStartMatch = () => {
    setStep('live');
  };

  const handleSaveMatch = async () => {
    if (!selectedResult) {
      Toast.show({
        type: 'error',
        text1: 'Selecciona un resultado',
        text2: 'Debes indicar si fue victoria de Blancas, Tablas o victoria de Negras.',
      });
      return;
    }

    if (!currentUser) return;

    setSubmitting(true);
    try {
      let scoreRed = 0;
      let scoreBlue = 0;

      if (selectedResult === 'red_win') {
        scoreRed = 1;
        scoreBlue = 0;
      } else if (selectedResult === 'blue_win') {
        scoreRed = 0;
        scoreBlue = 1;
      } else if (selectedResult === 'draw') {
        scoreRed = 1;
        scoreBlue = 1;
      }

      const teamRedIds = playerRed.map((p) => p.id);
      const teamBlueIds = playerBlue.map((p) => p.id);

      const status = 'pending_confirmation';
      const initialConfirmations: Record<string, 'pending' | 'accepted'> = {};
      [...teamRedIds, ...teamBlueIds].forEach((uid) => {
        if (uid === currentUser.id) {
          initialConfirmations[uid] = 'accepted';
        } else {
          initialConfirmations[uid] = 'pending';
        }
      });

      await ladderService.createMatch({
        ladder: ladder.id,
        mode: '1v1',
        team_red: teamRedIds,
        team_blue: teamBlueIds,
        score_red: scoreRed,
        score_blue: scoreBlue,
        arbiter: currentUser.id,
        status: status,
        confirmations: JSON.stringify(initialConfirmations),
      });

      setHasSavedMatch(true);
      isNavigatingRef.current = true;
      Toast.show({
        type: 'success',
        text1: 'Partido registrado',
        text2: 'El resultado ha sido enviado para confirmación.',
      });

      navigation.goBack();
    } catch (err: any) {
      console.error('Error saving chess match:', err);
      Toast.show({
        type: 'error',
        text1: 'Error al guardar',
        text2: err.message || 'No se pudo guardar el partido de Ajedrez.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const nameRed = playerRed[0]?.name || 'Jugador 1';
  const nameBlue = playerBlue[0]?.name || 'Jugador 2';

  if (step === 'setup') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <MatchSetupStep
          mode="1v1"
          showModeSelector={false}
          redLabelText="PIEZAS BLANCAS"
          blueLabelText="PIEZAS NEGRAS"
          teamRed={playerRed}
          setTeamRed={setPlayerRed}
          teamBlue={playerBlue}
          setTeamBlue={setPlayerBlue}
          onStartMatch={handleStartMatch}
        />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ConfirmExitModal
        visible={showExitConfirm}
        onConfirm={handleConfirmExit}
        onCancel={handleCancelExit}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Tarjetas de Jugadores */}
        <View style={styles.playersOverview}>
          <View style={[styles.playerCard, styles.playerRedCard]}>
            <Avatar size={44} user={playerRed[0]} />
            <Text style={styles.playerRoleText}>Blancas</Text>
            <Text style={styles.playerNameText} numberOfLines={1}>{nameRed}</Text>
          </View>

          <Text style={styles.vsText}>VS</Text>

          <View style={[styles.playerCard, styles.playerBlueCard]}>
            <Avatar size={44} user={playerBlue[0]} />
            <Text style={styles.playerRoleText}>Negras</Text>
            <Text style={styles.playerNameText} numberOfLines={1}>{nameBlue}</Text>
          </View>
        </View>

        {/* Botones de Resultado */}
        <View style={styles.resultsContainer}>
          <Text style={styles.sectionLabel}>RESULTADO DE LA PARTIDA</Text>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.resultOptionBtn,
              selectedResult === 'red_win' && styles.resultOptionRedActive,
            ]}
            onPress={() => setSelectedResult('red_win')}
          >
            <Text style={[styles.resultOptionTitle, selectedResult === 'red_win' && { color: '#ef4444' }]}>
              Blancas ({nameRed})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.resultOptionBtn,
              selectedResult === 'draw' && styles.resultOptionDrawActive,
            ]}
            onPress={() => setSelectedResult('draw')}
          >
            <Text style={[styles.resultOptionTitle, selectedResult === 'draw' && { color: '#facc15' }]}>
              Empate
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.resultOptionBtn,
              selectedResult === 'blue_win' && styles.resultOptionBlueActive,
            ]}
            onPress={() => setSelectedResult('blue_win')}
          >
            <Text style={[styles.resultOptionTitle, selectedResult === 'blue_win' && { color: '#3b82f6' }]}>
              Negras ({nameBlue})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Acciones */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.saveBtn, (!selectedResult || submitting) && styles.saveBtnDisabled]}
            activeOpacity={0.8}
            onPress={handleSaveMatch}
            disabled={!selectedResult || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Guardar Partido</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setStep('setup')}
            disabled={submitting}
          >
            <Text style={styles.cancelBtnText}>Volver a Selección de Jugadores</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitleText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  playersOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
  },
  playerCard: {
    flex: 1,
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  playerRedCard: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  playerBlueCard: {
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  playerRoleText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  playerNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 2,
  },
  vsText: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textMuted,
    marginHorizontal: 10,
  },
  resultsContainer: {
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
  },
  resultOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  resultOptionRedActive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  resultOptionDrawActive: {
    borderColor: '#facc15',
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
  },
  resultOptionBlueActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  resultOptionTextCol: {
    flex: 1,
  },
  resultOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  resultOptionSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  actionsContainer: {
    gap: 10,
    marginTop: theme.spacing.md,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    gap: 8,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
});
