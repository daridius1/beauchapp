import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { AnimatedMedia } from './AnimatedMedia';
import { GiphySelection, giphyService } from '../services/giphyService';

export const MAX_ANIMATION_SIZE = 1024 * 1024;

export interface ManualAnimation {
  file: File;
  mimeType: 'image/gif' | 'image/webp' | 'video/mp4';
  previewUrl: string;
}

interface Props {
  giphy: GiphySelection | null;
  manual: ManualAnimation | null;
  onGiphyChange: (value: GiphySelection | null) => void;
  onManualChange: (value: ManualAnimation | null) => void;
  onRemove: () => void;
}

const allowedTypes = ['image/gif', 'image/webp', 'video/mp4'] as const;

const imageDimensions = (file: File) => new Promise<{ width: number; height: number }>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new window.Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve({ width: image.naturalWidth, height: image.naturalHeight });
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('No se pudo leer la animación.'));
  };
  image.src = url;
});

const videoMetadata = (file: File) => new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.onloadedmetadata = () => {
    URL.revokeObjectURL(url);
    resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
  };
  video.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('No se pudo leer el video.'));
  };
  video.src = url;
});

export const GifComposer: React.FC<Props> = ({ giphy, manual, onGiphyChange, onManualChange, onRemove }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'giphy' | 'upload'>('giphy');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GiphySelection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (manual?.previewUrl) URL.revokeObjectURL(manual.previewUrl);
  }, [manual?.previewUrl]);

  const search = async () => {
    if (query.trim().length < 3) {
      setError('Escribe al menos tres caracteres.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResults(await giphyService.search(query));
    } catch (err: any) {
      setError(err.message || 'No se pudo buscar en GIPHY.');
    } finally {
      setLoading(false);
    }
  };

  const chooseGiphy = (item: GiphySelection) => {
    onManualChange(null);
    onGiphyChange(item);
    setResults([]);
  };

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      if (!allowedTypes.includes(file.type as any)) throw new Error('Usa GIF, WebP animado o MP4.');
      if (file.size > MAX_ANIMATION_SIZE) throw new Error('La animación debe pesar como máximo 1 MB.');

      if (file.type === 'video/mp4') {
        const metadata = await videoMetadata(file);
        if (metadata.duration > 6.1) throw new Error('El video debe durar como máximo 6 segundos.');
        if (Math.max(metadata.width, metadata.height) > 480) throw new Error('El video debe medir como máximo 480 px por lado.');
      } else {
        const dimensions = await imageDimensions(file);
        if (Math.max(dimensions.width, dimensions.height) > 480) throw new Error('La animación debe medir como máximo 480 px por lado.');
      }

      if (manual?.previewUrl) URL.revokeObjectURL(manual.previewUrl);
      onGiphyChange(null);
      onManualChange({
        file,
        mimeType: file.type as ManualAnimation['mimeType'],
        previewUrl: URL.createObjectURL(file),
      });
    } catch (err: any) {
      setError(err.message || 'No se pudo revisar la animación.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = () => {
    if (manual?.previewUrl) URL.revokeObjectURL(manual.previewUrl);
    onGiphyChange(null);
    onManualChange(null);
    onRemove();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>GIF</Text>
        <TouchableOpacity onPress={clear} style={styles.closeButton}>
          <Feather name="x" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {giphy ? <AnimatedMedia giphy={giphy} compact /> : manual ? (
        <AnimatedMedia fileUrl={manual.previewUrl} mimeType={manual.mimeType} compact />
      ) : (
        <>
          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, mode === 'giphy' && styles.tabActive]} onPress={() => setMode('giphy')}>
              <Text style={[styles.tabText, mode === 'giphy' && styles.tabTextActive]}>Buscar en GIPHY</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, mode === 'upload' && styles.tabActive]} onPress={() => setMode('upload')}>
              <Text style={[styles.tabText, mode === 'upload' && styles.tabTextActive]}>Subir archivo</Text>
            </TouchableOpacity>
          </View>

          {mode === 'giphy' ? (
            <>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder={giphyService.isConfigured ? 'Buscar reacción...' : 'Falta configurar la clave GIPHY'}
                  placeholderTextColor={theme.colors.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={search}
                  editable={giphyService.isConfigured}
                  returnKeyType="search"
                />
                <TouchableOpacity style={styles.searchButton} onPress={search} disabled={loading || !giphyService.isConfigured}>
                  {loading ? <ActivityIndicator size="small" color={theme.colors.text} /> : <Feather name="search" size={16} color={theme.colors.text} />}
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.results}>
                {results.map((item) => (
                  <TouchableOpacity key={item.id} onPress={() => chooseGiphy(item)} style={styles.result}>
                    <Image source={{ uri: item.stillUrl || item.webpUrl }} style={styles.resultImage} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.powered}>Powered by GIPHY</Text>
            </>
          ) : Platform.OS === 'web' ? (
            <>
              <input ref={inputRef} type="file" accept="image/gif,image/webp,video/mp4" style={{ display: 'none' }} onChange={chooseFile} />
              <TouchableOpacity style={styles.uploadButton} onPress={() => inputRef.current?.click()}>
                <Feather name="upload" size={18} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadTitle}>Elegir GIF, WebP o MP4</Text>
                  <Text style={styles.uploadHint}>Máx. 1 MB · 480 px · video de hasta 6 s</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.uploadHint}>La subida manual está disponible en la versión web.</Text>
          )}
        </>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, padding: theme.spacing.sm, marginBottom: theme.spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700' },
  closeButton: { padding: 4 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border, marginBottom: theme.spacing.sm },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: theme.colors.text },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: { flex: 1, height: 38, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, color: theme.colors.text, paddingHorizontal: 10 },
  searchButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6 },
  results: { gap: 8, paddingVertical: 8 },
  result: { width: 100, height: 100, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' },
  resultImage: { width: '100%', height: '100%' },
  powered: { color: theme.colors.textMuted, fontSize: 10, textAlign: 'right', marginTop: 4 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, padding: theme.spacing.md },
  uploadTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  uploadHint: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  error: { color: theme.colors.error, fontSize: 12, marginTop: 8 },
});
