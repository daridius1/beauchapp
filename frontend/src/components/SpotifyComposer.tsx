import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { spotifyService, SpotifyTrackResult } from '../services/spotifyService';
import { SpotifyEmbed } from './SpotifyEmbed';

interface SpotifyComposerProps {
  trackId: string | null;
  onChange: (trackId: string | null) => void;
  onRemove: () => void;
}

// UI inline para adjuntar una canción de Spotify al componer un post — mismo espíritu que
// PollComposer (sin botón de envío propio, el padre manda spotifyTrackId al publicar).
// Una vez elegida la canción se muestra con el propio SpotifyEmbed (mismo componente y
// mismo placeholder de carga que en Mis Canciones/Conoce Beauchef), no una vista previa
// aparte.
export const SpotifyComposer: React.FC<SpotifyComposerProps> = ({ trackId, onChange, onRemove }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrackResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
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

  const handleSelect = (track: SpotifyTrackResult) => {
    setResults([]);
    setQuery('');
    onChange(track.id);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Canción</Text>
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
          <Feather name="x" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {trackId ? (
        <SpotifyEmbed key={trackId} trackId={trackId} compact />
      ) : (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar canción o artista..."
              placeholderTextColor={theme.colors.textMuted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
              {searching ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                <Feather name="search" size={16} color={theme.colors.text} />
              )}
            </TouchableOpacity>
          </View>

          {results.map((track) => (
            <TouchableOpacity key={track.id} style={styles.resultRow} onPress={() => handleSelect(track)}>
              {track.imageUrl ? (
                <Image source={{ uri: track.imageUrl }} style={styles.resultThumb} />
              ) : (
                <View style={[styles.resultThumb, styles.resultThumbEmpty]}>
                  <Feather name="music" size={14} color={theme.colors.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle} numberOfLines={1}>{track.name}</Text>
                <Text style={styles.resultSubtitle} numberOfLines={1}>
                  {[track.artist, track.year].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  removeBtn: {
    padding: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 38,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    color: theme.colors.text,
    fontSize: 13,
  },
  searchBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  resultThumb: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  resultThumbEmpty: {
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  resultSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});
