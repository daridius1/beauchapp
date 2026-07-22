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

interface HistorySnap {
  scoreRed: number;
  scoreBlue: number;
  accumulator: number;
  activeTurn: 'red' | 'blue';
  actionLog: string[];
}

export const TipTapArbitrator: React.FC<Props> = ({ ladder, navigation }) => {
  const { user: currentUser } = useAuth();
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Paso 1: 'setup' (Asignar Jugadores) -> Paso 2: 'live' (Marcador en Vivo)
  const [step, setStep] = useState<'setup' | 'live'>('setup');

  // Estado de Jugadores (1v1 TipTap)
  const [playerRed, setPlayerRed] = useState<StudentUser[]>([]);
  const [playerBlue, setPlayerBlue] = useState<StudentUser[]>([]);

  // Estado del Juego TipTap
  const [scoreRed, setScoreRed] = useState<number>(0);
  const [scoreBlue, setScoreBlue] = useState<number>(0);
  const [accumulator, setAccumulator] = useState<number>(1);
  const [activeTurn, setActiveTurn] = useState<'red' | 'blue'>('red');
  const [actionLog, setActionLog] = useState<string[]>([]);

  // Pila de Deshacer (Undo Stack)
  const [undoStack, setUndoStack] = useState<HistorySnap[]>([]);

  // Buscador de Jugadores
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StudentUser[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [activeSlot, setActiveSlot] = useState<{ team: 'red' | 'blue'; index: number } | null>(null);

  // Comprobar si un jugador ya está asignado en cualquier lado
  const isPlayerAlreadySelected = (userId: string): boolean => {
    return playerRed.some((p) => p?.id === userId) || playerBlue.some((p) => p?.id === userId);
  };

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
        text2: `${student.name} ya está asignado a uno de los lados.`,
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
        text2: 'Ya has sido asignado a esta partida.',
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

  const handleRemovePlayer = (team: 'red' | 'blue') => {
    if (team === 'red') {
      setPlayerRed([]);
    } else {
      setPlayerBlue([]);
    }
  };

  // Guardar Snapshot para Deshacer
  const saveSnap = () => {
    setUndoStack((prev) => [
      ...prev,
      {
        scoreRed,
        scoreBlue,
        accumulator,
        activeTurn,
        actionLog: [...actionLog],
      },
    ]);
  };

  // Paso 1 -> Paso 2 (Iniciar Partido)
  const handleStartMatch = () => {
    if (playerRed.length < 1 || playerBlue.length < 1) {
      Toast.show({
        type: 'error',
        text1: 'Faltan Jugadores',
        text2: 'Debes asignar al jugador del Lado Rojo y del Lado Azul para iniciar.',
      });
      return;
    }
    if (playerRed[0].id === playerBlue[0].id) {
      Toast.show({
        type: 'error',
        text1: 'Jugadores Duplicados',
        text2: 'El mismo estudiante no puede jugar contra sí mismo.',
      });
      return;
    }

    // Sorteo de Turno Inicial al Azar
    const firstTurn = Math.random() < 0.5 ? 'red' : 'blue';
    setActiveTurn(firstTurn);

    Toast.show({
      type: 'info',
      text1: '🎲 Partido de TipTap Iniciado',
      text2: `Inicia jugando: Lado ${firstTurn === 'red' ? 'Rojo 🔴' : 'Azul 🔵'}.`,
    });

    setStep('live');
  };

  // BOTÓN "SIGUE" (+1 al pozo y cambio de turno)
  const handleSigue = () => {
    saveSnap();
    const currentName = activeTurn === 'red' ? playerRed[0]?.name || 'Rojo' : playerBlue[0]?.name || 'Azul';
    const nextTurn = activeTurn === 'red' ? 'blue' : 'red';
    const nextAccumulator = accumulator + 1;

    setAccumulator(nextAccumulator);
    setActiveTurn(nextTurn);
    setActionLog((prev) => [
      ...prev,
      `🟢 ${currentName} presiona SIGUE (Pozo sube a ${nextAccumulator}) -> Turno ${nextTurn === 'red' ? '🔴 Rojo' : '🔵 Azul'}`,
    ]);
  };

  // BOTÓN "PIERDE" (Oponente cobra el pozo acumulado)
  const handlePierde = () => {
    saveSnap();
    const currentName = activeTurn === 'red' ? playerRed[0]?.name || 'Rojo' : playerBlue[0]?.name || 'Azul';
    const oppName = activeTurn === 'red' ? playerBlue[0]?.name || 'Azul' : playerRed[0]?.name || 'Rojo';

    const pointsGained = accumulator;
    if (activeTurn === 'red') {
      setScoreBlue((prev) => prev + pointsGained);
    } else {
      setScoreRed((prev) => prev + pointsGained);
    }

    const oppTurn = activeTurn === 'red' ? 'blue' : 'red';
    setAccumulator(1);
    setActiveTurn(oppTurn);
    setActionLog((prev) => [
      ...prev,
      `🔴 ${currentName} presiona PIERDE -> ¡${oppName} cobra ${pointsGained} pt(s)! (Pozo se reinicia a 1)`,
    ]);
  };

  // Deshacer Acción
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const lastSnap = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    setScoreRed(lastSnap.scoreRed);
    setScoreBlue(lastSnap.scoreBlue);
    setAccumulator(lastSnap.accumulator);
    setActiveTurn(lastSnap.activeTurn);
    setActionLog(lastSnap.actionLog);
  };

  const handleSubmitMatch = async () => {
    if (scoreRed === 0 && scoreBlue === 0) {
      Toast.show({
        type: 'error',
        text1: 'Marcador Vacío',
        text2: 'Debes haber completado al menos una jugada antes de guardar la partida.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await ladderService.submitArbitratedMatch({
        ladderId: ladder.id,
        mode: '1v1',
        teamRed: playerRed.map((p) => p.id),
        teamBlue: playerBlue.map((p) => p.id),
        scoreRed,
        scoreBlue,
        goalHistory: actionLog as any,
      });

      Toast.show({
        type: 'success',
        text1: '¡Partido de TipTap Registrado!',
        text2: `Resultado final: Rojo ${scoreRed} - ${scoreBlue} Azul. Se notificó a los jugadores.`,
      });

      navigation.navigate('LadderDetail', { slug: ladder.slug });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'No se pudo guardar el partido de TipTap.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isCurrentUserInMatch = currentUser ? isPlayerAlreadySelected(currentUser.id) : false;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* CABECERA GENERAL */}
      <View style={styles.sportHeader}>
        <View style={styles.sportBadge}>
          <Text style={styles.sportBadgeText}>TIPTAP (REGLAS OFICIALES)</Text>
        </View>
        <Text style={styles.headerTitle}>Arbitraje de TipTap 1v1</Text>
        <Text style={styles.headerSubtitle}>
          {step === 'setup'
            ? 'Paso 1: Asigna a los competidores antes de iniciar la partida.'
            : 'Paso 2: Acumula el pozo con SIGUE o entrega los puntos acumulados al rival con PIERDE.'}
        </Text>
      </View>

      {/* ========================================================================= */}
      {/* PASO 1: SELECCIÓN DE JUGADORES */}
      {/* ========================================================================= */}
      {step === 'setup' ? (
        <View style={styles.setupSection}>
          <Text style={styles.stepTitleText}>Paso 1: Asignar Jugadores (1 vs 1)</Text>

          <View style={styles.playersSection}>
            {/* Jugador Lado Rojo */}
            <View style={styles.teamContainerRed}>
              <Text style={styles.teamHeaderRed}>JUGADOR ROJO 🔴</Text>
              {playerRed[0] ? (
                <View style={styles.playerSlotActive}>
                  <Text style={styles.slotPlayerName} numberOfLines={1}>
                    {playerRed[0].name}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemovePlayer('red')}>
                    <Feather name="x" color="#ff4444" size={18} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.slotRowActions}>
                  <TouchableOpacity
                    style={styles.addPlayerBtnRed}
                    onPress={() => setActiveSlot({ team: 'red', index: 0 })}
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
                      onPress={() => handleAddMyself('red')}
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

            {/* Jugador Lado Azul */}
            <View style={styles.teamContainerBlue}>
              <Text style={styles.teamHeaderBlue}>JUGADOR AZUL 🔵</Text>
              {playerBlue[0] ? (
                <View style={styles.playerSlotActive}>
                  <Text style={styles.slotPlayerName} numberOfLines={1}>
                    {playerBlue[0].name}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemovePlayer('blue')}>
                    <Feather name="x" color="#38bdf8" size={18} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.slotRowActions}>
                  <TouchableOpacity
                    style={styles.addPlayerBtnBlue}
                    onPress={() => setActiveSlot({ team: 'blue', index: 0 })}
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
                      onPress={() => handleAddMyself('blue')}
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
          </View>

          {/* BUSCADOR MODAL */}
          {activeSlot && (
            <View style={styles.searchModalBox}>
              <View style={styles.searchHeader}>
                <Text style={styles.searchTitle}>
                  Asignar Jugador ({activeSlot.team === 'red' ? 'Lado Rojo' : 'Lado Azul'})
                </Text>
                <TouchableOpacity onPress={() => setActiveSlot(null)}>
                  <Feather name="x" color="#ffffff" size={20} />
                </TouchableOpacity>
              </View>
              <View style={styles.searchInputRow}>
                <Feather name="search" color="#888888" size={16} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por nombre o @username..."
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
                      <Feather name="user" color={isSelected ? '#444444' : '#888888'} size={16} style={{ marginRight: 8 }} />
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

          {/* BOTÓN CONTINUAR A MARCADOR EN VIVO */}
          <TouchableOpacity
            style={[
              styles.startMatchBtn,
              (!playerRed[0] || !playerBlue[0]) && styles.startMatchBtnDisabled,
            ]}
            activeOpacity={0.8}
            disabled={!playerRed[0] || !playerBlue[0]}
            onPress={handleStartMatch}
          >
            <Feather name="play-circle" color="#000000" size={20} style={{ marginRight: 8 }} />
            <Text style={styles.startMatchBtnText}>Iniciar TipTap y Abrir Marcador 🚀</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ========================================================================= */
        /* PASO 2: MARCADOR EN VIVO TIPTAP */
        /* ========================================================================= */
        <View style={styles.liveSection}>
          {/* TOTALES Y JUGADORES BLOQUEADOS */}
          <View style={styles.totalsCard}>
            {/* Lado Rojo */}
            <View style={[styles.totalBox, activeTurn === 'red' && styles.totalBoxActiveRed]}>
              <Text style={styles.totalTeamTagRed}>🔴 {playerRed[0]?.name}</Text>
              <Text style={styles.totalScoreRed}>{scoreRed}</Text>
              <Text style={styles.totalLabel}>PUNTOS TOTALES</Text>
            </View>

            <View style={styles.versusBox}>
              <Text style={styles.versusText}>VS</Text>
            </View>

            {/* Lado Azul */}
            <View style={[styles.totalBox, activeTurn === 'blue' && styles.totalBoxActiveBlue]}>
              <Text style={styles.totalTeamTagBlue}>🔵 {playerBlue[0]?.name}</Text>
              <Text style={styles.totalScoreBlue}>{scoreBlue}</Text>
              <Text style={styles.totalLabel}>PUNTOS TOTALES</Text>
            </View>
          </View>

          {/* CADA POZO ACUMULADO Y TURNO ACTUAL */}
          <View style={[styles.accumulatorCard, activeTurn === 'red' ? styles.accumRedBorder : styles.accumBlueBorder]}>
            <View style={styles.turnIndicatorBadge}>
              <Text style={styles.turnIndicatorText}>
                TURNO DE: {activeTurn === 'red' ? `🔴 ${playerRed[0]?.name.toUpperCase()}` : `🔵 ${playerBlue[0]?.name.toUpperCase()}`}
              </Text>
            </View>

            <Text style={styles.accumLabel}>POZO ACUMULADO ACTUAL</Text>
            <Text style={styles.accumNumber}>{accumulator}</Text>
            <Text style={styles.accumSub}>Puntos en juego para el peloteo</Text>
          </View>

          {/* BOTONES DE ACCIÓN TIPTAP */}
          <View style={styles.actionButtonsRow}>
            {/* Botón SIGUE */}
            <TouchableOpacity
              style={styles.sigueButton}
              activeOpacity={0.8}
              onPress={handleSigue}
            >
              <Feather name="arrow-right-circle" color="#000000" size={24} style={{ marginBottom: 4 }} />
              <Text style={styles.sigueButtonText}>SIGUE 🟢</Text>
              <Text style={styles.sigueSubText}>+1 al Pozo & Pasa Turno</Text>
            </TouchableOpacity>

            {/* Botón PIERDE */}
            <TouchableOpacity
              style={styles.pierdeButton}
              activeOpacity={0.8}
              onPress={handlePierde}
            >
              <Feather name="x-circle" color="#ffffff" size={24} style={{ marginBottom: 4 }} />
              <Text style={styles.pierdeButtonText}>PIERDE 🔴</Text>
              <Text style={styles.pierdeSubText}>Oponente Cobra {accumulator} pt(s)</Text>
            </TouchableOpacity>
          </View>

          {/* HISTORIAL Y DESHACER */}
          <View style={styles.timelineRow}>
            <TouchableOpacity
              style={styles.undoBtn}
              onPress={handleUndo}
              disabled={undoStack.length === 0}
            >
              <Feather name="rotate-ccw" color="#ffffff" size={14} style={{ marginRight: 4 }} />
              <Text style={styles.undoBtnText}>Deshacer</Text>
            </TouchableOpacity>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyChipsScroll}>
              {actionLog.slice().reverse().map((log, index) => (
                <View key={index} style={styles.historyChip}>
                  <Text style={styles.chipText}>{log}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* BOTÓN FINALIZAR PARTIDO */}
          <TouchableOpacity
            style={styles.finishMatchBtn}
            activeOpacity={0.8}
            disabled={submitting || (scoreRed === 0 && scoreBlue === 0)}
            onPress={handleSubmitMatch}
          >
            {submitting ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <>
                <Feather name="check-circle" color="#000000" size={20} style={{ marginRight: 8 }} />
                <Text style={styles.finishMatchBtnText}>
                  Finalizar y Registrar TipTap ({scoreRed} - {scoreBlue}) 🏆
                </Text>
              </>
            )}
          </TouchableOpacity>
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
    backgroundColor: theme.colors.primary,
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
  totalsCard: {
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
  totalBox: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.xs,
    borderRadius: 6,
  },
  totalBoxActiveRed: {
    backgroundColor: 'rgba(255, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  totalBoxActiveBlue: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  totalTeamTagRed: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ff4444',
    marginBottom: 2,
  },
  totalTeamTagBlue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
    marginBottom: 2,
  },
  totalScoreRed: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ff4444',
  },
  totalScoreBlue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#38bdf8',
  },
  totalLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textMuted,
  },
  versusBox: {
    marginHorizontal: theme.spacing.xs,
  },
  versusText: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.colors.textMuted,
  },
  accumulatorCard: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderWidth: 2,
  },
  accumRedBorder: {
    borderColor: '#ff4444',
  },
  accumBlueBorder: {
    borderColor: '#38bdf8',
  },
  turnIndicatorBadge: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  turnIndicatorText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text,
  },
  accumLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  accumNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: '#ffffff',
    marginVertical: 4,
  },
  accumSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sigueButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigueButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  sigueSubText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#444444',
    marginTop: 2,
  },
  pierdeButton: {
    flex: 1,
    backgroundColor: '#ff4444',
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pierdeButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
  },
  pierdeSubText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 2,
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
    backgroundColor: '#121212',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
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
