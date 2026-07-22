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

export const TableTennisArbitrator: React.FC<Props> = ({ ladder, navigation }) => {
  const { user: currentUser } = useAuth();
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [step, setStep] = useState<'setup' | 'live'>('setup');
  const is2v2 = (ladder.slug && ladder.slug.includes('2v2')) || (ladder.allowed_modes && ladder.allowed_modes.length === 1 && ladder.allowed_modes[0] === '2v2');
  const [mode, setMode] = useState<'1v1' | '2v2'>(is2v2 ? '2v2' : '1v1');
  const maxSlots = mode === '1v1' ? 1 : 2;

  const [playerRed, setPlayerRed] = useState<StudentUser[]>([]);
  const [playerBlue, setPlayerBlue] = useState<StudentUser[]>([]);

  const [scoreRed, setScoreRed] = useState<number>(0);
  const [scoreBlue, setScoreBlue] = useState<number>(0);
  const [initialServer, setInitialServer] = useState<'red' | 'blue'>('red');
  const [pointHistory, setPointHistory] = useState<('red' | 'blue')[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StudentUser[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [activeSlot, setActiveSlot] = useState<{ team: 'red' | 'blue'; index: number } | null>(null);

  const targetScore = ladder.max_score || 11;
  const isDeuce = scoreRed >= targetScore - 1 && scoreBlue >= targetScore - 1;

  // Pre-seleccionar al usuario actual en el Equipo Rojo (slot 0) por defecto
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

  const totalPointsPlayed = scoreRed + scoreBlue;
  let currentServer: 'red' | 'blue' = initialServer;
  if (isDeuce) {
    const pointsInDeuce = totalPointsPlayed - 2 * (targetScore - 1);
    currentServer = pointsInDeuce % 2 === 0 ? initialServer : (initialServer === 'red' ? 'blue' : 'red');
  } else {
    const serveBlockIndex = Math.floor(totalPointsPlayed / 2);
    currentServer = serveBlockIndex % 2 === 0 ? initialServer : (initialServer === 'red' ? 'blue' : 'red');
  }

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
      const updated = [...playerRed];
      updated[activeSlot.index] = student;
      setPlayerRed(updated);
    } else {
      const updated = [...playerBlue];
      updated[activeSlot.index] = student;
      setPlayerBlue(updated);
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
              ? '¡Los equipos cambiaron de lado!'
              : 'Los equipos se mantuvieron en su lado.',
          });
        });
      }, 400);
    });
  };

  const handleSwapTeams = () => {
    if (playerRed.length === 0 && playerBlue.length === 0) return;
    const tempRed = [...playerRed];
    const tempBlue = [...playerBlue];
    setPlayerRed(tempBlue);
    setPlayerBlue(tempRed);
  };

  const handleRemovePlayer = (team: 'red' | 'blue', index: number) => {
    if (team === 'red') {
      setPlayerRed(playerRed.filter((_, i) => i !== index));
    } else {
      setPlayerBlue(playerBlue.filter((_, i) => i !== index));
    }
  };

  const handleStartMatch = () => {
    const required = maxSlots;
    if (playerRed.length < required || playerBlue.length < required) {
      Toast.show({
        type: 'error',
        text1: 'Faltan Jugadores',
        text2: `Asigna a ${required} jugador(es) por equipo para iniciar el partido.`,
      });
      return;
    }
    setInitialServer('red');
    setStep('live');
  };

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
        mode: mode,
        teamRed: playerRed.map((p) => p.id),
        teamBlue: playerBlue.map((p) => p.id),
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

  const redNamesLabel = playerRed.map((p) => p?.name).filter(Boolean).join(', ') || 'Lado Rojo';
  const blueNamesLabel = playerBlue.map((p) => p?.name).filter(Boolean).join(', ') || 'Lado Azul';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {step === 'setup' ? (
        <View style={styles.setupContainer}>
          {/* Selector 1v1 / 2v2 */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeTab, mode === '1v1' && styles.modeTabActive]}
              onPress={() => { setMode('1v1'); setPlayerRed([]); setPlayerBlue([]); }}
            >
              <Text style={[styles.modeTabText, mode === '1v1' && styles.modeTabTextActive]}>1 vs 1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === '2v2' && styles.modeTabActive]}
              onPress={() => { setMode('2v2'); setPlayerRed([]); setPlayerBlue([]); }}
            >
              <Text style={[styles.modeTabText, mode === '2v2' && styles.modeTabTextActive]}>2 vs 2</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={{ opacity: shuffleOpacity, transform: [{ scale: shuffleScale }] }}>
            <View style={styles.playersGrid}>
              {/* Equipo Rojo */}
              <View style={styles.playerBox}>
                <Text style={styles.redLabel}>EQUIPO ROJO</Text>
                {Array.from({ length: maxSlots }).map((_, idx) => {
                  const player = playerRed[idx];
                  return (
                    <View key={`red-${idx}`} style={{ marginBottom: 6 }}>
                      {player ? (
                        <View style={styles.playerCardActive}>
                          <TouchableOpacity style={styles.removeCircleBtn} onPress={() => handleRemovePlayer('red', idx)}>
                            <Feather name="x" color="#888888" size={14} />
                          </TouchableOpacity>
                          <Avatar user={{ id: player.id, collectionId: '_pb_users_auth_', avatar: player.avatar, name: player.name, username: player.username }} size={36} />
                          <Text style={styles.chipNameRed} numberOfLines={1}>{player.name}</Text>
                          {!!player.username && <Text style={styles.playerHandle} numberOfLines={1}>@{player.username}</Text>}
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.emptySlotCard} activeOpacity={0.7} onPress={() => setActiveSlot({ team: 'red', index: idx })}>
                          <View style={styles.plusCircleRed}>
                            <Feather name="plus" color="#ff4444" size={20} />
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Equipo Azul */}
              <View style={styles.playerBox}>
                <Text style={styles.blueLabel}>EQUIPO AZUL</Text>
                {Array.from({ length: maxSlots }).map((_, idx) => {
                  const player = playerBlue[idx];
                  return (
                    <View key={`blue-${idx}`} style={{ marginBottom: 6 }}>
                      {player ? (
                        <View style={styles.playerCardActive}>
                          <TouchableOpacity style={styles.removeCircleBtn} onPress={() => handleRemovePlayer('blue', idx)}>
                            <Feather name="x" color="#888888" size={14} />
                          </TouchableOpacity>
                          <Avatar user={{ id: player.id, collectionId: '_pb_users_auth_', avatar: player.avatar, name: player.name, username: player.username }} size={36} />
                          <Text style={styles.chipNameBlue} numberOfLines={1}>{player.name}</Text>
                          {!!player.username && <Text style={styles.playerHandle} numberOfLines={1}>@{player.username}</Text>}
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.emptySlotCard} activeOpacity={0.7} onPress={() => setActiveSlot({ team: 'blue', index: idx })}>
                          <View style={styles.plusCircleBlue}>
                            <Feather name="plus" color="#38bdf8" size={20} />
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>

          {/* Botones Secundarios: Sortear Lados & Cambiar Lados */}
          <View style={styles.actionBtnsRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, (playerRed.length === 0 && playerBlue.length === 0) && styles.disabled]}
              disabled={playerRed.length === 0 && playerBlue.length === 0}
              onPress={handleShuffleTeams}
            >
              <Feather name="shuffle" color={theme.colors.text} size={14} style={{ marginRight: 6 }} />
              <Text style={styles.btnText}>Sortear Lados</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, (playerRed.length === 0 && playerBlue.length === 0) && styles.disabled]}
              disabled={playerRed.length === 0 && playerBlue.length === 0}
              onPress={handleSwapTeams}
            >
              <Feather name="repeat" color={theme.colors.text} size={14} style={{ marginRight: 6 }} />
              <Text style={styles.btnText}>Cambiar Lados</Text>
            </TouchableOpacity>
          </View>

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
            style={[styles.primaryBtn, (playerRed.length < maxSlots || playerBlue.length < maxSlots) && styles.disabled]}
            disabled={playerRed.length < maxSlots || playerBlue.length < maxSlots}
            onPress={handleStartMatch}
          >
            <Text style={styles.primaryBtnText}>Iniciar Partido ({mode})</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* MARCADOR EN VIVO */
        <View style={styles.liveContainer}>
          <View style={styles.scoreRowCard}>
            <TouchableOpacity style={styles.scoreClickBox} onPress={() => handlePoint('red')} disabled={isTerminal}>
              <Text style={styles.redLabel} numberOfLines={1}>{redNamesLabel} {currentServer === 'red' && '(Saque)'}</Text>
              <Text style={styles.scoreValRed}>{scoreRed}</Text>
              <Text style={styles.tapPromptRed}>+ Punto</Text>
            </TouchableOpacity>

            <Text style={styles.vsText}>VS</Text>

            <TouchableOpacity style={styles.scoreClickBoxRight} onPress={() => handlePoint('blue')} disabled={isTerminal}>
              <Text style={styles.blueLabel} numberOfLines={1}>{blueNamesLabel} {currentServer === 'blue' && '(Saque)'}</Text>
              <Text style={styles.scoreValBlue}>{scoreBlue}</Text>
              <Text style={styles.tapPromptBlue}>+ Punto</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.historyRow}>
            <TouchableOpacity style={styles.undoBtn} onPress={handleUndoPoint} disabled={pointHistory.length === 0}>
              <Feather name="rotate-ccw" color="#ffffff" size={14} style={{ marginRight: 4 }} />
              <Text style={styles.undoText}>Deshacer punto</Text>
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
  setupContainer: {
    gap: theme.spacing.sm,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 6,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeTabActive: {
    backgroundColor: '#ffffff',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  modeTabTextActive: {
    color: '#000000',
    fontWeight: '800',
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
  },
  blueLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
    marginBottom: 8,
  },
  playerCardActive: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  removeCircleBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 2,
    zIndex: 10,
  },
  chipNameRed: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff4444',
    marginTop: 4,
  },
  chipNameBlue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
    marginTop: 4,
  },
  playerHandle: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  emptySlotCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
  },
  plusCircleRed: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusCircleBlue: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: theme.colors.cardBg,
    borderRadius: 6,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
  },
  disabled: {
    opacity: 0.4,
  },
  searchBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 6,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: theme.colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  searchRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  searchSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  liveContainer: {
    gap: theme.spacing.md,
  },
  scoreRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scoreClickBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  scoreClickBoxRight: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textMuted,
    marginHorizontal: 8,
  },
  scoreValRed: {
    fontSize: 48,
    fontWeight: '800',
    color: '#ff4444',
    marginVertical: 4,
  },
  scoreValBlue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#38bdf8',
    marginVertical: 4,
  },
  tapPromptRed: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ff4444',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tapPromptBlue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  historyRow: {
    alignItems: 'center',
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  undoText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  finishBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  finishBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
