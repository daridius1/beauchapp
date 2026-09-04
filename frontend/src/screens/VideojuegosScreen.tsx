import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { getFileUrl } from '../services/pocketbase';
import { gamesService, GameItem, DiscoverGameProfile } from '../services/gamesService';
import { igdbService, IgdbResult } from '../services/igdbService';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { withMinimumDelay } from '../utils/refresh';
import { GameDiscoverCard } from './games/GameDiscoverCard';
import { GameMatchModal } from './games/GameMatchModal';
import { ConfirmExitModal } from '../components/ConfirmExitModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Videojuegos'>;

export const VideojuegosScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'descubrir' | 'mis-videojuegos' | 'matches'>('descubrir');

  // --- Mis Videojuegos: se necesita en más de una pestaña (para saber si ya se puede dar
  // like en Descubrir), así que vive a nivel de pantalla.
  const [myItems, setMyItems] = useState<GameItem[]>([]);
  const [loadingMyItems, setLoadingMyItems] = useState(true);

  const fetchMyItems = async () => {
    if (!user) return;
    try {
      setLoadingMyItems(true);
      setMyItems(await gamesService.listMyItems(user.id));
    } catch (err) {
      console.error('Error cargando mis videojuegos:', err);
    } finally {
      setLoadingMyItems(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMyItems();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])
  );

  // --- Pestaña Descubrir ---
  const [discoverProfiles, setDiscoverProfiles] = useState<DiscoverGameProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [matchUser, setMatchUser] = useState<any>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);

  const fetchDiscover = async () => {
    try {
      setLoadingDiscover(true);
      const feed = await gamesService.getDiscoverFeed();
      setDiscoverProfiles(feed);
      setCurrentIndex((prev) => (feed.length > 0 ? prev % feed.length : 0));
    } catch (err) {
      console.error('Error cargando descubrimiento de videojuegos:', err);
    } finally {
      setLoadingDiscover(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'descubrir') fetchDiscover();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab])
  );

  const handleToggleLike = async () => {
    const target = discoverProfiles[currentIndex % discoverProfiles.length];
    if (!target || !user) return;

    if (!target.isLiked && myItems.length === 0) {
      Toast.show({
        type: 'info',
        text1: 'Te falta un perfil',
        text2: 'Sube al menos un videojuego en "Mis Videojuegos" antes de dar like.',
      });
      return;
    }

    try {
      if (target.isLiked) {
        if (target.likeId) await gamesService.deleteLike(target.likeId);
        setDiscoverProfiles((prev) =>
          prev.map((p) => (p.user === target.user ? { ...p, isLiked: false, likeId: null } : p))
        );
        return;
      }

      await gamesService.createLike(user.id, target.user, true);
      setDiscoverProfiles((prev) => (prev.map((p) => (p.user === target.user ? { ...p, isLiked: true } : p))));

      const idA = user.id < target.user ? user.id : target.user;
      const idB = user.id > target.user ? user.id : target.user;
      const match = await gamesService.getMatchBetweenUsers(idA, idB).catch(() => null);
      if (match) {
        setMatchUser(target.expand?.user);
        setShowMatchModal(true);
      }
    } catch (err: any) {
      console.error('Error al dar like:', err);
      Toast.show({ type: 'error', text1: 'No se pudo procesar el like', text2: err?.message || '' });
    }
  };

  // --- Pestaña Mis Videojuegos ---
  const [description, setDescription] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [savingDescription, setSavingDescription] = useState(false);

  const fetchProfile = async () => {
    if (!user) return;
    const profile = await gamesService.getProfileByUserId(user.id);
    setProfileId(profile?.id || null);
    setDescription(profile?.description || '');
  };

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'mis-videojuegos') fetchProfile();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user?.id])
  );

  const handleSaveDescription = async () => {
    if (!user) return;
    try {
      setSavingDescription(true);
      if (profileId) {
        await gamesService.updateProfile(profileId, { description: description.trim() });
      } else {
        const created = await gamesService.createProfile({ user: user.id, description: description.trim() });
        setProfileId(created.id);
      }
      Toast.show({ type: 'success', text1: 'Descripción guardada' });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo guardar la descripción.');
    } finally {
      setSavingDescription(false);
    }
  };

  // Formulario para agregar un ítem. No hay "editar" uno ya guardado: como elegir es solo
  // buscar y tocar un resultado, editar no sería más que borrar y agregar de nuevo — no
  // aporta nada aparte, así que la única acción sobre un ítem guardado es borrarlo. Elegir
  // un resultado ya guarda, no hay botón "Guardar" aparte.
  const [addingItem, setAddingItem] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IgdbResult[]>([]);
  const [searching, setSearching] = useState(false);

  const openNewItemForm = () => {
    if (myItems.length >= 5) {
      Toast.show({ type: 'info', text1: 'Límite alcanzado', text2: 'Ya subiste el máximo de 5 videojuegos.' });
      return;
    }
    setAddingItem(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const closeItemForm = () => {
    setAddingItem(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSearchIgdb = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      setSearchResults(await igdbService.search(q));
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error al buscar', text2: err?.message || 'Intenta de nuevo.' });
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = async (result: IgdbResult) => {
    if (!user) return;
    setSearchResults([]);
    setSearchQuery('');
    try {
      setSavingItem(true);
      await gamesService.createItem({
        user: user.id,
        title: result.name,
        year: result.year || null,
        igdbId: result.id,
        coverUrl: result.coverUrl,
      });

      Toast.show({ type: 'success', text1: 'Guardado' });
      closeItemForm();
      fetchMyItems();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo guardar.');
    } finally {
      setSavingItem(false);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<GameItem | null>(null);

  const handleDeleteItem = (item: GameItem) => setDeleteTarget(item);

  const confirmDeleteItem = async () => {
    if (!deleteTarget) return;
    try {
      await gamesService.deleteItem(deleteTarget.id);
      fetchMyItems();
    } catch (err) {
      console.error('Error eliminando videojuego:', err);
    } finally {
      setDeleteTarget(null);
    }
  };

  // --- Pestaña Matches ---
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const fetchMatches = async () => {
    if (!user) return;
    try {
      setLoadingMatches(true);
      const res = await gamesService.getMatchesList(user.id);
      setMatches(res.filter((m: any) => m.status !== 'unmatched'));
    } catch (err) {
      console.error('Error cargando matches de videojuegos:', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'matches') fetchMatches();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user?.id])
  );

  // Botón de actualizar del header (ícono refresh-cw): re-hace el fetch de la pestaña
  // activa, con el mismo `withMinimumDelay` que usa Tinder Beauchef para que el spinner de
  // cada pestaña (ya existente) no parpadee si la respuesta es muy rápida.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      await withMinimumDelay(async () => {
        if (activeTab === 'descubrir') await fetchDiscover();
        else if (activeTab === 'mis-videojuegos') await Promise.all([fetchMyItems(), fetchProfile()]);
        else if (activeTab === 'matches') await fetchMatches();
      });
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const [unmatchTarget, setUnmatchTarget] = useState<any | null>(null);

  const handleUnmatch = (match: any) => setUnmatchTarget(match);

  const confirmUnmatch = async () => {
    if (!unmatchTarget || !user) return;
    await gamesService.unmatch(unmatchTarget.id, user.id);
    setUnmatchTarget(null);
    fetchMatches();
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabHeader}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'descubrir' && styles.tabBtnActive]} onPress={() => setActiveTab('descubrir')}>
          <Feather name="search" size={18} color={activeTab === 'descubrir' ? theme.colors.primary : '#a3a3a3'} />
          <Text style={[styles.tabBtnText, activeTab === 'descubrir' && styles.tabBtnTextActive]}>Descubrir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'mis-videojuegos' && styles.tabBtnActive]} onPress={() => setActiveTab('mis-videojuegos')}>
          <Feather name="cpu" size={18} color={activeTab === 'mis-videojuegos' ? theme.colors.primary : '#a3a3a3'} />
          <Text style={[styles.tabBtnText, activeTab === 'mis-videojuegos' && styles.tabBtnTextActive]}>Mis Videojuegos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'matches' && styles.tabBtnActive]} onPress={() => setActiveTab('matches')}>
          <Feather name="heart" size={18} color={activeTab === 'matches' ? theme.colors.primary : '#a3a3a3'} />
          <Text style={[styles.tabBtnText, activeTab === 'matches' && styles.tabBtnTextActive]}>
            Matches {matches.length > 0 && `(${matches.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'descubrir' &&
        (loadingDiscover ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : discoverProfiles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="cpu" size={40} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Todavía nadie ha compartido sus videojuegos.</Text>
          </View>
        ) : (
          <GameDiscoverCard
            key={discoverProfiles[currentIndex % discoverProfiles.length].user}
            profile={discoverProfiles[currentIndex % discoverProfiles.length]}
            onPrevProfile={discoverProfiles.length > 1 ? () => setCurrentIndex((i) => (i - 1 + discoverProfiles.length) % discoverProfiles.length) : undefined}
            onNextProfile={discoverProfiles.length > 1 ? () => setCurrentIndex((i) => (i + 1) % discoverProfiles.length) : undefined}
            positionLabel={discoverProfiles.length > 1 ? `${(currentIndex % discoverProfiles.length) + 1} de ${discoverProfiles.length}` : undefined}
            onToggleLike={handleToggleLike}
            onNavigateToUser={(userId) => navigation.push('UserProfile', { userId })}
          />
        ))}

      {activeTab === 'mis-videojuegos' &&
        (loadingMyItems ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={styles.label}>Descripción de tu perfil</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Contale a la gente qué tipo de videojuegos te gustan..."
              placeholderTextColor={theme.colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <TouchableOpacity style={[styles.saveBtn, savingDescription && styles.saveBtnDisabled]} onPress={handleSaveDescription} disabled={savingDescription}>
              {savingDescription ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Guardar descripción</Text>}
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: theme.spacing.xl }]}>Tus videojuegos ({myItems.length}/5)</Text>

            {myItems.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                {item.coverUrl || item.image ? (
                  <Image source={{ uri: item.coverUrl || getFileUrl(item, item.image) }} style={styles.itemThumb} />
                ) : (
                  <View style={[styles.itemThumb, styles.itemThumbEmpty]}>
                    <Feather name="image" size={18} color={theme.colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemRowTitle}>{item.title}</Text>
                  {(!!item.year || !!item.director || !!item.genero) && (
                    <Text style={styles.itemRowYear}>
                      {[item.year, item.director, item.genero].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDeleteItem(item)} style={styles.itemActionBtn}>
                  <Feather name="trash-2" size={16} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            ))}

            {addingItem ? (
              <View style={styles.itemForm}>
                <Text style={styles.label}>Videojuego</Text>

                <View style={styles.searchRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Buscar videojuego..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearchIgdb}
                    returnKeyType="search"
                    editable={!savingItem}
                  />
                  <TouchableOpacity style={styles.searchBtn} onPress={handleSearchIgdb} disabled={searching || savingItem}>
                    {searching ? (
                      <ActivityIndicator size="small" color={theme.colors.text} />
                    ) : (
                      <Feather name="search" size={18} color={theme.colors.text} />
                    )}
                  </TouchableOpacity>
                </View>

                {searchResults.length > 0 && (
                  <View style={styles.searchResults}>
                    {searchResults.map((result) => (
                      <TouchableOpacity
                        key={result.id}
                        style={styles.searchResultRow}
                        onPress={() => handleSelectResult(result)}
                        disabled={savingItem}
                      >
                        {result.coverUrl ? (
                          <Image source={{ uri: result.coverUrl }} style={styles.itemThumb} />
                        ) : (
                          <View style={[styles.itemThumb, styles.itemThumbEmpty]}>
                            <Feather name="image" size={16} color={theme.colors.textMuted} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemRowTitle} numberOfLines={1}>{result.name}</Text>
                          {!!result.year && <Text style={styles.itemRowYear}>{result.year}</Text>}
                        </View>
                        {savingItem && <ActivityIndicator size="small" color={theme.colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity style={styles.cancelBtn} onPress={closeItemForm} disabled={savingItem}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myItems.length < 5 && (
                <TouchableOpacity style={styles.addItemBtn} onPress={openNewItemForm}>
                  <Feather name="plus" size={18} color={theme.colors.text} />
                  <Text style={styles.addItemBtnText}>Agregar videojuego</Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>
        ))}

      {activeTab === 'matches' &&
        (loadingMatches ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : matches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="heart" size={40} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Aún no tienes matches.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.formContent}>
            {matches.map((m) => {
              const other = m.userA === user?.id ? m.expand?.userB : m.expand?.userA;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={styles.matchRow}
                  onPress={() => other?.id && navigation.push('UserProfile', { userId: other.id })}
                  onLongPress={() => handleUnmatch(m)}
                >
                  <View style={styles.matchAvatarPlaceholder}>
                    <Text style={styles.matchAvatarLetter}>{(other?.name || 'U').charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.matchName}>{other?.name || 'Usuario'}</Text>
                  <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ))}

      {showMatchModal && (
        <GameMatchModal
          currentUser={user}
          matchUser={matchUser}
          onNavigateToUser={(userId) => {
            setShowMatchModal(false);
            navigation.push('UserProfile', { userId });
          }}
          onClose={() => setShowMatchModal(false)}
        />
      )}

      <ConfirmExitModal
        visible={!!deleteTarget}
        title="Eliminar videojuego"
        message={`¿Eliminar "${deleteTarget?.title}" de tu perfil?`}
        confirmText="Eliminar"
        onConfirm={confirmDeleteItem}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmExitModal
        visible={!!unmatchTarget}
        title="Deshacer match"
        message={`¿Deshacer el match con ${(unmatchTarget?.userA === user?.id ? unmatchTarget?.expand?.userB : unmatchTarget?.expand?.userA)?.name || 'esta persona'}?`}
        confirmText="Deshacer"
        onConfirm={confirmUnmatch}
        onCancel={() => setUnmatchTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.cardBg },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: theme.colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  tabBtnTextActive: { color: theme.colors.text },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyText: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center' },
  formContent: { padding: theme.spacing.lg, paddingBottom: 60 },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted, marginBottom: 6 },
  input: { backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, paddingHorizontal: 12, paddingVertical: 10, color: theme.colors.text, fontSize: 14 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn: { marginTop: theme.spacing.md, backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  cancelBtn: { marginTop: theme.spacing.md, backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  // 2:3 aprox. — mismo motivo que Películas: t_cover_big de IGDB es 264x374, cerca de 2:3,
  // y así el contenedor calza con la carátula real en vez de forzarla a un cuadrado.
  itemThumb: { width: 44, height: 66, borderRadius: 8, backgroundColor: theme.colors.cardBg },
  itemThumbEmpty: { backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  itemRowTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  itemRowYear: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  itemActionBtn: { padding: 8 },
  itemForm: { marginTop: theme.spacing.md, padding: theme.spacing.md, backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.border },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchBtn: { width: 42, height: 42, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  searchResults: { marginTop: 10, gap: 8 },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  addItemBtn: { marginTop: theme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed' },
  addItemBtnText: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  matchAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  matchAvatarLetter: { color: theme.colors.text, fontWeight: '800' },
  matchName: { flex: 1, color: theme.colors.text, fontSize: 15, fontWeight: '600' },
});
