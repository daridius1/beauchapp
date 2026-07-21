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

  const handleGoal = (team: 'red' | 'blue') => {
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
    const requiredPerTeam = mode === '1v1' ? 1 : 2;
    if (teamRed.length < requiredPerTeam || teamBlue.length < requiredPerTeam) {
      Toast.show({
        type: 'error',
        text1: 'Faltan Jugadores',
        text2: `Debes asignar ${requiredPerTeam} jugador(es) por equipo para Taca Taca (${mode}).`,
      });
      return;
    }

    if (scoreRed === 0 && scoreBlue === 0) {
      Toast.show({
        type: 'error',
        text1: 'Marcador Vacío',
        text2: 'Debes registrar al menos un gol antes de finalizar el partido.',
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
        text2: 'Se han enviado las notificaciones de confirmación a los jugadores.',
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Cabecera Específica de Taca Taca */}
      <View style={styles.sportHeader}>
        <View style={styles.sportBadge}>
          <Text style={styles.sportBadgeText}>TACA TACA BEAUCHEF</Text>
        </View>
        <Text style={styles.headerTitle}>Arbitraje de Taca Taca (2v2)</Text>
        <Text style={styles.headerSubtitle}>
          Registra el marcador gol a gol desde el teléfono. Al finalizar, los 4 jugadores recibirán una notificación de confirmación.
        </Text>
      </View>

      {/* SELECCIÓN DE JUGADORES */}
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
                        style={styles.selfAddBtn}
                        onPress={() => handleAddMyself('red', idx)}
                      >
                        <Text style={styles.selfAddBtnText}>+ Yo</Text>
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
                        style={styles.selfAddBtn}
                        onPress={() => handleAddMyself('blue', idx)}
                      >
                        <Text style={styles.selfAddBtnText}>+ Yo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* MODAL / BUSCADOR DE JUGADORES */}
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
            searchResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.searchResultItem}
                onPress={() => handleSelectPlayer(item)}
              >
                <Feather name="user" color="#888888" size={16} style={{ marginRight: 8 }} />
                <Text style={styles.searchResultText}>{item.name}</Text>
                {!!item.username && <Text style={styles.searchResultSub}>@{item.username}</Text>}
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* MARCADOR DIGITAL GIGANTE TACA TACA */}
      <View style={styles.scoreboardContainer}>
        <View style={styles.scoreBoardRed}>
          <Text style={styles.scoreNumberRed}>{scoreRed}</Text>
          <TouchableOpacity
            style={styles.goalButtonRed}
            activeOpacity={0.7}
            onPress={() => handleGoal('red')}
          >
            <Text style={styles.goalButtonText}>+1 GOL ROJO</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.scoreBoardBlue}>
          <Text style={styles.scoreNumberBlue}>{scoreBlue}</Text>
          <TouchableOpacity
            style={styles.goalButtonBlue}
            activeOpacity={0.7}
            onPress={() => handleGoal('blue')}
          >
            <Text style={styles.goalButtonText}>+1 GOL AZUL</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BOTÓN DESHACER LÍNEA DE TIEMPO */}
      {goalHistory.length > 0 && (
        <View style={styles.timelineRow}>
          <TouchableOpacity style={styles.undoBtn} onPress={handleUndoGoal}>
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
      )}

      {/* BOTÓN FINALIZAR Y CERRAR PARTIDO */}
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
            <Text style={styles.finishMatchBtnText}>Cerrar Partido de Taca Taca</Text>
          </>
        )}
      </TouchableOpacity>
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
  playersSection: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  teamContainerRed: {
    flex: 1,
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  teamContainerBlue: {
    flex: 1,
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  teamHeaderRed: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ff4444',
    marginBottom: theme.spacing.sm,
  },
  teamHeaderBlue: {
    fontSize: 12,
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
    backgroundColor: '#121212',
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
  selfAddBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
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
  searchResultText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginRight: 6,
  },
  searchResultSub: {
    fontSize: 11,
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
