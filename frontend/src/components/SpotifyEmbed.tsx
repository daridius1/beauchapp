import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  trackId: string;
  compact?: boolean;
}

// Embed público de Spotify: no necesita token ni backend — el iframe/WebView carga directo
// desde open.spotify.com. Mismo patrón web=<iframe>/nativo=<WebView> que MarkdownRenderer.
// La altura del contenedor decide el layout que Spotify renderiza: ~80px da la barra
// compacta (fila de "Tus canciones"), ~152px da la versión con carátula (tarjeta de perfil).
export const SpotifyEmbed: React.FC<Props> = ({ trackId, compact = false }) => {
  const height = compact ? 80 : 152;
  const url = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;

  if (Platform.OS === 'web') {
    return (
      <iframe
        src={url}
        width="100%"
        height={height}
        style={{ border: 'none', borderRadius: 12, display: 'block' }}
        allow="encrypted-media"
        loading="lazy"
      />
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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  nativeContainer: { borderRadius: 12, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
