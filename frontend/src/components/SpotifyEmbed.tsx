import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '../theme/theme';

interface Props {
  trackId: string;
  compact?: boolean;
}

// Embed público de Spotify: no necesita token ni backend — el iframe/WebView carga directo
// desde open.spotify.com. Mismo patrón web=<iframe>/nativo=<WebView> que MarkdownRenderer.
// La altura del contenedor decide el layout que Spotify renderiza: ~80px da la barra
// compacta (fila de "Tus canciones"), ~152px da la versión con carátula (tarjeta de perfil).
export const SpotifyEmbed: React.FC<Props> = ({ trackId, compact = false }) => {
  const [loaded, setLoaded] = useState(false);
  const height = compact ? 80 : 152;
  const url = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;

  // El caller ya pone `key={trackId}` en cada uso (evita que el iframe/WebView reuse el
  // src viejo al cambiar de canción) — eso mismo hace que `loaded` arranque en false de
  // nuevo por cada trackId sin necesidad de un efecto que lo resetee acá.
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webContainer, { height }]}>
        {!loaded && (
          <View style={[styles.placeholder, { height }]}>
            <ActivityIndicator size="small" color={theme.colors.textMuted} />
          </View>
        )}
        <iframe
          src={url}
          width="100%"
          height={height}
          style={{ border: 'none', borderRadius: 12, display: 'block', opacity: loaded ? 1 : 0 }}
          allow="encrypted-media"
          loading="lazy"
          onLoad={() => setLoaded(true)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.nativeContainer, { height }]}>
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.placeholder, { height }]}>
            <ActivityIndicator size="small" color={theme.colors.textMuted} />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  webContainer: { position: 'relative' },
  nativeContainer: { borderRadius: 12, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderRadius: 12,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
