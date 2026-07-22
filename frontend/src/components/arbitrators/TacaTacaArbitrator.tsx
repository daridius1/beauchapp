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

export const TacaTacaArbitrator: React.FC<Props> = ({ ladder, navigation }) => {
  const { user: currentUser } = useAuth();
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [step, setStep] = useState<'setup' | 'live'>('setup');
  const [mode, setMode] = useState<'1v1' | '2v2'>('2v2');

  const [teamRed, setTeamRed] = useState<StudentUser[]>([]);
  const [teamBlue, setTeamBlue] = useState<StudentUser[]>([]);

  const [scoreRed, setScoreRed] = useState<number>(0);
  const [scoreBlue, setScoreBlue] = useState<number>(0);
  const [goalHistory, setGoalHistory] = useState<('red' | 'blue')[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StudentUser[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [activeSlot, setActiveSlot] = useState<{ team: 'red' | 'blue'; index: number } | null>(null);

  const maxSlots = mode === '1v1' ? 1 : 2;
  const targetScore = ladder.max_score || 7;

  // Pre-seleccionar al usuario actual en el Equipo Rojo (slot 0) por defecto
  useEffect(() => {
    if (currentUser && teamRed.length === 0 && teamBlue.length === 0) {
      setTeamRed([{
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        avatar: currentUser.avatar,
      }]);
    }
  }, [currentUser]);

  const isTerminal = scoreRed >= targetScore || scoreBlue >= targetScore;

  const isPlayerAlreadySelected = (userId: string): boolean => {
    return teamRed.some((p) => p?.id === userId) || teamBlue.some((p) => p?.id === userId);
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
      const updated = [...teamRed];
      updated[activeSlot.index] = student;
      setTeamRed(updated);
    } else {
      const updated = [...teamBlue];
      updated[activeSlot.index] = student;
      setTeamBlue(updated);
    }

    setActiveSlot(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const shuffleOpacity = React.useRef(new Animated.Value(1)).current;
  const shuffleScale = React.useRef(new Animated.Value(1)).current;

  const handleShuffleTeams = () => {
    if (teamRed.length === 0 && teamBlue.length === 0) return;
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
        const tempRed = [...teamRed];
        const tempBlue = [...teamBlue];
        setTeamRed(tempBlue);
        setTeamBlue(tempRed);
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
    if (teamRed.length === 0 && teamBlue.length === 0) return;
    if (isShuffling) return;

    setIsShuffling(true);

    Animated.parallel([
      Animated.timing(shuffleOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(shuffleScale, {
        toValue: 0.95,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const tempRed = [...teamRed];
      const tempBlue = [...teamBlue];
      setTeamRed(tempBlue);
      setTeamBlue(tempRed);

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(shuffleOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(shuffleScale, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsShuffling(false);
        });
      }, 200);
    });
  };

  const handleRemovePlayer = (team: 'red' | 'blue', index: number) => {
    if (team === 'red') {
      const updated = [...teamRed];
      updated.splice(index, 1);
      setTeamRed(updated);
    } else {
      const updated = [...teamBlue];
      updated.splice(index, 1);
      setTeamBlue(updated);
    }
  };

  const handleStartMatch = () => {
    const requiredPerTeam = mode === '1v1' ? 1 : 2;
    if (teamRed.length < requiredPerTeam || teamBlue.length < requiredPerTeam) {
      Toast.show({
        type: 'error',
        text1: 'Faltan Jugadores',
        text2: `Debes asignar ${requiredPerTeam} jugador(es) por equipo.`,
      });
      return;
    }
    setStep('live');
  };

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {step === 'setup' ? (
        <View style={styles.setupContainer}>
          {/* Selector 1v1 / 2v2 */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeTab, mode === '1v1' && styles.modeTabActive]}
              onPress={() => { setMode('1v1'); setTeamRed([]); setTeamBlue([]); }}
            >
              <Text style={[styles.modeTabText, mode === '1v1' && styles.modeTabTextActive]}>1 vs 1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === '2v2' && styles.modeTabActive]}
              onPress={() => { setMode('2v2'); setTeamRed([]); setTeamBlue([]); }}
            >
              <Text style={[styles.modeTabText, mode === '2v2' && styles.modeTabTextActive]}>2 vs 2</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={{ opacity: shuffleOpacity, transform: [{ scale: shuffleScale }] }}>
            <View style={styles.playersGrid}>
              {/* Rojo */}
              <View style={styles.playerBox}>
                <Text style={styles.redLabel}>EQUIPO ROJO</Text>
                {Array.from({ length: maxSlots }).map((_, idx) => {
                  const player = teamRed[idx];
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

              {/* Azul */}
              <View style={styles.playerBox}>
                <Text style={styles.blueLabel}>EQUIPO AZUL</Text>
                {Array.from({ length: maxSlots }).map((_, idx) => {
                  const player = teamBlue[idx];
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
              style={[styles.secondaryBtn, (teamRed.length === 0 && teamBlue.length === 0) && styles.disabled]}
              disabled={teamRed.length === 0 && teamBlue.length === 0}
              onPress={handleShuffleTeams}
            >
              <Feather name="shuffle" color={theme.colors.text} size={14} style={{ marginRight: 6 }} />
              <Text style={styles.btnText}>Sortear Lados</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, (teamRed.length === 0 && teamBlue.length === 0) && styles.disabled]}
              disabled={teamRed.length === 0 && teamBlue.length === 0}
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
            style={[styles.primaryBtn, (teamRed.length < maxSlots || teamBlue.length < maxSlots) && styles.disabled]}
            disabled={teamRed.length < maxSlots || teamBlue.length < maxSlots}
            onPress={handleStartMatch}
          >
            <Text style={styles.primaryBtnText}>Iniciar Partido</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* MARCADOR EN VIVO */
        <View style={styles.liveContainer}>
          <View style={styles.scoreRowCard}>
            <TouchableOpacity style={styles.scoreClickBox} onPress={() => handleGoal('red')} disabled={isTerminal}>
              <Text style={styles.redLabel}>{teamRed.map((p) => p.name).join(' & ') || 'ROJO'}</Text>
              <Text style={styles.scoreValRed}>{scoreRed}</Text>
              <Text style={styles.tapPromptRed}>+ Gol</Text>
            </TouchableOpacity>

            <Text style={styles.vsText}>VS</Text>

            <TouchableOpacity style={styles.scoreClickBoxRight} onPress={() => handleGoal('blue')} disabled={isTerminal}>
              <Text style={styles.blueLabel}>{teamBlue.map((p) => p.name).join(' & ') || 'AZUL'}</Text>
              <Text style={styles.scoreValBlue}>{scoreBlue}</Text>
              <Text style={styles.tapPromptBlue}>+ Gol</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.historyRow}>
            <TouchableOpacity style={styles.undoBtn} onPress={handleUndoGoal} disabled={goalHistory.length === 0}>
              <Feather name="rotate-ccw" color="#ffffff" size={14} style={{ marginRight: 4 }} />
              <Text style={styles.undoText}>Deshacer gol</Text>
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
    backgroundColor: '#141414',
    borderRadius: 6,
    padding: 3,
    marginBottom: theme.spacing.sm,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 4,
  },
  modeTabActive: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  modeTabTextActive: {
    color: theme.colors.text,
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
