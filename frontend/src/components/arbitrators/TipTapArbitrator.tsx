import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Animated } from 'react-native';
import { theme } from '../../theme/theme';
import { ladderService } from '../../services/ladderService';
import { Ladder } from '../../types/ladder';
import { useAuth } from '../../context/AuthContext';
import { pb } from '../../services/pocketbase';
import { Avatar } from '../Avatar';
import Toast from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';

interface Props {
  ladder: Ladder;
  navigation: any;
}

interface StudentUser {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
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

  const [step, setStep] = useState<'setup' | 'live'>('setup');

  const [playerRed, setPlayerRed] = useState<StudentUser[]>([]);
  const [playerBlue, setPlayerBlue] = useState<StudentUser[]>([]);

  const [scoreRed, setScoreRed] = useState<number>(0);
  const [scoreBlue, setScoreBlue] = useState<number>(0);
  const [accumulator, setAccumulator] = useState<number>(1);
  const [activeTurn, setActiveTurn] = useState<'red' | 'blue'>('red');
  const [rallies, setRallies] = useState<RallyRecord[]>([]);

  const [undoStack, setUndoStack] = useState<HistorySnap[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StudentUser[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [activeSlot, setActiveSlot] = useState<{ team: 'red' | 'blue'; index: number } | null>(null);

  const targetScore = 30;

  // Pre-seleccionar al usuario actual en el Equipo Rojo por defecto
  useEffect(() => {
    if (currentUser && playerRed.length === 0 && playerBlue.length === 0) {
      setPlayerRed([{
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        avatar: currentUser.avatar,
      }]);
    }
  }, [currentUser]);

  const checkIsTerminal = (red: number, blue: number): { isTerminal: boolean; winner?: 'red' | 'blue' } => {
    if (red >= targetScore) return { isTerminal: true, winner: 'red' };
    if (blue >= targetScore) return { isTerminal: true, winner: 'blue' };
    return { isTerminal: false };
  };

  const terminalState = checkIsTerminal(scoreRed, scoreBlue);
  const isTerminal = terminalState.isTerminal;

  const isPlayerAlreadySelected = (userId: string): boolean => {
    return playerRed.some((p) => p?.id === userId) || playerBlue.some((p) => p?.id === userId);
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const query = searchQuery.trim();
        const records = await pb.collection('users').getList<StudentUser>(1, 10, {
          filter: `type != "organization" && (name ~ "${query}" || username ~ "${query}")`,
        });
        setSearchResults(records.items);
      } catch (err) {
        console.error('Error searching students:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectPlayer = (student: StudentUser) => {
    if (!activeSlot) return;

    if (isPlayerAlreadySelected(student.id)) {
      Toast.show({
        type: 'error',
        text1: 'Jugador ya seleccionado',
        text2: `${student.name} ya está asignado.`,
      });
      return;
    }

    if (activeSlot.team === 'red') {
      setPlayerRed([student]);
    } else {
      setPlayerBlue([student]);
    }

    setActiveSlot(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const shuffleOpacity = React.useRef(new Animated.Value(1)).current;
  const shuffleScale = React.useRef(new Animated.Value(1)).current;

  const handleShuffleTeams = () => {
    if (playerRed.length === 0 && playerBlue.length === 0) return;
    if (isShuffling) return;

    setIsShuffling(true);

    Animated.parallel([
      Animated.timing(shuffleOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(shuffleScale, {
        toValue: 0.92,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const shouldSwap = Math.random() < 0.5;
      if (shouldSwap) {
        const tempRed = [...playerRed];
        const tempBlue = [...playerBlue];
        setPlayerRed(tempBlue);
        setPlayerBlue(tempRed);
      }

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(shuffleOpacity, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(shuffleScale, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsShuffling(false);
          Toast.show({
            type: 'info',
            text1: 'Sorteo Realizado',
            text2: shouldSwap
              ? '¡Los jugadores cambiaron de lado!'
              : 'Los jugadores se mantuvieron en su lado.',
          });
        });
      }, 400);
    });
  };

  // Intercambio instantáneo sin animación de desvanecimiento
  const handleSwapTeams = () => {
    if (playerRed.length === 0 && playerBlue.length === 0) return;
    const tempRed = [...playerRed];
    const tempBlue = [...playerBlue];
    setPlayerRed(tempBlue);
    setPlayerBlue(tempRed);
  };

  const handleRemovePlayer = (team: 'red' | 'blue') => {
    if (team === 'red') {
      setPlayerRed([]);
    } else {
      setPlayerBlue([]);
    }
  };

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

  const handleStartMatch = () => {
    if (playerRed.length < 1 || playerBlue.length < 1) {
      Toast.show({
        type: 'error',
        text1: 'Faltan Jugadores',
        text2: 'Asigna a ambos jugadores para iniciar.',
      });
      return;
    }
    setActiveTurn('red');
    setStep('live');
  };

  const handleSigue = () => {
    if (isTerminal) return;
    saveSnap();
    const nextTurn = activeTurn === 'red' ? 'blue' : 'red';
    setAccumulator((prev) => prev + 1);
    setActiveTurn(nextTurn);
  };

  const handlePierde = () => {
    if (isTerminal) return;
    saveSnap();

    const winner = activeTurn === 'red' ? 'blue' : 'red';
    const pozo = accumulator;

    if (winner === 'blue') {
      setScoreBlue((prev) => prev + pozo);
    } else {
      setScoreRed((prev) => prev + pozo);
    }

    setRallies((prev) => [...prev, { team: winner, points: pozo }]);
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
        <View style={styles.setupContainer}>
          <Animated.View style={{ opacity: shuffleOpacity, transform: [{ scale: shuffleScale }] }}>
            <View style={styles.playersGrid}>
              {/* Equipo Rojo */}
              <View style={styles.playerBox}>
                <Text style={styles.redLabel}>EQUIPO ROJO</Text>
                {playerRed[0] ? (
                  <View style={styles.playerCardActive}>
                    <TouchableOpacity style={styles.removeCircleBtn} onPress={() => handleRemovePlayer('red')}>
                      <Feather name="x" color="#888888" size={14} />
                    </TouchableOpacity>
                    <Avatar user={{ id: playerRed[0].id, collectionId: '_pb_users_auth_', avatar: playerRed[0].avatar, name: playerRed[0].name, username: playerRed[0].username }} size={36} />
                    <Text style={styles.chipNameRed} numberOfLines={1}>{playerRed[0].name}</Text>
                    {!!playerRed[0].username && <Text style={styles.playerHandle} numberOfLines={1}>@{playerRed[0].username}</Text>}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.emptySlotCard} activeOpacity={0.7} onPress={() => setActiveSlot({ team: 'red', index: 0 })}>
                    <View style={styles.plusCircleRed}>
                      <Feather name="plus" color="#ff4444" size={20} />
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* Equipo Azul */}
              <View style={styles.playerBox}>
                <Text style={styles.blueLabel}>EQUIPO AZUL</Text>
                {playerBlue[0] ? (
                  <View style={styles.playerCardActive}>
                    <TouchableOpacity style={styles.removeCircleBtn} onPress={() => handleRemovePlayer('blue')}>
                      <Feather name="x" color="#888888" size={14} />
                    </TouchableOpacity>
                    <Avatar user={{ id: playerBlue[0].id, collectionId: '_pb_users_auth_', avatar: playerBlue[0].avatar, name: playerBlue[0].name, username: playerBlue[0].username }} size={36} />
                    <Text style={styles.chipNameBlue} numberOfLines={1}>{playerBlue[0].name}</Text>
                    {!!playerBlue[0].username && <Text style={styles.playerHandle} numberOfLines={1}>@{playerBlue[0].username}</Text>}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.emptySlotCard} activeOpacity={0.7} onPress={() => setActiveSlot({ team: 'blue', index: 0 })}>
                    <View style={styles.plusCircleBlue}>
                      <Feather name="plus" color="#38bdf8" size={20} />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Botones Secundarios: Sortear Lados & Cambiar Lados */}
          <View style={styles.actionBtnsRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, (!playerRed[0] && !playerBlue[0]) && styles.disabled]}
              disabled={!playerRed[0] && !playerBlue[0]}
              onPress={handleShuffleTeams}
            >
              <Feather name="shuffle" color={theme.colors.text} size={14} style={{ marginRight: 6 }} />
              <Text style={styles.btnText}>Sortear Lados</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, (!playerRed[0] && !playerBlue[0]) && styles.disabled]}
              disabled={!playerRed[0] && !playerBlue[0]}
              onPress={handleSwapTeams}
            >
              <Feather name="repeat" color={theme.colors.text} size={14} style={{ marginRight: 6 }} />
              <Text style={styles.btnText}>Cambiar Lados</Text>
            </TouchableOpacity>
          </View>

          {/* Search Modal */}
          {activeSlot && (
            <View style={styles.searchBox}>
              <View style={styles.searchHeader}>
                <Text style={styles.searchTitle}>Buscar Jugador</Text>
                <TouchableOpacity onPress={() => setActiveSlot(null)}>
                  <Feather name="x" color="#ffffff" size={18} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder="Nombre o username..."
                placeholderTextColor="#666666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searching ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 8 }} />
              ) : (
                searchResults.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.searchRow} onPress={() => handleSelectPlayer(item)}>
                    <Text style={styles.searchText}>{item.name}</Text>
                    {!!item.username && <Text style={styles.searchSub}>@{item.username}</Text>}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, (!playerRed[0] || !playerBlue[0]) && styles.disabled]}
            disabled={!playerRed[0] || !playerBlue[0]}
            onPress={handleStartMatch}
          >
            <Text style={styles.primaryBtnText}>Iniciar Partido</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* MARCADOR EN VIVO */
        <View style={styles.liveContainer}>
          <View style={styles.scoreRowCard}>
            <View style={styles.scoreSide}>
              <Text style={styles.redLabel}>{playerRed[0]?.name}</Text>
              <Text style={styles.scoreValRed}>{scoreRed}</Text>
            </View>
            <Text style={styles.vsText}>VS</Text>
            <View style={styles.scoreSideRight}>
              <Text style={styles.blueLabel}>{playerBlue[0]?.name}</Text>
              <Text style={styles.scoreValBlue}>{scoreBlue}</Text>
            </View>
          </View>

          <View style={styles.accumBox}>
            <Text style={styles.accumTurnText}>
              Turno:{' '}
              <Text style={{ color: activeTurn === 'red' ? '#ff4444' : '#38bdf8', fontWeight: '800' }}>
                {activeTurn === 'red' ? playerRed[0]?.name : playerBlue[0]?.name}
              </Text>
            </Text>
            <Text style={styles.accumVal}>{accumulator}</Text>
            <Text style={styles.accumSub}>Puntos en juego</Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.sigueBtn, isTerminal && styles.disabled]}
              disabled={isTerminal}
              onPress={handleSigue}
            >
              <Text style={styles.sigueBtnText}>SIGUE</Text>
              <Text style={styles.actionSubText}>+1 al pozo & pasa turno</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pierdeBtn, isTerminal && styles.disabled]}
              disabled={isTerminal}
              onPress={handlePierde}
            >
              <Text style={styles.pierdeBtnText}>PIERDE</Text>
              <Text style={styles.actionSubTextWhite}>Rival cobra {accumulator} pts</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.historyRow}>
            <TouchableOpacity style={styles.undoBtn} onPress={handleUndo} disabled={undoStack.length === 0}>
              <Feather name="rotate-ccw" color="#ffffff" size={14} />
            </TouchableOpacity>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              {rallies.slice().reverse().map((r, idx) => (
                <View key={idx} style={styles.historyChip}>
                  <Text style={[styles.historyChipText, { color: r.team === 'red' ? '#ff4444' : '#38bdf8' }]}>
                    P{rallies.length - idx}: +{r.points}
                  </Text>
                </View>
              ))}
            </ScrollView>
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
  primaryBtn: {
    backgroundColor: theme.colors.text,
    borderRadius: 6,
    paddingVertical: 12,
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
  scoreSide: {
    flex: 1,
  },
  scoreSideRight: {
    flex: 1,
    alignItems: 'flex-end',
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
  accumBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  accumTurnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  accumVal: {
    fontSize: 36,
    fontWeight: '900',
    color: theme.colors.text,
    marginVertical: 4,
  },
  accumSub: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sigueBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sigueBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  actionSubText: {
    fontSize: 10,
    color: '#444444',
    fontWeight: '700',
  },
  actionSubTextWhite: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
  },
  pierdeBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pierdeBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
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
