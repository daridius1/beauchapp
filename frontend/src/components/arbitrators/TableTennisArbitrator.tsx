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

  // Estado del Partido (1v1 o 2v2)
  const [mode, setMode] = useState<'1v1' | '2v2'>('1v1');
  const [playerRed, setPlayerRed] = useState<StudentUser[]>([]);
  const [playerBlue, setPlayerBlue] = useState<StudentUser[]>([]);

  // Contador de Sets y Puntos (Tenis de Mesa)
  const [setsRed, setSetsRed] = useState<number>(0);
  const [setsBlue, setSetsBlue] = useState<number>(0);
  const [pointsRed, setPointsRed] = useState<number>(0);
  const [pointsBlue, setPointsBlue] = useState<number>(0);
  const [pointHistory, setPointHistory] = useState<string[]>([]);

  // Buscador de Jugadores
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StudentUser[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [activeSlot, setActiveSlot] = useState<{ team: 'red' | 'blue'; index: number } | null>(null);

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

  const handleAddMyself = (team: 'red' | 'blue', index: number) => {
    if (!currentUser) return;
    const student: StudentUser = {
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username,
      avatar: currentUser.avatar,
    };

    if (team === 'red') {
      const updated = [...playerRed];
      updated[index] = student;
      setPlayerRed(updated);
    } else {
      const updated = [...playerBlue];
      updated[index] = student;
      setPlayerBlue(updated);
    }
  };

  const handleRemovePlayer = (team: 'red' | 'blue', index: number) => {
    if (team === 'red') {
      const updated = [...playerRed];
      updated.splice(index, 1);
      setPlayerRed(updated);
    } else {
      const updated = [...playerBlue];
      updated.splice(index, 1);
      setPlayerBlue(updated);
    }
  };

  // Punto anotado
  const handlePoint = (team: 'red' | 'blue') => {
    if (team === 'red') {
      const nextPts = pointsRed + 1;
      setPointsRed(nextPts);
      setPointHistory((prev) => [...prev, `Punto Rojo (${nextPts}-${pointsBlue})`]);
    } else {
      const nextPts = pointsBlue + 1;
      setPointsBlue(nextPts);
      setPointHistory((prev) => [...prev, `Punto Azul (${pointsRed}-${nextPts})`]);
    }
  };

  // Ganar Set actual
  const handleWinSet = (team: 'red' | 'blue') => {
    if (team === 'red') {
      setSetsRed((prev) => prev + 1);
      setPointHistory((prev) => [...prev, `Set Rojo (${pointsRed}-${pointsBlue})`]);
      setPointsRed(0);
      setPointsBlue(0);
    } else {
      setSetsBlue((prev) => prev + 1);
      setPointHistory((prev) => [...prev, `Set Azul (${pointsRed}-${pointsBlue})`]);
      setPointsRed(0);
      setPointsBlue(0);
    }
  };

  const handleSubmitMatch = async () => {
    const requiredPerTeam = mode === '1v1' ? 1 : 2;
    if (playerRed.length < requiredPerTeam || playerBlue.length < requiredPerTeam) {
      Toast.show({
        type: 'error',
        text1: 'Faltan Jugadores',
        text2: `Debes asignar ${requiredPerTeam} jugador(es) por lado.`,
      });
      return;
    }

    if (setsRed === 0 && setsBlue === 0 && pointsRed === 0 && pointsBlue === 0) {
      Toast.show({
        type: 'error',
        text1: 'Marcador Vacío',
        text2: 'Debes registrar al menos sets o puntos en la partida de Tenis de Mesa.',
      });
      return;
    }

    setSubmitting(true);
    try {
      // El marcador del partido en Tenis de Mesa reporta Sets Ganados o Puntos
      const finalScoreRed = setsRed > 0 || setsBlue > 0 ? setsRed : pointsRed;
      const finalScoreBlue = setsRed > 0 || setsBlue > 0 ? setsBlue : pointsBlue;

      await ladderService.submitArbitratedMatch({
        ladderId: ladder.id,
        mode,
        teamRed: playerRed.map((p) => p.id),
        teamBlue: playerBlue.map((p) => p.id),
        scoreRed: finalScoreRed,
        scoreBlue: finalScoreBlue,
        goalHistory: pointHistory as any,
      });

      Toast.show({
        type: 'success',
        text1: '¡Partido de Tenis de Mesa Registrado!',
        text2: 'Se han enviado las notificaciones de confirmación a los jugadores.',
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

  const maxSlots = mode === '1v1' ? 1 : 2;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Cabecera Específica de Tenis de Mesa */}
      <View style={styles.sportHeader}>
        <View style={styles.sportBadge}>
          <Text style={styles.sportBadgeText}>TENIS DE MESA BEAUCHEF</Text>
        </View>
        <Text style={styles.headerTitle}>Arbitraje de Tenis de Mesa (Ping Pong)</Text>
        <Text style={styles.headerSubtitle}>
          Lleva el conteo de puntos y sets en tiempo real. Al finalizar la partida se notificará a los jugadores.
        </Text>
      </View>

      {/* MODALIDAD SWITCHER (1v1 / 2v2) */}
      <View style={styles.modeSwitchRow}>
        <TouchableOpacity
          style={[styles.modeSwitchBtn, mode === '1v1' && styles.modeSwitchBtnActive]}
          onPress={() => setMode('1v1')}
        >
          <Text style={[styles.modeSwitchText, mode === '1v1' && styles.modeSwitchTextActive]}>1 vs 1 (Individuales)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeSwitchBtn, mode === '2v2' && styles.modeSwitchBtnActive]}
          onPress={() => setMode('2v2')}
        >
          <Text style={[styles.modeSwitchText, mode === '2v2' && styles.modeSwitchTextActive]}>2 vs 2 (Dobles)</Text>
        </TouchableOpacity>
      </View>

      {/* SELECCIÓN DE JUGADORES */}
      <View style={styles.playersSection}>
        {/* Jugador(es) Lado Rojo */}
        <View style={styles.teamContainerRed}>
          <Text style={styles.teamHeaderRed}>LADO ROJO 🏓</Text>
          {Array.from({ length: maxSlots }).map((_, idx) => {
            const player = playerRed[idx];
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

        {/* Jugador(es) Lado Azul */}
        <View style={styles.teamContainerBlue}>
          <Text style={styles.teamHeaderBlue}>LADO AZUL 🏓</Text>
          {Array.from({ length: maxSlots }).map((_, idx) => {
            const player = playerBlue[idx];
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

      {/* MARCADOR DE SETS & PUNTOS TENIS DE MESA */}
      <View style={styles.setsBox}>
        <Text style={styles.setsTitle}>SETS GANADOS</Text>
        <View style={styles.setsScoreRow}>
          <Text style={styles.setsRedText}>{setsRed}</Text>
          <Text style={styles.setsDividerText}>SETS</Text>
          <Text style={styles.setsBlueText}>{setsBlue}</Text>
        </View>
      </View>

      <View style={styles.scoreboardContainer}>
        {/* Lado Rojo Puntos */}
        <View style={styles.scoreBoardRed}>
          <Text style={styles.scoreLabel}>Puntos Set Actual</Text>
          <Text style={styles.scoreNumberRed}>{pointsRed}</Text>
          
          <View style={styles.pointsActionRow}>
            <TouchableOpacity style={styles.pointBtnRed} onPress={() => handlePoint('red')}>
              <Text style={styles.pointBtnText}>+1 Punto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.winSetBtnRed} onPress={() => handleWinSet('red')}>
              <Text style={styles.winSetBtnText}>Ganó Set 🏆</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Lado Azul Puntos */}
        <View style={styles.scoreBoardBlue}>
          <Text style={styles.scoreLabel}>Puntos Set Actual</Text>
          <Text style={styles.scoreNumberBlue}>{pointsBlue}</Text>

          <View style={styles.pointsActionRow}>
            <TouchableOpacity style={styles.pointBtnBlue} onPress={() => handlePoint('blue')}>
              <Text style={styles.pointBtnText}>+1 Punto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.winSetBtnBlue} onPress={() => handleWinSet('blue')}>
              <Text style={styles.winSetBtnText}>Ganó Set 🏆</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
            <Text style={styles.finishMatchBtnText}>Cerrar Partido de Tenis de Mesa</Text>
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
  modeSwitchRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBg,
    borderRadius: 6,
    padding: 4,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeSwitchBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 4,
  },
  modeSwitchBtnActive: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeSwitchText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  modeSwitchTextActive: {
    color: theme.colors.text,
    fontWeight: '800',
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
  setsBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  setsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  setsScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setsRedText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ff4444',
  },
  setsDividerText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
    marginHorizontal: 12,
  },
  setsBlueText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#38bdf8',
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
  scoreLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  scoreNumberRed: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ff4444',
    marginVertical: 4,
  },
  scoreNumberBlue: {
    fontSize: 48,
    fontWeight: '900',
    color: '#38bdf8',
    marginVertical: 4,
  },
  pointsActionRow: {
    width: '100%',
    gap: 6,
  },
  pointBtnRed: {
    backgroundColor: '#ff4444',
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  winSetBtnRed: {
    backgroundColor: '#1a1212',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  winSetBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  pointBtnBlue: {
    backgroundColor: '#38bdf8',
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  winSetBtnBlue: {
    backgroundColor: '#12171a',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  pointBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
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
