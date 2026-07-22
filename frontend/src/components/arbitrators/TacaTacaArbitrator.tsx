import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
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

export const TacaTacaArbitrator: React.FC<Props> = ({ ladder, navigation }) => {
  const { user: currentUser } = useAuth();
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Paso 1: 'setup' (Asignar Jugadores) -> Paso 2: 'live' (Marcador en Vivo)
  const [step, setStep] = useState<'setup' | 'live'>('setup');

  // Estado del Partido 2v2 Taca Taca
  const [mode, setMode] = useState<'1v1' | '2v2'>('2v2');
  const [teamRed, setTeamRed] = useState<StudentUser[]>([]);
  const [teamBlue, setTeamBlue] = useState<StudentUser[]>([]);
  const [scoreRed, setScoreRed] = useState<number>(0);
  const [scoreBlue, setScoreBlue] = useState<number>(0);
  const [goalHistory, setGoalHistory] = useState<('red' | 'blue')[]>([]);

  // Búsqueda de Jugadores
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StudentUser[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [activeSlot, setActiveSlot] = useState<{ team: 'red' | 'blue'; index: number } | null>(null);

  const targetScore = ladder.max_score || 5;

  // Comprobar si un jugador ya está asignado en cualquier posición de cualquier equipo
  const isPlayerAlreadySelected = (userId: string): boolean => {
    return teamRed.some((p) => p?.id === userId) || teamBlue.some((p) => p?.id === userId);
  };

  // Regla de victoria en Taca Taca: Llegar a max_score (ej. 5 goles)
  const checkIsTerminal = (red: number, blue: number): { isTerminal: boolean; winner?: 'red' | 'blue' } => {
    if (red >= targetScore) return { isTerminal: true, winner: 'red' };
    if (blue >= targetScore) return { isTerminal: true, winner: 'blue' };
    return { isTerminal: false };
  };

  const terminalState = checkIsTerminal(scoreRed, scoreBlue);
  const isTerminal = terminalState.isTerminal;

  useEffect(() => {
    if (ladder.allowed_modes && ladder.allowed_modes.length === 1) {
      setMode(ladder.allowed_modes[0] as '1v1' | '2v2');
    }
  }, [ladder]);

  // Buscar estudiantes en PocketBase
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
        text2: `${student.name} ya está asignado a uno de los equipos.`,
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

  const handleAddMyself = (team: 'red' | 'blue', index: number) => {
    if (!currentUser) return;
    if (isPlayerAlreadySelected(currentUser.id)) {
      Toast.show({
        type: 'error',
        text1: 'Ya estás en la lista',
        text2: 'Ya has sido asignado a un equipo en esta partida.',
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
      const updated = [...teamRed];
      updated[index] = student;
      setTeamRed(updated);
    } else {
      const updated = [...teamBlue];
      updated[index] = student;
      setTeamBlue(updated);
    }
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

  // Pasar de Paso 1 (Setup) a Paso 2 (Marcador en Vivo)
  const handleStartMatch = () => {
    const requiredPerTeam = mode === '1v1' ? 1 : 2;
    if (teamRed.length < requiredPerTeam || teamBlue.length < requiredPerTeam) {
      Toast.show({
        type: 'error',
        text1: 'Faltan Jugadores',
        text2: `Debes asignar ${requiredPerTeam} jugador(es) por equipo para Taca Taca (${mode}).`,
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
    if (!isTerminal) {
      Toast.show({
        type: 'error',
        text1: 'Partido En Curso',
        text2: `La partida de Taca Taca finaliza cuando un equipo alcance ${targetScore} goles.`,
      });
      return;
    }

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
        text1: '¡Partido de Taca Taca Registrado!',
        text2: `Resultado final: Rojo ${scoreRed} - ${scoreBlue} Azul. Se notificó a los jugadores.`,
      });

      navigation.navigate('LadderDetail', { slug: ladder.slug });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'No se pudo guardar el partido de Taca Taca.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const maxSlots = mode === '1v1' ? 1 : 2;
  const isCurrentUserInMatch = currentUser ? isPlayerAlreadySelected(currentUser.id) : false;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* CABECERA GENERAL */}
      <View style={styles.sportHeader}>
        <View style={styles.sportBadge}>
          <Text style={styles.sportBadgeText}>TACA TACA BEAUCHEF (2V2)</Text>
        </View>
        <Text style={styles.headerTitle}>Arbitraje de Taca Taca</Text>
        <Text style={styles.headerSubtitle}>
          {step === 'setup'
            ? 'Paso 1: Asigna a las parejas competidoras antes de iniciar la partida.'
            : `Paso 2: Registra los goles en vivo. La partida finaliza al alcanzar los ${targetScore} goles.`}
        </Text>
      </View>

      {/* ========================================================================= */}
      {/* PASO 1: SELECCIÓN DE JUGADORES (SETUP) */}
      {/* ========================================================================= */}
      {step === 'setup' ? (
        <View style={styles.setupSection}>
          <Text style={styles.stepTitleText}>Paso 1: Asignar Equipos (2 vs 2)</Text>

          <View style={styles.playersSection}>
            {/* Equipo Rojo */}
            <View style={styles.teamContainerRed}>
              <Text style={styles.teamHeaderRed}>EQUIPO ROJO 🔴</Text>
              {Array.from({ length: maxSlots }).map((_, idx) => {
                const player = teamRed[idx];
                return (
                  <View key={`red-${idx}`} style={styles.slotRow}>
                    {player ? (
                      <View style={styles.playerSlotActive}>
                        <Text style={styles.slotPlayerName} numberOfLines={1}>
                          {player.name}
                        </Text>
                        <TouchableOpacity onPress={() => handleRemovePlayer('red', idx)}>
                          <Feather name="x" color="#ff4444" size={18} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.slotRowActions}>
                        <TouchableOpacity
                          style={styles.addPlayerBtnRed}
                          onPress={() => setActiveSlot({ team: 'red', index: idx })}
                        >
                          <Feather name="user-plus" color="#ff4444" size={14} style={{ marginRight: 4 }} />
                          <Text style={styles.addPlayerBtnTextRed}>Buscar</Text>
                        </TouchableOpacity>
                        {currentUser && (
                          <TouchableOpacity
                            style={[
                              styles.selfAddBtn,
                              isCurrentUserInMatch && styles.selfAddBtnDisabled,
                            ]}
                            disabled={isCurrentUserInMatch}
                            onPress={() => handleAddMyself('red', idx)}
                          >
                            <Text
                              style={[
                                styles.selfAddBtnText,
                                isCurrentUserInMatch && styles.selfAddBtnTextDisabled,
                              ]}
                            >
                              + Yo
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Equipo Azul */}
            <View style={styles.teamContainerBlue}>
              <Text style={styles.teamHeaderBlue}>EQUIPO AZUL 🔵</Text>
              {Array.from({ length: maxSlots }).map((_, idx) => {
                const player = teamBlue[idx];
                return (
                  <View key={`blue-${idx}`} style={styles.slotRow}>
                    {player ? (
                      <View style={styles.playerSlotActive}>
                        <Text style={styles.slotPlayerName} numberOfLines={1}>
                          {player.name}
                        </Text>
                        <TouchableOpacity onPress={() => handleRemovePlayer('blue', idx)}>
                          <Feather name="x" color="#38bdf8" size={18} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.slotRowActions}>
                        <TouchableOpacity
                          style={styles.addPlayerBtnBlue}
                          onPress={() => setActiveSlot({ team: 'blue', index: idx })}
                        >
                          <Feather name="user-plus" color="#38bdf8" size={14} style={{ marginRight: 4 }} />
                          <Text style={styles.addPlayerBtnTextBlue}>Buscar</Text>
                        </TouchableOpacity>
                        {currentUser && (
                          <TouchableOpacity
                            style={[
                              styles.selfAddBtn,
                              isCurrentUserInMatch && styles.selfAddBtnDisabled,
                            ]}
                            disabled={isCurrentUserInMatch}
                            onPress={() => handleAddMyself('blue', idx)}
                          >
                            <Text
                              style={[
                                styles.selfAddBtnText,
                                isCurrentUserInMatch && styles.selfAddBtnTextDisabled,
                              ]}
                            >
                              + Yo
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* BUSCADOR MODAL */}
          {activeSlot && (
            <View style={styles.searchModalBox}>
              <View style={styles.searchHeader}>
                <Text style={styles.searchTitle}>
                  Asignar Jugador ({activeSlot.team === 'red' ? 'Equipo Rojo' : 'Equipo Azul'})
                </Text>
                <TouchableOpacity onPress={() => setActiveSlot(null)}>
                  <Feather name="x" color="#ffffff" size={20} />
                </TouchableOpacity>
              </View>
              <View style={styles.searchInputRow}>
                <Feather name="search" color="#888888" size={16} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar estudiante..."
                  placeholderTextColor="#666666"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
              </View>
              {searching ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
              ) : (
                searchResults.map((item) => {
                  const isSelected = isPlayerAlreadySelected(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.searchResultItem, isSelected && styles.searchResultItemDisabled]}
                      disabled={isSelected}
                      onPress={() => handleSelectPlayer(item)}
                    >
                      <Feather name="user" color={isSelected ? "#444444" : "#888888"} size={16} style={{ marginRight: 8 }} />
                      <Text style={[styles.searchResultText, isSelected && styles.searchResultTextDisabled]}>
                        {item.name} {isSelected && '(Ya seleccionado)'}
                      </Text>
                      {!!item.username && <Text style={styles.searchResultSub}>@{item.username}</Text>}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* BOTÓN INICIAR PARTIDO */}
          <TouchableOpacity
            style={[
              styles.startMatchBtn,
              (teamRed.length < maxSlots || teamBlue.length < maxSlots) && styles.startMatchBtnDisabled,
            ]}
            activeOpacity={0.8}
            disabled={teamRed.length < maxSlots || teamBlue.length < maxSlots}
            onPress={handleStartMatch}
          >
            <Feather name="play-circle" color="#000000" size={20} style={{ marginRight: 8 }} />
            <Text style={styles.startMatchBtnText}>Iniciar Partido y Abrir Marcador 🚀</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ========================================================================= */
        /* PASO 2: MARCADOR EN VIVO (JUGADORES BLOQUEADOS) */
        /* ========================================================================= */
        <View style={styles.liveSection}>
          {/* JUGADORES BLOQUEADOS */}
          <View style={styles.lockedPlayersRow}>
            <View style={styles.lockedPlayerRed}>
              <Text style={styles.lockedTeamTagRed}>🔴 EQUIPO ROJO</Text>
              {teamRed.map((p) => (
                <Text key={p.id} style={styles.lockedPlayerName} numberOfLines={1}>
                  {p.name}
                </Text>
              ))}
            </View>

            <View style={styles.versusBadge}>
              <Text style={styles.versusText}>VS</Text>
            </View>

            <View style={styles.lockedPlayerBlue}>
              <Text style={styles.lockedTeamTagBlue}>🔵 EQUIPO AZUL</Text>
              {teamBlue.map((p) => (
                <Text key={p.id} style={styles.lockedPlayerName} numberOfLines={1}>
                  {p.name}
                </Text>
              ))}
            </View>
          </View>

          {/* MARCADOR DIGITAL GIGANTE */}
          <View style={styles.scoreboardContainer}>
            {/* Lado Rojo */}
            <View style={[styles.scoreBoardRed, isTerminal && terminalState.winner === 'red' && styles.scoreBoardWinner]}>
              {terminalState.winner === 'red' && <Text style={styles.winnerText}>🏆 GANADOR</Text>}
              <Text style={styles.scoreNumberRed}>{scoreRed}</Text>
              <TouchableOpacity
                style={[styles.goalButtonRed, isTerminal && styles.goalButtonDisabled]}
                activeOpacity={0.7}
                disabled={isTerminal}
                onPress={() => handleGoal('red')}
              >
                <Text style={styles.goalButtonText}>+1 GOL ROJO</Text>
              </TouchableOpacity>
            </View>

            {/* Lado Azul */}
            <View style={[styles.scoreBoardBlue, isTerminal && terminalState.winner === 'blue' && styles.scoreBoardWinner]}>
              {terminalState.winner === 'blue' && <Text style={styles.winnerText}>🏆 GANADOR</Text>}
              <Text style={styles.scoreNumberBlue}>{scoreBlue}</Text>
              <TouchableOpacity
                style={[styles.goalButtonBlue, isTerminal && styles.goalButtonDisabled]}
                activeOpacity={0.7}
                disabled={isTerminal}
                onPress={() => handleGoal('blue')}
              >
                <Text style={styles.goalButtonText}>+1 GOL AZUL</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* LÍNEA DE TIEMPO Y DESHACER */}
          <View style={styles.timelineRow}>
            <TouchableOpacity
              style={styles.undoBtn}
              onPress={handleUndoGoal}
              disabled={goalHistory.length === 0}
            >
              <Feather name="rotate-ccw" color="#ffffff" size={14} style={{ marginRight: 4 }} />
              <Text style={styles.undoBtnText}>Deshacer Gol</Text>
            </TouchableOpacity>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyChipsScroll}>
              {goalHistory.map((g, index) => (
                <View key={index} style={[styles.historyChip, g === 'red' ? styles.chipRed : styles.chipBlue]}>
                  <Text style={styles.chipText}>{index + 1}º {g === 'red' ? '🔴' : '🔵'}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* AVISO DE ESTADO O BOTÓN CERRAR PARTIDO */}
          {!isTerminal ? (
            <View style={styles.inProgressNoticeBox}>
              <Feather name="info" color="#eab308" size={16} style={{ marginRight: 6 }} />
              <Text style={styles.inProgressNoticeText}>
                Partido en juego. Para finalizar, un equipo debe alcanzar {targetScore} goles.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.finishMatchBtn}
              activeOpacity={0.8}
              disabled={submitting}
              onPress={handleSubmitMatch}
            >
              {submitting ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <>
                  <Feather name="check-circle" color="#000000" size={20} style={{ marginRight: 8 }} />
                  <Text style={styles.finishMatchBtnText}>
                    Finalizar y Registrar Partido ({scoreRed} - {scoreBlue}) 🏆
                  </Text>
                </>
              )}
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
  sportHeader: {
    marginBottom: theme.spacing.md,
  },
  sportBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ff4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  sportBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  setupSection: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stepTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  playersSection: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  teamContainerRed: {
    flex: 1,
    backgroundColor: '#121212',
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  teamContainerBlue: {
    flex: 1,
    backgroundColor: '#121212',
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  teamHeaderRed: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ff4444',
    marginBottom: theme.spacing.sm,
  },
  teamHeaderBlue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
    marginBottom: theme.spacing.sm,
  },
  slotRow: {
    marginBottom: theme.spacing.xs,
  },
  slotRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerSlotActive: {
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotPlayerName: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  addPlayerBtnRed: {
    flex: 1,
    backgroundColor: '#1a1212',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.4)',
  },
  addPlayerBtnTextRed: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ff4444',
  },
  addPlayerBtnBlue: {
    flex: 1,
    backgroundColor: '#12171a',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  addPlayerBtnTextBlue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  selfAddBtn: {
    backgroundColor: '#222222',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#444444',
  },
  selfAddBtnDisabled: {
    opacity: 0.3,
    backgroundColor: '#121212',
    borderColor: '#222222',
  },
  selfAddBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  selfAddBtnTextDisabled: {
    color: '#666666',
  },
  searchModalBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  searchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 6,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xs,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    paddingVertical: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchResultItemDisabled: {
    opacity: 0.4,
  },
  searchResultText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginRight: 6,
  },
  searchResultTextDisabled: {
    color: '#888888',
  },
  searchResultSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  startMatchBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  startMatchBtnDisabled: {
    opacity: 0.4,
  },
  startMatchBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  liveSection: {
    flex: 1,
  },
  lockedPlayersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  lockedPlayerRed: {
    flex: 1,
    alignItems: 'flex-start',
  },
  lockedPlayerBlue: {
    flex: 1,
    alignItems: 'flex-end',
  },
  lockedTeamTagRed: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ff4444',
    marginBottom: 2,
  },
  lockedTeamTagBlue: {
    fontSize: 10,
    fontWeight: '900',
    color: '#38bdf8',
    marginBottom: 2,
  },
  lockedPlayerName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  versusBadge: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginHorizontal: theme.spacing.xs,
  },
  versusText: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.textMuted,
  },
  scoreboardContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  scoreBoardRed: {
    flex: 1,
    backgroundColor: '#1a0d0d',
    borderRadius: 8,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ff4444',
  },
  scoreBoardBlue: {
    flex: 1,
    backgroundColor: '#0d161a',
    borderRadius: 8,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  scoreBoardWinner: {
    borderColor: '#eab308',
    backgroundColor: '#1a180d',
  },
  winnerText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#eab308',
    marginBottom: 2,
  },
  scoreNumberRed: {
    fontSize: 56,
    fontWeight: '900',
    color: '#ff4444',
    marginVertical: theme.spacing.xs,
  },
  scoreNumberBlue: {
    fontSize: 56,
    fontWeight: '900',
    color: '#38bdf8',
    marginVertical: theme.spacing.xs,
  },
  goalButtonRed: {
    backgroundColor: '#ff4444',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  goalButtonBlue: {
    backgroundColor: '#38bdf8',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  goalButtonDisabled: {
    opacity: 0.3,
  },
  goalButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  undoBtn: {
    backgroundColor: '#222222',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: '#444444',
  },
  undoBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  historyChipsScroll: {
    flex: 1,
  },
  historyChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 4,
    borderWidth: 1,
  },
  chipRed: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    borderColor: '#ff4444',
  },
  chipBlue: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  inProgressNoticeBox: {
    backgroundColor: '#121212',
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#333333',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inProgressNoticeText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  finishMatchBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  finishMatchBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
});
