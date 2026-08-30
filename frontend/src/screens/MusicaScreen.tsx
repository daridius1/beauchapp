import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { getFileUrl } from '../services/pocketbase';
import { songsService, SongRecord } from '../services/songsService';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { decodeAudioFileWeb, compressAudioClip, pickAudioFileWeb, SONG_TARGET_KBPS, SONG_CLIP_SECONDS } from '../utils/audioCompressor';
import { SongProfileCard } from '../components/SongProfileCard';
import { SongPlayer } from '../components/SongPlayer';

type Props = NativeStackScreenProps<RootStackParamList, 'Musica'>;

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const MusicaScreen: React.FC<Props> = ({ route }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'explorar' | 'mi-cancion'>('explorar');

  useEffect(() => {
    if (route.params?.initialTab) setActiveTab(route.params.initialTab);
  }, [route.params?.initialTab]);

  // --- Pestaña Explorar: una canción a la vez, como Mascotas/Tinder Beauchef ---
  const [songs, setSongs] = useState<SongRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingSongs, setLoadingSongs] = useState(true);

  const fetchSongs = async () => {
    try {
      setLoadingSongs(true);
      const all = await songsService.listAllSongs();
      setSongs(all);
      setCurrentIndex((prev) => (all.length > 0 ? prev % all.length : 0));
    } catch (err) {
      console.error('Error cargando canciones:', err);
    } finally {
      setLoadingSongs(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'explorar') fetchSongs();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab])
  );

  // --- Pestaña Mi canción ---
  const [mySong, setMySong] = useState<SongRecord | null>(null);
  const [loadingMySong, setLoadingMySong] = useState(true);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [existingAudioName, setExistingAudioName] = useState<string | null>(null);
  const [localAudioBlob, setLocalAudioBlob] = useState<Blob | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [removeAudio, setRemoveAudio] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Recorte de 30s: mientras trimBuffer no sea null, se muestra el selector en vez del
  // reproductor normal — el usuario escucha la canción original y marca desde dónde
  // quiere el fragmento.
  const [trimBuffer, setTrimBuffer] = useState<AudioBuffer | null>(null);
  const [trimOriginalUrl, setTrimOriginalUrl] = useState<string | null>(null);
  const [trimPosition, setTrimPosition] = useState(0);

  const fetchMySong = async () => {
    if (!user) return;
    try {
      setLoadingMySong(true);
      const song = await songsService.getMySong(user.id);
      setMySong(song);
      setTitle(song?.title || '');
      setAuthor(song?.author || '');
      setYear(song?.year ? String(song.year) : '');
      setDescription(song?.description || '');
      setExistingAudioName(song?.audio || null);
      setLocalAudioBlob(null);
      setLocalPreviewUrl(null);
      setRemoveAudio(false);
      clearTrimState();
    } catch (err) {
      console.error('Error cargando mi canción:', err);
    } finally {
      setLoadingMySong(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'mi-cancion') fetchMySong();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user?.id])
  );

  // Liberar el object URL de la vista previa local al reemplazarlo o desmontar, para no
  // filtrar memoria (mismo patrón que EntityCommentBox con photoPreview).
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  useEffect(() => {
    return () => {
      if (trimOriginalUrl) URL.revokeObjectURL(trimOriginalUrl);
    };
  }, [trimOriginalUrl]);

  const clearTrimState = () => {
    if (trimOriginalUrl) URL.revokeObjectURL(trimOriginalUrl);
    setTrimBuffer(null);
    setTrimOriginalUrl(null);
    setTrimPosition(0);
  };

  const applyClip = (buffer: AudioBuffer, startSec: number) => {
    const blob = compressAudioClip(buffer, startSec);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalAudioBlob(blob);
    setLocalPreviewUrl(URL.createObjectURL(blob));
    setRemoveAudio(false);
  };

  const handlePickAudio = async () => {
    if (Platform.OS !== 'web') {
      Toast.show({
        type: 'info',
        text1: 'Solo disponible en la versión web',
        text2: 'Por ahora, sube tu canción desde beauchapp.daridius.cl en un navegador.',
      });
      return;
    }

    const file = await pickAudioFileWeb();
    if (!file) return;

    setCompressing(true);
    try {
      const buffer = await decodeAudioFileWeb(file);
      if (buffer.duration <= SONG_CLIP_SECONDS) {
        // Ya entra completa: no hace falta preguntar desde dónde recortar.
        applyClip(buffer, 0);
      } else {
        clearTrimState();
        setTrimBuffer(buffer);
        setTrimOriginalUrl(URL.createObjectURL(file));
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo leer el audio.');
    } finally {
      setCompressing(false);
    }
  };

  const handleConfirmTrim = () => {
    if (!trimBuffer) return;
    applyClip(trimBuffer, trimPosition);
    clearTrimState();
  };

  const handleRemoveAudio = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalAudioBlob(null);
    setLocalPreviewUrl(null);
    setRemoveAudio(true);
  };

  const handleSaveSong = async () => {
    if (!user) return;
    if (!title.trim() || !author.trim()) {
      Toast.show({ type: 'error', text1: 'Faltan datos', text2: 'El nombre y el autor de la canción son obligatorios.' });
      return;
    }

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('author', author.trim());
      if (year.trim()) formData.append('year', year.trim());
      formData.append('description', description.trim());
      if (!mySong) formData.append('user', user.id);

      if (localAudioBlob) {
        formData.append('audio', localAudioBlob, 'song.mp3');
      } else if (removeAudio) {
        formData.append('audio', '');
      }

      const res = mySong
        ? await songsService.updateSong(mySong.id, formData)
        : await songsService.createSong(formData);
      setMySong(res);
      setExistingAudioName(res.audio || null);
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
      setLocalAudioBlob(null);
      setLocalPreviewUrl(null);
      setRemoveAudio(false);

      Toast.show({ type: 'success', text1: 'Canción guardada' });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar tu canción.');
    } finally {
      setSaving(false);
    }
  };

  const previewUri = localPreviewUrl || (!removeAudio && existingAudioName && mySong ? getFileUrl(mySong, existingAudioName) : null);

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
          style={[styles.tabBtn, activeTab === 'mi-cancion' && styles.tabBtnActive]}
          onPress={() => setActiveTab('mi-cancion')}
        >
          <Feather name="music" size={18} color={activeTab === 'mi-cancion' ? theme.colors.primary : '#a3a3a3'} />
          <Text style={[styles.tabBtnText, activeTab === 'mi-cancion' && styles.tabBtnTextActive]}>Mi canción</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'explorar' ? (
        loadingSongs ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : songs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="music" size={40} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Todavía nadie ha compartido su canción.</Text>
          </View>
        ) : (
          <SongProfileCard
            key={songs[currentIndex].id}
            songId={songs[currentIndex].id}
            onPrevProfile={songs.length > 1 ? () => setCurrentIndex((i) => (i - 1 + songs.length) % songs.length) : undefined}
            onNextProfile={songs.length > 1 ? () => setCurrentIndex((i) => (i + 1) % songs.length) : undefined}
            positionLabel={songs.length > 1 ? `${currentIndex + 1} de ${songs.length}` : undefined}
          />
        )
      ) : loadingMySong ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.formContent}>
          <Text style={styles.label}>Canción</Text>
          {compressing ? (
            <View style={styles.compressingBox}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.compressingText}>Comprimiendo audio...</Text>
            </View>
          ) : trimBuffer ? (
            <View style={styles.trimBox}>
              <Text style={styles.trimHint}>
                Elige desde dónde empiezan los {SONG_CLIP_SECONDS}s que se van a usar: reproduce la canción original y
                marca el punto cuando llegues ahí.
              </Text>
              <SongPlayer uri={trimOriginalUrl} onProgress={setTrimPosition} />
              <Text style={styles.trimRange}>
                Se usará: {formatTime(trimPosition)} — {formatTime(Math.min(trimPosition + SONG_CLIP_SECONDS, trimBuffer.duration))}
              </Text>
              <View style={styles.audioActionsRow}>
                <TouchableOpacity style={[styles.audioActionBtn, styles.audioActionBtnPrimary]} onPress={handleConfirmTrim}>
                  <Feather name="scissors" size={14} color="#000" />
                  <Text style={[styles.audioActionText, { color: '#000' }]}>Usar este fragmento</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.audioActionBtn} onPress={clearTrimState}>
                  <Text style={styles.audioActionText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <SongPlayer uri={previewUri} />
              <View style={styles.audioActionsRow}>
                <TouchableOpacity style={styles.audioActionBtn} onPress={handlePickAudio}>
                  <Feather name="upload" size={14} color={theme.colors.text} />
                  <Text style={styles.audioActionText}>{previewUri ? 'Cambiar canción' : 'Subir canción'}</Text>
                </TouchableOpacity>
                {!!previewUri && (
                  <TouchableOpacity style={styles.audioActionBtn} onPress={handleRemoveAudio}>
                    <Feather name="trash-2" size={14} color={theme.colors.error} />
                    <Text style={[styles.audioActionText, { color: theme.colors.error }]}>Quitar</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.hint}>
                Se sube un fragmento de {SONG_CLIP_SECONDS}s, comprimido automáticamente a mono, {SONG_TARGET_KBPS}kbps.
              </Text>
            </>
          )}

          <Text style={styles.label}>Nombre de la canción</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Bohemian Rhapsody"
            placeholderTextColor={theme.colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Autor</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Queen"
            placeholderTextColor={theme.colors.textMuted}
            value={author}
            onChangeText={setAuthor}
          />

          <Text style={styles.label}>Año</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 1975"
            placeholderTextColor={theme.colors.textMuted}
            value={year}
            onChangeText={(v) => setYear(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={4}
          />

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Cuéntanos por qué elegiste esta canción..."
            placeholderTextColor={theme.colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSaveSong} disabled={saving}>
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
  compressingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
  },
  compressingText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  audioActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  audioActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardBg,
  },
  audioActionBtnPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  audioActionText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  trimBox: {
    gap: 10,
  },
  trimHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  trimRange: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 6,
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
