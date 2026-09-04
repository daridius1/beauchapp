import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, GestureResponderEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { theme } from '../theme/theme';

interface Props {
  uri: string | null;
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Reproductor simple: play/pause + barra de progreso tocable para saltar de posición.
export const SongPlayer: React.FC<Props> = ({ uri }) => {
  const player = useAudioPlayer(uri || undefined);
  const status = useAudioPlayerStatus(player);

  const [barWidth, setBarWidth] = React.useState(0);

  // Al desmontar (ej. se cierra el formulario tras guardar) el audio debe pararse — expo-audio
  // en web no siempre lo hace solo, y quedaba sonando de fondo después de guardar la canción.
  React.useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // El player ya pudo haber sido liberado por el hook.
      }
    };
  }, [player]);

  if (!uri) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Sin canción subida.</Text>
      </View>
    );
  }

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;

  const handleSeek = (e: GestureResponderEvent) => {
    if (!status.duration || !barWidth) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / barWidth));
    player.seekTo(ratio * status.duration);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.playBtn}
        activeOpacity={0.8}
        onPress={() => (status.playing ? player.pause() : player.play())}
      >
        <Feather name={status.playing ? 'pause' : 'play'} size={20} color="#000" />
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={styles.progressBar}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          onPress={handleSeek}
        >
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </TouchableOpacity>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(status.currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(status.duration)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#262626',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
});
