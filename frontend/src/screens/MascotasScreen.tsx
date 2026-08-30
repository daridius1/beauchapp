import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { getFileUrl } from '../services/pocketbase';
import { petsService, PetRecord } from '../services/petsService';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { compressImage, compressImageNative } from '../utils/imageCompressor';
import { PetProfileCard } from '../components/PetProfileCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Mascotas'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 450);

export const MascotasScreen: React.FC<Props> = ({ route }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'explorar' | 'mi-mascota'>('explorar');

  useEffect(() => {
    if (route.params?.initialTab) setActiveTab(route.params.initialTab);
  }, [route.params?.initialTab]);

  // --- Pestaña Explorar: una mascota a la vez, como el Descubrir de Tinder Beauchef ---
  const [pets, setPets] = useState<PetRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingPets, setLoadingPets] = useState(true);

  const fetchPets = async () => {
    try {
      setLoadingPets(true);
      const all = await petsService.listAllPets();
      setPets(all);
      setCurrentIndex((prev) => (all.length > 0 ? prev % all.length : 0));
    } catch (err) {
      console.error('Error cargando mascotas:', err);
    } finally {
      setLoadingPets(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'explorar') fetchPets();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab])
  );

  // --- Pestaña Mi mascota ---
  const [myPet, setMyPet] = useState<PetRecord | null>(null);
  const [loadingMyPet, setLoadingMyPet] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photosList, setPhotosList] = useState<any[]>([]);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const fetchMyPet = async () => {
    if (!user) return;
    try {
      setLoadingMyPet(true);
      const pet = await petsService.getMyPet(user.id);
      setMyPet(pet);
      setName(pet?.name || '');
      setDescription(pet?.description || '');
      if (pet?.photos && Array.isArray(pet.photos)) {
        setPhotosList(
          pet.photos.map((ph: string) => ({ uri: getFileUrl(pet, ph), isLocal: false, name: ph }))
        );
      } else {
        setPhotosList([]);
      }
      setPreviewPhotoIndex(0);
    } catch (err) {
      console.error('Error cargando mi mascota:', err);
    } finally {
      setLoadingMyPet(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'mi-mascota') fetchMyPet();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user?.id])
  );

  const handleAddPhoto = async () => {
    if (photosList.length >= 5) {
      Alert.alert('Límite de fotos', 'Puedes subir un máximo de 5 fotos.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({
        type: 'error',
        text1: 'Permisos requeridos',
        text2: 'Se necesitan permisos de galería para añadir fotos.',
      });
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

  const handleSavePet = async () => {
    if (!user) return;
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Falta el nombre', text2: 'Ponle un nombre a tu mascota.' });
      return;
    }

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      if (!myPet) formData.append('user', user.id);

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
              const compressed = await compressImageNative(
                ph.uri,
                ph.file?.width || 0,
                ph.file?.height || 0,
                false,
                'image/jpeg'
              );
              formData.append('photos', {
                uri: compressed.uri,
                name: 'pet_photo.jpg',
                type: 'image/jpeg',
              } as any);
            } catch (compressErr) {
              formData.append('photos', {
                uri: ph.uri,
                name: ph.file?.fileName || 'pet_photo.jpg',
                type: ph.file?.mimeType || 'image/jpeg',
              } as any);
            }
          }
        } else {
          formData.append('photos', ph.name);
        }
      }

      const res = myPet
        ? await petsService.updatePet(myPet.id, formData)
        : await petsService.createPet(formData);
      setMyPet(res);

      Toast.show({ type: 'success', text1: 'Mascota guardada' });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar tu mascota.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabHeader}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'explorar' && styles.tabBtnActive]}
          onPress={() => setActiveTab('explorar')}
        >
          <Feather name="search" size={18} color={activeTab === 'explorar' ? theme.colors.primary : '#a3a3a3'} />
          <Text style={[styles.tabBtnText, activeTab === 'explorar' && styles.tabBtnTextActive]}>Explorar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'mi-mascota' && styles.tabBtnActive]}
          onPress={() => setActiveTab('mi-mascota')}
        >
          <Feather name="heart" size={18} color={activeTab === 'mi-mascota' ? theme.colors.primary : '#a3a3a3'} />
          <Text style={[styles.tabBtnText, activeTab === 'mi-mascota' && styles.tabBtnTextActive]}>Mi mascota</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'explorar' ? (
        loadingPets ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : pets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="heart" size={40} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Todavía nadie ha compartido a su mascota.</Text>
          </View>
        ) : (
          <PetProfileCard
            key={pets[currentIndex].id}
            petId={pets[currentIndex].id}
            onPrevProfile={pets.length > 1 ? () => setCurrentIndex((i) => (i - 1 + pets.length) % pets.length) : undefined}
            onNextProfile={pets.length > 1 ? () => setCurrentIndex((i) => (i + 1) % pets.length) : undefined}
            positionLabel={pets.length > 1 ? `${currentIndex + 1} de ${pets.length}` : undefined}
          />
        )
      ) : loadingMyPet ? (
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

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre de tu mascota"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Cuéntanos sobre tu mascota (raza, personalidad, si tienes más de una...)"
            placeholderTextColor={theme.colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Text style={styles.label}>Fotos</Text>
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

          <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSavePet} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // Mismo diseño que las pestañas de TinderScreen (subrayado, no chips).
  tabHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.cardBg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabBtnTextActive: {
    color: theme.colors.text,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  formContent: {
    padding: theme.spacing.lg,
    paddingBottom: 60,
  },
  previewWrapper: {
    width: '100%',
    maxWidth: CARD_WIDTH,
    alignSelf: 'center',
    aspectRatio: 1,
    backgroundColor: '#0a0a0a',
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewNavArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
  },
  previewDotsRow: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  previewDotActive: {
    backgroundColor: '#ffffff',
    width: 8,
  },
  previewEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmptyText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 6,
    marginTop: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  photosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  photoSlot: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
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
  saveBtn: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
  },
});
