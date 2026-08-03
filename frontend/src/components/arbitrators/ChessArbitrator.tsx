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
        scoreRed = 0.5;
        scoreBlue = 0.5;
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

  const userRedObj = playerRed[0] ? { id: playerRed[0].id, collectionId: '_pb_users_auth_', avatar: playerRed[0].avatar, name: playerRed[0].name, username: playerRed[0].username } : null;
  const userBlueObj = playerBlue[0] ? { id: playerBlue[0].id, collectionId: '_pb_users_auth_', avatar: playerBlue[0].avatar, name: playerBlue[0].name, username: playerBlue[0].username } : null;

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
        {/* Fila de 3 Botones Cuadrados: Blancas / Empate / Negras */}
        <View style={styles.chessButtonsRow}>
          {/* Botón 1: Blancas (Fondo blanco, texto negro, avatar, sin elementos rojos) */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.chessSquareCard,
              styles.whiteCard,
              selectedResult === 'red_win' && styles.whiteCardSelected,
            ]}
            onPress={() => setSelectedResult('red_win')}
          >
            <Avatar size={46} user={userRedObj} />
            <Text style={styles.whiteRoleText}>Blancas</Text>
            <Text style={styles.whiteNameText} numberOfLines={1}>{nameRed}</Text>
          </TouchableOpacity>

          {/* Botón 2: Empate (Fondo gris) */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.chessSquareCard,
              styles.drawCard,
              selectedResult === 'draw' && styles.drawCardSelected,
            ]}
            onPress={() => setSelectedResult('draw')}
          >
            <MaterialCommunityIcons 
              name="handshake-outline" 
              size={34} 
              color={selectedResult === 'draw' ? '#facc15' : '#a3a3a3'} 
            />
            <Text style={[styles.drawRoleText, selectedResult === 'draw' && { color: '#facc15' }]}>Empate</Text>
            <Text style={styles.drawSubText}>½ - ½</Text>
          </TouchableOpacity>

          {/* Botón 3: Negras (Fondo negro, texto blanco) */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.chessSquareCard,
              styles.blackCard,
              selectedResult === 'blue_win' && styles.blackCardSelected,
            ]}
            onPress={() => setSelectedResult('blue_win')}
          >
            <Avatar size={46} user={userBlueObj} />
            <Text style={styles.blackRoleText}>Negras</Text>
            <Text style={styles.blackNameText} numberOfLines={1}>{nameBlue}</Text>
          </TouchableOpacity>
        </View>

        {/* Acciones: Único Botón de Guardar Partido */}
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
    paddingTop: theme.spacing.lg,
  },
  chessButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: theme.spacing.xl,
  },
  chessSquareCard: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  whiteCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e5e5',
  },
  whiteCardSelected: {
    borderColor: '#10b981',
    borderWidth: 3,
  },
  whiteRoleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666666',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  whiteNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    marginTop: 2,
    textAlign: 'center',
  },
  drawCard: {
    backgroundColor: '#222222',
    borderColor: '#333333',
  },
  drawCardSelected: {
    borderColor: '#facc15',
    borderWidth: 3,
  },
  drawRoleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 8,
  },
  drawSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a3a3a3',
    marginTop: 2,
  },
  blackCard: {
    backgroundColor: '#121212',
    borderColor: '#333333',
  },
  blackCardSelected: {
    borderColor: '#38bdf8',
    borderWidth: 3,
  },
  blackRoleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#a3a3a3',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  blackNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
    textAlign: 'center',
  },
  actionsContainer: {
    marginTop: theme.spacing.sm,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
});
