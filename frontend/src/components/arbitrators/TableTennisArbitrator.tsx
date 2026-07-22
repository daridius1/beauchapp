import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Animated } from 'react-native';
import { theme } from '../../theme/theme';
import { ladderService } from '../../services/ladderService';
import { Ladder } from '../../types/ladder';
import { useAuth } from '../../context/AuthContext';
import { pb } from '../../services/pocketbase';
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
      setPlayerRed([student]);
    } else {
      setPlayerBlue([student]);
    }

    setActiveSlot(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAddMyself = (team: 'red' | 'blue') => {
    if (!currentUser) return;
    if (isPlayerAlreadySelected(currentUser.id)) {
      Toast.show({
        type: 'error',
        text1: 'Ya estás en la lista',
        text2: 'Ya has sido asignado.',
      });
      return;
    }

    const student: StudentUser = {
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username,
      avatar: currentUser.avatar,
    };

    if (team === 'red') {
      setPlayerRed([student]);
    } else {
      setPlayerBlue([student]);
    }
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
            text1: '🔀 Sorteo Realizado',
            text2: shouldSwap
              ? '¡Los jugadores cambiaron de lado!'
              : 'Los jugadores se mantuvieron en su lado.',
          });
        });
      }, 400);
    });
  };

  const handleRemovePlayer = (team: 'red' | 'blue') => {
    if (team === 'red') {
      setPlayerRed([]);
    } else {
      setPlayerBlue([]);
    }
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
        mode: '1v1',
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

  const isCurrentUserInMatch = currentUser ? isPlayerAlreadySelected(currentUser.id) : false;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>Tenis de Mesa ({targetScore} Puntos)</Text>
        <Text style={styles.subtitle}>
          {step === 'setup' ? 'Asigna a los jugadores' : `Saca: ${currentServer === 'red' ? playerRed[0]?.name : playerBlue[0]?.name}`}
        </Text>
      </View>

      {step === 'setup' ? (
        <View style={styles.card}>
          <Animated.View style={{ opacity: shuffleOpacity, transform: [{ scale: shuffleScale }] }}>
            <View style={styles.playersGrid}>
              <View style={styles.playerBox}>
                <Text style={styles.redLabel}>LADO ROJO</Text>
                {playerRed[0] ? (
                  <View style={styles.playerChip}>
                    <Text style={styles.chipNameRed} numberOfLines={1}>{playerRed[0].name}</Text>
                    <TouchableOpacity onPress={() => handleRemovePlayer('red')}>
                      <Feather name="x" color="#ef4444" size={16} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.addBtnsRow}>
                    <TouchableOpacity style={styles.btnSmall} onPress={() => setActiveSlot({ team: 'red', index: 0 })}>
                      <Text style={styles.btnSmallTextRed}>+ Buscar</Text>
                    </TouchableOpacity>
                    {currentUser && (
                      <TouchableOpacity
                        style={[styles.btnSmall, isCurrentUserInMatch && styles.disabled]}
                        disabled={isCurrentUserInMatch}
                        onPress={() => handleAddMyself('red')}
                      >
                        <Text style={styles.btnSmallTextRed}>+ Yo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.playerBox}>
                <Text style={styles.blueLabel}>LADO AZUL</Text>
                {playerBlue[0] ? (
                  <View style={styles.playerChip}>
                    <Text style={styles.chipNameBlue} numberOfLines={1}>{playerBlue[0].name}</Text>
                    <TouchableOpacity onPress={() => handleRemovePlayer('blue')}>
                      <Feather name="x" color="#38bdf8" size={16} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.addBtnsRow}>
                    <TouchableOpacity style={styles.btnSmall} onPress={() => setActiveSlot({ team: 'blue', index: 0 })}>
                      <Text style={styles.btnSmallTextBlue}>+ Buscar</Text>
                    </TouchableOpacity>
                    {currentUser && (
                      <TouchableOpacity
                        style={[styles.btnSmall, isCurrentUserInMatch && styles.disabled]}
                        disabled={isCurrentUserInMatch}
                        onPress={() => handleAddMyself('blue')}
                      >
                        <Text style={styles.btnSmallTextBlue}>+ Yo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          </Animated.View>

          <TouchableOpacity
            style={[styles.shuffleBtn, (!playerRed[0] && !playerBlue[0]) && styles.disabled]}
            disabled={!playerRed[0] && !playerBlue[0]}
            onPress={handleShuffleTeams}
          >
            <Feather name="shuffle" color={theme.colors.text} size={14} style={{ marginRight: 6 }} />
            <Text style={styles.btnText}>Sortear Lados 🔀</Text>
          </TouchableOpacity>

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
                placeholder="Nombre..."
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
            <Text style={styles.primaryBtnText}>Iniciar Partido 🚀</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* MARCADOR EN VIVO */
        <View style={styles.liveContainer}>
          <View style={styles.scoreRowCard}>
            <TouchableOpacity style={styles.scoreClickBox} onPress={() => handlePoint('red')} disabled={isTerminal}>
              <Text style={styles.redLabel}>{playerRed[0]?.name} {currentServer === 'red' && '(Saque)'}</Text>
              <Text style={styles.scoreValRed}>{scoreRed}</Text>
              <Text style={styles.tapPromptRed}>+ Punto</Text>
            </TouchableOpacity>

            <Text style={styles.vsText}>VS</Text>

            <TouchableOpacity style={styles.scoreClickBoxRight} onPress={() => handlePoint('blue')} disabled={isTerminal}>
              <Text style={styles.blueLabel}>{playerBlue[0]?.name} {currentServer === 'blue' && '(Saque)'}</Text>
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
  headerBox: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  card: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  playersGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: theme.spacing.md,
  },
  playerBox: {
    flex: 1,
  },
  redLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ff4444',
    marginBottom: 4,
  },
  blueLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
    marginBottom: 4,
  },
  playerChip: {
    backgroundColor: '#161616',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipNameRed: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff4444',
    flex: 1,
  },
  chipNameBlue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
    flex: 1,
  },
  addBtnsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  btnSmall: {
    backgroundColor: '#161616',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnSmallTextRed: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ff4444',
  },
  btnSmallTextBlue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  shuffleBtn: {
    backgroundColor: '#161616',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
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
    color: theme.colors.text,
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
  scoreClickBox: {
    flex: 1,
    padding: 8,
  },
  scoreClickBoxRight: {
    flex: 1,
    padding: 8,
    alignItems: 'flex-end',
  },
  scoreValRed: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ff4444',
    marginVertical: 4,
  },
  scoreValBlue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#38bdf8',
    marginVertical: 4,
  },
  tapPromptRed: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ff4444',
  },
  tapPromptBlue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38bdf8',
  },
  vsText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  undoBtn: {
    backgroundColor: '#161616',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  undoText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '600',
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
