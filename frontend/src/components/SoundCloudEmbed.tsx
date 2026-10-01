import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '../theme/theme';

interface Props {
  url: string;
}

export const SoundCloudEmbed: React.FC<Props> = ({ url }) => {
  const [loaded, setLoaded] = useState(false);
  const height = 81;
  const playerUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false&maxheight=${height}`;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webContainer, { height }]}>
        {!loaded && <View style={styles.placeholder}><ActivityIndicator size="small" color={theme.colors.textMuted} /></View>}
        <iframe
          src={playerUrl}
          width="100%"
          height={height}
          style={{ border: 'none', borderRadius: 8, display: 'block', opacity: loaded ? 1 : 0 }}
          allow="autoplay"
          loading="lazy"
          onLoad={() => setLoaded(true)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.nativeContainer, { height }]}>
      <WebView
        source={{ uri: playerUrl }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        scrollEnabled={false}
        startInLoadingState
        renderLoading={() => <View style={styles.placeholder}><ActivityIndicator size="small" color={theme.colors.textMuted} /></View>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  webContainer: { position: 'relative' },
  nativeContainer: { borderRadius: 8, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
