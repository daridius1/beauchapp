import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Animated } from 'react-native';
import { theme } from '../../theme/theme';
import { pb } from '../../services/pocketbase';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../Avatar';
import Toast from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';

export interface StudentUser {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
}

interface Props {
  mode: '1v1' | '2v2';
  onChangeMode?: (mode: '1v1' | '2v2') => void;
  showModeSelector?: boolean;
  teamRed: StudentUser[];
  setTeamRed: (team: StudentUser[]) => void;
  teamBlue: StudentUser[];
  setTeamBlue: (team: StudentUser[]) => void;
  onStartMatch: () => void;
}

export const MatchSetupStep: React.FC<Props> = ({
  mode,
  onChangeMode,
  showModeSelector = true,
  teamRed,
  setTeamRed,
  teamBlue,
  setTeamBlue,
  onStartMatch,
}) => {
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StudentUser[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [activeSlot, setActiveSlot] = useState<{ team: 'red' | 'blue'; index: number } | null>(null);

  const maxSlots = mode === '1v1' ? 1 : 2;

  // Pre-seleccionar al usuario actual en el Equipo Rojo por defecto
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
    const tempRed = [...teamRed];
    const tempBlue = [...teamBlue];
    setTeamRed(tempBlue);
    setTeamBlue(tempRed);
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

  const isFormValid = teamRed.length >= maxSlots && teamBlue.length >= maxSlots;

  return (
    <View style={styles.setupContainer}>
      {/* Selector 1v1 / 2v2 */}
      {showModeSelector && onChangeMode && (
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeTab, mode === '1v1' && styles.modeTabActive]}
            onPress={() => {
              onChangeMode('1v1');
              setTeamRed([]);
              setTeamBlue([]);
            }}
          >
            <Text style={[styles.modeTabText, mode === '1v1' && styles.modeTabTextActive]}>1 vs 1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === '2v2' && styles.modeTabActive]}
            onPress={() => {
              onChangeMode('2v2');
              setTeamRed([]);
              setTeamBlue([]);
            }}
          >
            <Text style={[styles.modeTabText, mode === '2v2' && styles.modeTabTextActive]}>2 vs 2</Text>
          </TouchableOpacity>
        </View>
      )}

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
        style={[styles.primaryBtn, !isFormValid && styles.disabled]}
        disabled={!isFormValid}
        onPress={onStartMatch}
      >
        <Text style={styles.primaryBtnText}>Iniciar Partido ({mode})</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
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
    height: 88,
    paddingHorizontal: 8,
    justifyContent: 'center',
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
    marginTop: 3,
  },
  chipNameBlue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
    marginTop: 3,
  },
  playerHandle: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  emptySlotCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    height: 88,
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
});
