import React, { useEffect, useRef } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme';
import { GiphySelection } from '../services/giphyService';

interface Props {
  fileUrl?: string;
  mimeType?: string;
  giphy?: GiphySelection | null;
  compact?: boolean;
}

export const AnimatedMedia: React.FC<Props> = ({ fileUrl, mimeType, giphy, compact = false }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoUrl = giphy?.mp4Url || (mimeType === 'video/mp4' ? fileUrl : '');
  const imageUrl = giphy?.webpUrl || fileUrl || '';

  useEffect(() => {
    if (Platform.OS !== 'web' || !videoRef.current) return;
    const video = videoRef.current;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (typeof IntersectionObserver === 'undefined') {
      if (!reducedMotion?.matches) video.play().catch(() => {});
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !reducedMotion?.matches) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }, { threshold: 0.15 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [videoUrl]);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          loop
          muted
          playsInline
          preload="metadata"
          poster={giphy?.stillUrl || undefined}
          style={{ width: '100%', maxHeight: compact ? 260 : 360, objectFit: 'contain', display: 'block' }}
        />
      ) : imageUrl ? (
        <Image source={{ uri: imageUrl }} style={[styles.image, compact && styles.imageCompact]} resizeMode="contain" />
      ) : null}
      {!!giphy && (
        <Text style={styles.attribution} numberOfLines={1}>
          Powered by GIPHY{giphy.username ? ` · ${giphy.username}` : ''}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  image: { width: '100%', height: 360 },
  imageCompact: { height: 260 },
  attribution: {
    color: theme.colors.textMuted,
    fontSize: 10,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
  },
});
