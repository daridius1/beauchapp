import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  Platform,
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
import { petsService, PetRecord, DiscoverPetProfile } from '../services/petsService';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { compressImage, compressImageNative } from '../utils/imageCompressor';
import { withMinimumDelay } from '../utils/refresh';
import { PetDiscoverCard } from './mascotas/PetDiscoverCard';
import { PetMatchModal } from './mascotas/PetMatchModal';
import { ConfirmExitModal } from '../components/ConfirmExitModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Mascotas'>;

export const MascotasScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'descubrir' | 'mis-mascotas' | 'matches'>('descubrir');

  // --- Mis Mascotas: se necesita en más de una pestaña (para saber si ya se puede dar
  // like en Descubrir), así que vive a nivel de pantalla.
  const [myItems, setMyItems] = useState<PetRecord[]>([]);
  const [loadingMyItems, setLoadingMyItems] = useState(true);

  const fetchMyItems = async () => {
    if (!user) return;
    try {
      setLoadingMyItems(true);
      setMyItems(await petsService.listMyItems(user.id));
    } catch (err) {
      console.error('Error cargando mis mascotas:', err);
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
  const [discoverProfiles, setDiscoverProfiles] = useState<DiscoverPetProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [matchUser, setMatchUser] = useState<any>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);

  const fetchDiscover = async () => {
    try {
      setLoadingDiscover(true);
      const feed = await petsService.getDiscoverFeed();
      setDiscoverProfiles(feed);
      setCurrentIndex((prev) => (feed.length > 0 ? prev % feed.length : 0));
    } catch (err) {
      console.error('Error cargando descubrimiento de mascotas:', err);
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
        text2: 'Sube al menos una mascota en "Mis Mascotas" antes de dar like.',
      });
      return;
    }

    try {
      if (target.isLiked) {
        if (target.likeId) await petsService.deleteLike(target.likeId);
        setDiscoverProfiles((prev) =>
          prev.map((p) => (p.user === target.user ? { ...p, isLiked: false, likeId: null } : p))
        );
        return;
      }

      await petsService.createLike(user.id, target.user, true);
      setDiscoverProfiles((prev) => prev.map((p) => (p.user === target.user ? { ...p, isLiked: true } : p)));

      const idA = user.id < target.user ? user.id : target.user;
      const idB = user.id > target.user ? user.id : target.user;
      const match = await petsService.getMatchBetweenUsers(idA, idB).catch(() => null);
      if (match) {
        setMatchUser(target.expand?.user);
        setShowMatchModal(true);
      }
    } catch (err: any) {
      console.error('Error al dar like:', err);
      Toast.show({ type: 'error', text1: 'No se pudo procesar el like', text2: err?.message || '' });
    }
  };

  // --- Descripción de perfil (qué tipo de mascotas te gustan, no de una mascota puntual) ---
  const [description, setDescription] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [savingDescription, setSavingDescription] = useState(false);

  const fetchProfile = async () => {
    if (!user) return;
    const profile = await petsService.getProfileByUserId(user.id);
    setProfileId(profile?.id || null);
    setDescription(profile?.description || '');
  };

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'mis-mascotas') fetchProfile();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user?.id])
  );

  const handleSaveDescription = async () => {
    if (!user) return;
    try {
      setSavingDescription(true);
      if (profileId) {
        await petsService.updateProfile(profileId, { description: description.trim() });
      } else {
        const created = await petsService.createProfile({ user: user.id, description: description.trim() });
        setProfileId(created.id);
      }
      Toast.show({ type: 'success', text1: 'Descripción guardada' });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo guardar la descripción.');
    } finally {
      setSavingDescription(false);
    }
  };

  // --- Formulario de una mascota (agregar o editar) ---
  const [editingItem, setEditingItem] = useState<PetRecord | 'new' | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [photosList, setPhotosList] = useState<any[]>([]);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState(0);
  const [savingItem, setSavingItem] = useState(false);

  const openNewItemForm = () => {
    if (myItems.length >= 5) {
      Toast.show({ type: 'info', text1: 'Límite alcanzado', text2: 'Ya subiste el máximo de 5 mascotas.' });
      return;
    }
    setEditingItem('new');
    setItemName('');
    setItemDescription('');
    setPhotosList([]);
    setPreviewPhotoIndex(0);
  };

  const openEditItemForm = (item: PetRecord) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemDescription(item.description || '');
    setPhotosList(
      (item.photos || []).map((ph: string) => ({ uri: getFileUrl(item, ph), isLocal: false, name: ph }))
    );
    setPreviewPhotoIndex(0);
  };

  const closeItemForm = () => {
    setEditingItem(null);
    setPhotosList([]);
  };

  const handleAddPhoto = async () => {
    if (photosList.length >= 5) {
      Alert.alert('Límite de fotos', 'Puedes subir un máximo de 5 fotos.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'Permisos requeridos', text2: 'Se necesitan permisos de galería para añadir fotos.' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const asset = result.assets[0];
    setPhotosList((prev) => [...prev, { uri: asset.uri, isLocal: true, file: asset }]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotosList((prev) => prev.filter((_, i) => i !== index));
    setPreviewPhotoIndex(0);
  };

  const handleSaveItem = async () => {
    if (!user) return;
    if (!itemName.trim()) {
      Toast.show({ type: 'error', text1: 'Falta el nombre', text2: 'Ponle un nombre a tu mascota.' });
      return;
    }

    try {
      setSavingItem(true);
      const formData = new FormData();
      formData.append('name', itemName.trim());
      formData.append('description', itemDescription.trim());

      const isNew = editingItem === 'new';
      if (isNew) formData.append('user', user.id);

      for (const ph of photosList) {
        if (ph.isLocal) {
          if (Platform.OS === 'web') {
            const response = await fetch(ph.uri);
            const rawBlob = await response.blob();
            const mime = rawBlob.type || 'image/jpeg';
            const rawFile =
              ph.file && ph.file instanceof File ? ph.file : new File([rawBlob], ph.file?.fileName || 'photo.jpg', { type: mime });
            try {
              const compressedBlob = await compressImage(rawFile, false, 'image/jpeg');
              formData.append('photos', compressedBlob, 'pet_photo.jpg');
            } catch (compressErr) {
              formData.append('photos', rawBlob, ph.file?.fileName || 'pet_photo.jpg');
            }
          } else {
            try {
              const compressed = await compressImageNative(ph.uri, ph.file?.width || 0, ph.file?.height || 0, false, 'image/jpeg');
              formData.append('photos', { uri: compressed.uri, name: 'pet_photo.jpg', type: 'image/jpeg' } as any);
            } catch (compressErr) {
              formData.append('photos', { uri: ph.uri, name: ph.file?.fileName || 'pet_photo.jpg', type: ph.file?.mimeType || 'image/jpeg' } as any);
            }
          }
        } else {
          formData.append('photos', ph.name);
        }
      }

      const isNewFinal = editingItem === 'new';
      if (isNewFinal) {
        await petsService.createItem(formData);
      } else {
        await petsService.updateItem((editingItem as PetRecord).id, formData);
      }

      Toast.show({ type: 'success', text1: 'Mascota guardada' });
      closeItemForm();
      fetchMyItems();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo guardar tu mascota.');
    } finally {
      setSavingItem(false);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<PetRecord | null>(null);

  const handleDeleteItem = (item: PetRecord) => setDeleteTarget(item);

  const confirmDeleteItem = async () => {
    if (!deleteTarget) return;
    try {
      await petsService.deleteItem(deleteTarget.id);
      fetchMyItems();
    } catch (err) {
      console.error('Error eliminando mascota:', err);
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
      const res = await petsService.getMatchesList(user.id);
      setMatches(res.filter((m: any) => m.status !== 'unmatched'));
    } catch (err) {
      console.error('Error cargando matches de mascotas:', err);
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
        else if (activeTab === 'mis-mascotas') await Promise.all([fetchMyItems(), fetchProfile()]);
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
    await petsService.unmatch(unmatchTarget.id, user.id);
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
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'mis-mascotas' && styles.tabBtnActive]} onPress={() => setActiveTab('mis-mascotas')}>
          <Feather name="heart" size={18} color={activeTab === 'mis-mascotas' ? theme.colors.primary : '#a3a3a3'} />
          <Text style={[styles.tabBtnText, activeTab === 'mis-mascotas' && styles.tabBtnTextActive]}>Mis Mascotas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'matches' && styles.tabBtnActive]} onPress={() => setActiveTab('matches')}>
          <Feather name="smile" size={18} color={activeTab === 'matches' ? theme.colors.primary : '#a3a3a3'} />
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
            <Feather name="heart" size={40} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Todavía nadie ha compartido a su mascota.</Text>
          </View>
        ) : (
          <PetDiscoverCard
            key={discoverProfiles[currentIndex % discoverProfiles.length].user}
            profile={discoverProfiles[currentIndex % discoverProfiles.length]}
            onPrevProfile={discoverProfiles.length > 1 ? () => setCurrentIndex((i) => (i - 1 + discoverProfiles.length) % discoverProfiles.length) : undefined}
            onNextProfile={discoverProfiles.length > 1 ? () => setCurrentIndex((i) => (i + 1) % discoverProfiles.length) : undefined}
            positionLabel={discoverProfiles.length > 1 ? `${(currentIndex % discoverProfiles.length) + 1} de ${discoverProfiles.length}` : undefined}
            onToggleLike={handleToggleLike}
            onNavigateToUser={(userId) => navigation.push('UserProfile', { userId })}
          />
        ))}

      {activeTab === 'mis-mascotas' &&
        (loadingMyItems ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={styles.label}>Descripción de tu perfil</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Contale a la gente qué tipo de mascotas te gustan..."
              placeholderTextColor={theme.colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <TouchableOpacity style={[styles.saveBtn, savingDescription && styles.saveBtnDisabled]} onPress={handleSaveDescription} disabled={savingDescription}>
              {savingDescription ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Guardar descripción</Text>}
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: theme.spacing.xl }]}>Tus mascotas ({myItems.length}/5)</Text>

            {myItems.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                {item.photos && item.photos.length > 0 ? (
                  <Image source={{ uri: getFileUrl(item, item.photos[0]) }} style={styles.itemThumb} />
                ) : (
                  <View style={[styles.itemThumb, styles.itemThumbEmpty]}>
                    <Feather name="image" size={18} color={theme.colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemRowTitle}>{item.name}</Text>
                  {!!item.description && (
                    <Text style={styles.itemRowYear} numberOfLines={1}>{item.description}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => openEditItemForm(item)} style={styles.itemActionBtn}>
                  <Feather name="edit-2" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteItem(item)} style={styles.itemActionBtn}>
                  <Feather name="trash-2" size={16} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            ))}

            {editingItem ? (
              <View style={styles.itemForm}>
                <View style={styles.previewWrapper}>
                  {photosList.length > 0 ? (
                    <>
                      <Image source={{ uri: photosList[previewPhotoIndex % photosList.length]?.uri }} style={styles.previewImage} />

                      <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'box-none' }]}>
                        <TouchableOpacity
                          style={[styles.previewNavArea, { left: 0 }]}
                          onPress={() => setPreviewPhotoIndex((prev) => Math.max(0, prev - 1))}
                        />
                        <TouchableOpacity
                          style={[styles.previewNavArea, { right: 0 }]}
                          onPress={() => setPreviewPhotoIndex((prev) => Math.min(photosList.length - 1, prev + 1))}
                        />
                      </View>

                      {photosList.length > 1 && (
                        <View style={styles.previewDotsRow}>
                          {photosList.map((_, dotIdx) => (
                            <View
                              key={dotIdx}
                              style={[styles.previewDot, dotIdx === previewPhotoIndex % photosList.length && styles.previewDotActive]}
                            />
                          ))}
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.previewEmpty}>
                      <Feather name="image" size={40} color="#404040" />
                      <Text style={styles.previewEmptyText}>Sin fotos subidas</Text>
                    </View>
                  )}
                </View>

                <TextInput
                  style={[styles.input, { marginTop: theme.spacing.md }]}
                  placeholder="Nombre de tu mascota"
                  placeholderTextColor={theme.colors.textMuted}
                  value={itemName}
                  onChangeText={setItemName}
                />

                <TextInput
                  style={[styles.input, styles.textArea, { marginTop: 8 }]}
                  placeholder="Cuéntanos sobre tu mascota (raza, personalidad...)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={itemDescription}
                  onChangeText={setItemDescription}
                  multiline
                />

                <Text style={[styles.label, { marginTop: theme.spacing.md }]}>Fotos</Text>
                <View style={styles.photosRow}>
                  {photosList.map((ph, idx) => (
                    <View key={idx} style={styles.photoSlot}>
                      <Image source={{ uri: ph.uri }} style={styles.photoThumb} />
                      <TouchableOpacity style={styles.removePhotoBtn} onPress={() => handleRemovePhoto(idx)}>
                        <Feather name="x" size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {photosList.length < 5 && (
                    <TouchableOpacity style={styles.addPhotoSlot} onPress={handleAddPhoto}>
                      <Feather name="plus" size={22} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.itemFormActions}>
                  <TouchableOpacity style={[styles.saveBtn, styles.itemFormBtn, savingItem && styles.saveBtnDisabled]} onPress={handleSaveItem} disabled={savingItem}>
                    {savingItem ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Guardar mascota</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cancelBtn, styles.itemFormBtn]} onPress={closeItemForm}>
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              myItems.length < 5 && (
                <TouchableOpacity style={styles.addItemBtn} onPress={openNewItemForm}>
                  <Feather name="plus" size={18} color={theme.colors.text} />
                  <Text style={styles.addItemBtnText}>Agregar mascota</Text>
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
            <Feather name="smile" size={40} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
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
        <PetMatchModal
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
        title="Eliminar mascota"
        message={`¿Eliminar "${deleteTarget?.name}" de tu perfil?`}
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
  itemThumb: { width: 44, height: 44, borderRadius: 8 },
  itemThumbEmpty: { backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  itemRowTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  itemRowYear: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  itemActionBtn: { padding: 8 },
  itemForm: { marginTop: theme.spacing.md, padding: theme.spacing.md, backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.border },
  itemFormActions: { flexDirection: 'row', gap: 10 },
  itemFormBtn: { flex: 1 },
  addItemBtn: { marginTop: theme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed' },
  addItemBtnText: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  matchAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  matchAvatarLetter: { color: theme.colors.text, fontWeight: '800' },
  matchName: { flex: 1, color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  previewWrapper: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0a0a0a',
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
  previewNavArea: { position: 'absolute', top: 0, bottom: 0, width: '50%' },
  previewDotsRow: { position: 'absolute', top: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  previewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.4)' },
  previewDotActive: { backgroundColor: '#ffffff', width: 8 },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewEmptyText: { color: theme.colors.textMuted, fontSize: 12, marginTop: 8 },
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  photoSlot: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoSlot: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.cardBg,
  },
});
