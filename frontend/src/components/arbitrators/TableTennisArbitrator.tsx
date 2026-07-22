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

export const TableTennisArbitrator: React.FC<Props> = ({ ladder, navigation }) => {
  const { user: currentUser } = useAuth();
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Paso 1: 'setup' (Asignar Jugadores) -> Paso 2: 'live' (Marcador en Vivo)
  const [step, setStep] = useState<'setup' | 'live'>('setup');

  // Estado de Jugadores (Modalidad Fija 1v1)
  const [playerRed, setPlayerRed] = useState<StudentUser[]>([]);
  const [playerBlue, setPlayerBlue] = useState<StudentUser[]>([]);

  // Contador de Puntos Directos (0 a 11+)
  const [scoreRed, setScoreRed] = useState<number>(0);
  const [scoreBlue, setScoreBlue] = useState<number>(0);
  const [pointHistory, setPointHistory] = useState<('red' | 'blue')[]>([]);

  // Servidor Inicial (Sorteo al azar) y Rotación Oficial ITTF
  const [initialServer, setInitialServer] = useState<'red' | 'blue'>('red');

  // Buscador de Jugadores
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StudentUser[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [activeSlot, setActiveSlot] = useState<{ team: 'red' | 'blue'; index: number } | null>(null);

  // Comprobar si un jugador ya está asignado en cualquier posición
  const isPlayerAlreadySelected = (userId: string): boolean => {
    return playerRed.some((p) => p?.id === userId) || playerBlue.some((p) => p?.id === userId);
  };

  // Regla Oficial ITTF de Victoria: Mínimo 11 puntos y diferencia de al menos 2 puntos (Alargue)
  const checkIsTerminal = (red: number, blue: number): { isTerminal: boolean; winner?: 'red' | 'blue' } => {
    if (red >= 11 && red - blue >= 2) return { isTerminal: true, winner: 'red' };
    if (blue >= 11 && blue - red >= 2) return { isTerminal: true, winner: 'blue' };
    return { isTerminal: false };
  };

  const terminalState = checkIsTerminal(scoreRed, scoreBlue);
  const isTerminal = terminalState.isTerminal;

  // Detectar si la partida está en Alargue / Deuce (10 - 10 o superior)
  const isDeuce = scoreRed >= 10 && scoreBlue >= 10;

  // Calcular quién saca según las Reglas Oficiales ITTF
  const totalPoints = scoreRed + scoreBlue;
  let currentServer: 'red' | 'blue';

  if (!isDeuce) {
    // Modo normal: El saque cambia cada 2 puntos
    const serviceTurnIndex = Math.floor(totalPoints / 2);
    currentServer = serviceTurnIndex % 2 === 0 ? initialServer : initialServer === 'red' ? 'blue' : 'red';
  } else {
    // Modo Alargue (Deuce 10-10+): El saque cambia en CADA 1 PUNTO
    const deucePoints = totalPoints - 20; // Puntos desde el 10-10
    currentServer = deucePoints % 2 === 0 ? initialServer : initialServer === 'red' ? 'blue' : 'red';
  }

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

  // Pasar de Paso 1 (Setup) a Paso 2 (Marcador en Vivo) con Sorteo de Saque al Azar
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

    // Comienza siempre con Lado Rojo como sacador inicial
    setInitialServer('red');

    Toast.show({
      type: 'info',
      text1: '🏓 Partido Iniciado',
      text2: 'Comienza sacando: Lado Rojo 🔴.',
    });

    setStep('live');
  };

  // Sumar punto
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

  // Deshacer último punto
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
    if (!isTerminal) {
      Toast.show({
        type: 'error',
        text1: 'Partido En Curso',
        text2: 'La partida no ha alcanzado la puntuación de término (11 puntos con ventaja de 2).',
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
        goalHistory: pointHistory as any,
      });

      Toast.show({
        type: 'success',
        text1: '¡Partido de Tenis de Mesa Finalizado!',
        text2: `Resultado final: Rojo ${scoreRed} - ${scoreBlue} Azul. Se notificó a los jugadores.`,
      });

      navigation.navigate('LadderDetail', { slug: ladder.slug });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'No se pudo guardar el partido de Tenis de Mesa.',
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
          <Text style={styles.sportBadgeText}>TENIS DE MESA 1V1 (OFICIAL ITTF)</Text>
        </View>
        <Text style={styles.headerTitle}>Arbitraje Oficial de Tenis de Mesa</Text>
        <Text style={styles.headerSubtitle}>
          {step === 'setup'
            ? 'Paso 1: Asigna a los competidores. Se realizará un sorteo al azar para el primer saque.'
            : 'Paso 2: Rotación de saque oficial (cada 2 puntos / cada 1 punto en alargue).'}
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
              <Text style={styles.teamHeaderRed}>JUGADOR ROJO 🏓</Text>
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
              <Text style={styles.teamHeaderBlue}>JUGADOR AZUL 🏓</Text>
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

          {/* BOTÓN CONTINUAR CON SORTEO DE SAQUE */}
          <TouchableOpacity
            style={[
              styles.startMatchBtn,
              (!playerRed[0] || !playerBlue[0]) && styles.startMatchBtnDisabled,
            ]}
            activeOpacity={0.8}
            disabled={!playerRed[0] || !playerBlue[0]}
            onPress={handleStartMatch}
          >
            <Feather name="shuffle" color="#000000" size={18} style={{ marginRight: 8 }} />
            <Text style={styles.startMatchBtnText}>Sorteo de Saque e Iniciar Partido 🎲</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ========================================================================= */
        /* PASO 2: MARCADOR EN VIVO CON SAQUE Y REGLAS OFICIALES ITTF */
        /* ========================================================================= */
        <View style={styles.liveSection}>
          {/* BANNER DE ALARGUE / DEUCE SI CORRESPONDE */}
          {isDeuce && !isTerminal && (
            <View style={styles.deuceBanner}>
              <Text style={styles.deuceBannerTitle}>🔥 ALARGUE / DEUCE (10-10+)</Text>
              <Text style={styles.deuceBannerText}>
                Se requiere ventaja de 2 puntos para ganar. El saque rota CADA 1 PUNTO.
              </Text>
            </View>
          )}

          {/* HEADER JUGADORES BLOQUEADOS Y BADGE DE SAQUE 🏓 */}
          <View style={styles.lockedPlayersRow}>
            {/* Lado Rojo */}
            <View style={[styles.lockedPlayerRed, currentServer === 'red' && styles.servingPlayerBoxRed]}>
              <View style={styles.teamTagRow}>
                <Text style={styles.lockedTeamTagRed}>🔴 LADO ROJO</Text>
                {currentServer === 'red' && (
                  <View style={styles.serveBadgeRed}>
                    <Text style={styles.serveBadgeText}>SACA 🏓</Text>
                  </View>
                )}
              </View>
              <Text style={styles.lockedPlayerName} numberOfLines={1}>
                {playerRed[0]?.name}
              </Text>
            </View>

            <View style={styles.versusBadge}>
              <Text style={styles.versusText}>VS</Text>
            </View>

            {/* Lado Azul */}
            <View style={[styles.lockedPlayerBlue, currentServer === 'blue' && styles.servingPlayerBoxBlue]}>
              <View style={styles.teamTagRow}>
                <Text style={styles.lockedTeamTagBlue}>🔵 LADO AZUL</Text>
                {currentServer === 'blue' && (
                  <View style={styles.serveBadgeBlue}>
                    <Text style={styles.serveBadgeText}>SACA 🏓</Text>
                  </View>
                )}
              </View>
              <Text style={styles.lockedPlayerName} numberOfLines={1}>
                {playerBlue[0]?.name}
              </Text>
            </View>
          </View>

          {/* MARCADOR DIGITAL GIGANTE DIRECTO */}
          <View style={styles.scoreboardContainer}>
            {/* Lado Rojo */}
            <View style={[styles.scoreBoardRed, isTerminal && terminalState.winner === 'red' && styles.scoreBoardWinner]}>
              {terminalState.winner === 'red' && <Text style={styles.winnerText}>🏆 GANADOR</Text>}
              <Text style={styles.scoreNumberRed}>{scoreRed}</Text>
              <TouchableOpacity
                style={[styles.goalButtonRed, isTerminal && styles.goalButtonDisabled]}
                activeOpacity={0.7}
                disabled={isTerminal}
                onPress={() => handlePoint('red')}
              >
                <Text style={styles.goalButtonText}>+1 PUNTO ROJO</Text>
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
                onPress={() => handlePoint('blue')}
              >
                <Text style={styles.goalButtonText}>+1 PUNTO AZUL</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* INDICADOR INFORMACIÓN DE SAQUE Y ROTACIÓN */}
          <View style={styles.serviceInfoRow}>
            <Text style={styles.serviceInfoText}>
              Saque actual:{' '}
              <Text style={{ color: currentServer === 'red' ? '#ff4444' : '#38bdf8', fontWeight: '800' }}>
                Lado {currentServer === 'red' ? 'Rojo 🔴' : 'Azul 🔵'}
              </Text>{' '}
              ({isDeuce ? 'Alargue: cambia cada 1 punto' : `Cambia cada 2 puntos: ${totalPoints % 2}/2`})
            </Text>
          </View>

          {/* LÍNEA DE TIEMPO Y BOTÓN DESHACER */}
          <View style={styles.timelineRow}>
            <TouchableOpacity
              style={styles.undoBtn}
              onPress={handleUndoPoint}
              disabled={pointHistory.length === 0}
            >
              <Feather name="rotate-ccw" color="#ffffff" size={14} style={{ marginRight: 4 }} />
              <Text style={styles.undoBtnText}>Deshacer Punto</Text>
            </TouchableOpacity>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyChipsScroll}>
              {pointHistory.map((p, index) => (
                <View key={index} style={[styles.historyChip, p === 'red' ? styles.chipRed : styles.chipBlue]}>
                  <Text style={styles.chipText}>{index + 1}º {p === 'red' ? '🔴' : '🔵'}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* AVISO DE ESTADO O BOTÓN CERRAR PARTIDO */}
          {!isTerminal ? (
            <View style={styles.inProgressNoticeBox}>
              <Feather name="info" color="#eab308" size={16} style={{ marginRight: 6 }} />
              <Text style={styles.inProgressNoticeText}>
                Partida en curso. {isDeuce ? 'Alargue activo (diferencia de 2 puntos).' : 'Alcanza 11 puntos con ventaja de 2.'}
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
    backgroundColor: '#38bdf8',
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
  deuceBanner: {
    backgroundColor: '#2a1a08',
    borderRadius: 8,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#eab308',
    alignItems: 'center',
  },
  deuceBannerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#eab308',
    marginBottom: 2,
  },
  deuceBannerText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
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
    padding: theme.spacing.xs,
    borderRadius: 6,
  },
  lockedPlayerBlue: {
    flex: 1,
    alignItems: 'flex-end',
    padding: theme.spacing.xs,
    borderRadius: 6,
  },
  servingPlayerBoxRed: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  servingPlayerBoxBlue: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  teamTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  lockedTeamTagRed: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ff4444',
  },
  lockedTeamTagBlue: {
    fontSize: 10,
    fontWeight: '900',
    color: '#38bdf8',
  },
  serveBadgeRed: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  serveBadgeBlue: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  serveBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000000',
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
    marginBottom: theme.spacing.xs,
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
  serviceInfoRow: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    marginTop: 4,
  },
  serviceInfoText: {
    fontSize: 11,
    color: theme.colors.textMuted,
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
