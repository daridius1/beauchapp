import React, { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { spotifyService, SpotifyTrackResult } from '../services/spotifyService';
import { soundcloudService } from '../services/soundcloudService';
import { SpotifyEmbed } from './SpotifyEmbed';
import { SoundCloudEmbed } from './SoundCloudEmbed';

interface Props {
  spotifyTrackId: string | null;
  soundcloudUrl: string | null;
  onSpotifyChange: (trackId: string | null) => void;
  onSoundCloudChange: (url: string | null) => void;
  onRemove: () => void;
}

export const MusicComposer: React.FC<Props> = ({
  spotifyTrackId,
  soundcloudUrl,
  onSpotifyChange,
  onSoundCloudChange,
  onRemove,
}) => {
  const [tab, setTab] = useState<'spotify' | 'soundcloud'>(soundcloudUrl ? 'soundcloud' : 'spotify');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrackResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [soundcloudInput, setSoundcloudInput] = useState(soundcloudUrl || '');
  const [soundcloudError, setSoundcloudError] = useState('');
  const [validating, setValidating] = useState(false);

  const handleSpotifySearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      setResults(await spotifyService.search(q));
    } catch (err) {
      console.error('Error buscando en Spotify:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSpotifySelect = (track: SpotifyTrackResult) => {
    onSoundCloudChange(null);
    onSpotifyChange(track.id);
    setResults([]);
    setQuery('');
  };

  const handleSoundCloud = async () => {
    setValidating(true);
    setSoundcloudError('');
    try {
      const preview = await soundcloudService.preview(soundcloudInput);
      onSpotifyChange(null);
      onSoundCloudChange(preview.url);
      setSoundcloudInput(preview.url);
    } catch (err) {
      setSoundcloudError(err instanceof Error ? err.message : 'No se pudo validar el enlace.');
    } finally {
      setValidating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Música</Text>
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn} accessibilityLabel="Quitar música">
          <Feather name="x" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'spotify' && styles.tabActive]} onPress={() => setTab('spotify')}>
          <Text style={[styles.tabText, tab === 'spotify' && styles.tabTextActive]}>Spotify</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'soundcloud' && styles.tabActive]} onPress={() => setTab('soundcloud')}>
          <Text style={[styles.tabText, tab === 'soundcloud' && styles.tabTextActive]}>SoundCloud</Text>
        </TouchableOpacity>
      </View>

      {tab === 'spotify' ? (
        spotifyTrackId ? (
          <SpotifyEmbed key={spotifyTrackId} trackId={spotifyTrackId} compact />
        ) : (
          <>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Buscar canción o artista..."
                placeholderTextColor={theme.colors.textMuted}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSpotifySearch}
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.actionBtn} onPress={handleSpotifySearch} disabled={searching}>
                {searching ? <ActivityIndicator size="small" color={theme.colors.text} /> : <Feather name="search" size={16} color={theme.colors.text} />}
              </TouchableOpacity>
            </View>
            {results.map((track) => (
              <TouchableOpacity key={track.id} style={styles.resultRow} onPress={() => handleSpotifySelect(track)}>
                {track.imageUrl ? <Image source={{ uri: track.imageUrl }} style={styles.resultThumb} /> : <View style={[styles.resultThumb, styles.emptyThumb]}><Feather name="music" size={14} color={theme.colors.textMuted} /></View>}
                <View style={styles.resultText}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{track.name}</Text>
                  <Text style={styles.resultSubtitle} numberOfLines={1}>{[track.artist, track.year].filter(Boolean).join(' · ')}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )
      ) : soundcloudUrl ? (
        <SoundCloudEmbed key={soundcloudUrl} url={soundcloudUrl} />
      ) : (
        <>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Pega un enlace de SoundCloud..."
              placeholderTextColor={theme.colors.textMuted}
              value={soundcloudInput}
              onChangeText={setSoundcloudInput}
              onSubmitEditing={handleSoundCloud}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.actionBtn} onPress={handleSoundCloud} disabled={validating}>
              {validating ? <ActivityIndicator size="small" color={theme.colors.text} /> : <Feather name="arrow-right" size={16} color={theme.colors.text} />}
            </TouchableOpacity>
          </View>
          {!!soundcloudError && <Text style={styles.error}>{soundcloudError}</Text>}
          <Text style={styles.hint}>Acepta canciones y playlists públicas con inserción habilitada.</Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: theme.spacing.sm, marginBottom: theme.spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  removeBtn: { padding: 4 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tab: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6 },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: theme.colors.background },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, height: 38, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 10, color: theme.colors.text, fontSize: 13 },
  actionBtn: { width: 38, height: 38, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  resultThumb: { width: 32, height: 32, borderRadius: 4 },
  emptyThumb: { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  resultText: { flex: 1 },
  resultTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  resultSubtitle: { color: theme.colors.textMuted, fontSize: 12 },
  error: { color: theme.colors.error, fontSize: 12, marginTop: 6 },
  hint: { color: theme.colors.textMuted, fontSize: 11, marginTop: 7 },
});
