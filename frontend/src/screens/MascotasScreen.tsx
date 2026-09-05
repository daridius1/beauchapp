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
import { petsService, PetProfile, DiscoverPetProfile } from '../services/petsService';
import { theme } from '../theme/theme';
import { Feather, FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { compressImage, compressImageNative } from '../utils/imageCompressor';
import { withMinimumDelay } from '../utils/refresh';
import { CarouselDots } from '../components/CarouselDots';
import { PetDiscoverCard } from './mascotas/PetDiscoverCard';
import { PetMatchModal } from './mascotas/PetMatchModal';
import { ConfirmExitModal } from '../components/ConfirmExitModal';
import { MatchContactModal } from '../components/MatchContactModal';

const MAX_PHOTOS = 10;

type Props = NativeStackScreenProps<RootStackParamList, 'Mascotas'>;

export const MascotasScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'descubrir' | 'mis-mascotas' | 'matches'>('descubrir');

  // --- Mi perfil de mascotas: un solo registro (nombre libre + descripción + hasta 10
  // fotos), no una lista de mascotas cada una con lo suyo. Se pide sin esperar a que se
  // abra la pestaña "Mis Mascotas" porque "Descubrir" necesita saber si ya se puede dar like.
  const [profile, setProfile] = useState<PetProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photosList, setPhotosList] = useState<any[]>([]);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      setLoadingProfile(true);
      const res = await petsService.getProfileByUserId(user.id);
      setProfile(res);
      setName(res?.name || '');
      setDescription(res?.description || '');
      setPhotosList((res?.photos || []).map((ph: string) => ({ uri: getFileUrl(res, ph), isLocal: false, name: ph })));
      setPreviewPhotoIndex(0);
    } catch (err) {
      console.error('Error cargando perfil de mascotas:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
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

    if (!target.isLiked && (!profile?.photos || profile.photos.length === 0)) {
      Toast.show({
        type: 'info',
        text1: 'Te falta un perfil',
        text2: 'Sube al menos una foto en "Mis Mascotas" antes de dar like.',
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

  const handleAddPhoto = async () => {
    if (photosList.length >= MAX_PHOTOS) {
      Alert.alert('Límite de fotos', `Puedes subir un máximo de ${MAX_PHOTOS} fotos.`);
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

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      setSavingProfile(true);
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());

      const isNew = !profile;
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

      const saved = isNew
        ? await petsService.createProfile(formData)
        : await petsService.updateProfile(profile!.id, formData);

      setProfile(saved);
      setPhotosList((saved.photos || []).map((ph: string) => ({ uri: getFileUrl(saved, ph), isLocal: false, name: ph })));
      Toast.show({ type: 'success', text1: 'Perfil guardado' });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo guardar tu perfil.');
    } finally {
      setSavingProfile(false);
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
        else if (activeTab === 'mis-mascotas') await fetchProfile();
        else if (activeTab === 'matches') await fetchMatches();
      });
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const [unmatchTarget, setUnmatchTarget] = useState<any | null>(null);
  const [contactModalMatch, setContactModalMatch] = useState<any | null>(null);

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
          <FontAwesome name="paw" size={18} color={activeTab === 'mis-mascotas' ? theme.colors.primary : '#a3a3a3'} />
          <Text style={[styles.tabBtnText, activeTab === 'mis-mascotas' && styles.tabBtnTextActive]}>Mis Mascotas</Text>
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
            <FontAwesome name="paw" size={40} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
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
        (loadingProfile ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.formContent}>
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

                  <CarouselDots count={photosList.length} activeIndex={previewPhotoIndex % photosList.length} />
                </>
              ) : (
                <View style={styles.previewEmpty}>
                  <FontAwesome name="paw" size={40} color="#404040" />
                  <Text style={styles.previewEmptyText}>Sin fotos subidas</Text>
                </View>
              )}
            </View>

            <Text style={[styles.label, { marginTop: theme.spacing.md }]}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre de tu mascota (o de varias, si tienes más de una)"
              placeholderTextColor={theme.colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { marginTop: theme.spacing.md }]}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Contale a la gente de qué se trata (raza, personalidad, historia...)"
              placeholderTextColor={theme.colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={[styles.label, { marginTop: theme.spacing.md }]}>Fotos ({photosList.length}/{MAX_PHOTOS})</Text>
            <View style={styles.photosRow}>
              {photosList.map((ph, idx) => (
                <View key={idx} style={styles.photoSlot}>
                  <Image source={{ uri: ph.uri }} style={styles.photoThumb} />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => handleRemovePhoto(idx)}>
                    <Feather name="x" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {photosList.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.addPhotoSlot} onPress={handleAddPhoto}>
                  <Feather name="plus" size={22} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={[styles.saveBtn, savingProfile && styles.saveBtnDisabled]} onPress={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Guardar perfil</Text>}
            </TouchableOpacity>
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
                  onPress={() => setContactModalMatch(m)}
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
        visible={!!unmatchTarget}
        title="Deshacer match"
        message={`¿Deshacer el match con ${(unmatchTarget?.userA === user?.id ? unmatchTarget?.expand?.userB : unmatchTarget?.expand?.userA)?.name || 'esta persona'}?`}
        confirmText="Deshacer"
        onConfirm={confirmUnmatch}
        onCancel={() => setUnmatchTarget(null)}
      />

      <MatchContactModal
        visible={!!contactModalMatch}
        matchUser={contactModalMatch?.userA === user?.id ? contactModalMatch?.expand?.userB : contactModalMatch?.expand?.userA}
        onClose={() => setContactModalMatch(null)}
        onNavigateToUser={(userId) => {
          setContactModalMatch(null);
          navigation.push('UserProfile', { userId });
        }}
        onUnmatch={() => {
          const match = contactModalMatch;
          setContactModalMatch(null);
          if (match) handleUnmatch(match);
        }}
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
  saveBtn: { marginTop: theme.spacing.xl, backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
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
