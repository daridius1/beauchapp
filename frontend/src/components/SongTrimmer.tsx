import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, TouchableOpacity, GestureResponderEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { theme } from '../theme/theme';

interface Props {
  uri: string;
  totalDuration: number;
  clipDuration: number;
  start: number;
  onChange: (start: number) => void;
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const TRACK_HEIGHT = 32;
const BASE_BAR_HEIGHT = 6;

// Selector de tramo: un bloque sólido de clipDuration segundos que se arrastra entero
// sobre la barra para elegir dónde empieza (no se puede cambiar cuánto dura). Tocar la
// barra fuera del bloque lo salta hasta ahí. Play solo reproduce dentro de
// [start, start+clipDuration] y vuelve al inicio del tramo al llegar al borde, en vez de
// seguir con el resto de la canción.
export const SongTrimmer: React.FC<Props> = ({ uri, totalDuration, clipDuration, start, onChange }) => {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const [barWidth, setBarWidth] = useState(0);
  const trackRef = useRef<View>(null);

  // Posición absoluta (en la página) del borde izquierdo de la barra, medida en el layout.
  // e.nativeEvent.locationX no sirve para esto: cuando el toque empieza sobre el bloque
  // (que está encimado sobre la barra), locationX viene relativo al bloque, no a la barra
  // completa. pageX en cambio es siempre absoluto, sea cual sea la vista que lo reporte.
  const trackPageLeft = useRef(0);

  // La posición mientras se arrastra vive acá, local, y solo se sube al padre (onChange) al
  // soltar — así un arrastre no dispara un re-render de toda la pantalla "Mi canción" en
  // cada pixel de movimiento.
  const [localStart, setLocalStart] = useState(start);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!draggingRef.current) setLocalStart(start);
  }, [start]);

  const windowEnd = localStart + clipDuration;

  useEffect(() => {
    if (!status.playing) return;
    if (status.currentTime >= windowEnd - 0.05 || status.currentTime < localStart - 0.05) {
      player.seekTo(localStart);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.currentTime, status.playing, localStart, windowEnd]);

  const handlePlayPause = () => {
    // Mientras se arrastra el bloque (o se lo salta desde otro punto de la barra) no se
    // puede reproducir — hay que soltar primero. draggingRef ya se pone en false recién al
    // soltar, así que este guard alcanza aunque el toque de "play" llegue a mitad de un gesto.
    if (draggingRef.current) return;
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.currentTime < localStart || status.currentTime >= windowEnd) {
      player.seekTo(localStart);
    }
    player.play();
  };

  const timeToX = (t: number) => (barWidth ? (t / totalDuration) * barWidth : 0);

  // Los PanResponder de más abajo se crean UNA SOLA VEZ (con useState lazy) para que el
  // gesto nunca dependa de que React vuelva a renderizar entre un evento y el siguiente —
  // recrearlos en cada render (como se hacía antes) podía cortar un arrastre a mitad de
  // camino y el bloque volvía a su posición original. Como no se recrean, sus callbacks no
  // pueden leer `start`/`barWidth` directo de los props/estado (quedarían pegados al valor
  // del primer render): leen siempre el valor más reciente a través de estos refs.
  const localStartRef = useRef(start);
  const barWidthRef = useRef(0);
  useEffect(() => {
    localStartRef.current = localStart;
  }, [localStart]);
  useEffect(() => {
    barWidthRef.current = barWidth;
  }, [barWidth]);

  const xToTimeLive = (x: number) =>
    barWidthRef.current ? (x / barWidthRef.current) * totalDuration : 0;
  const clampStart = (t: number) => Math.max(0, Math.min(totalDuration - clipDuration, t));

  const commit = (finalStart: number) => {
    draggingRef.current = false;
    player.seekTo(finalStart);
    onChange(finalStart);
  };

  // Snapshot de localStart al comienzo de cada gesto — gestureState.dx que entrega
  // PanResponder ya viene relativo a ese punto de partida, así que basta con sumarlo acá en
  // vez de andar leyendo el estado (que cambiaría en cada frame del arrastre).
  const startAtGesture = useRef(0);

  const [movePanResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        player.pause();
        draggingRef.current = true;
        startAtGesture.current = localStartRef.current;
      },
      onPanResponderMove: (_e, gesture) => {
        const dt = xToTimeLive(gesture.dx);
        setLocalStart(clampStart(startAtGesture.current + dt));
      },
      onPanResponderRelease: (_e, gesture) => {
        const dt = xToTimeLive(gesture.dx);
        commit(clampStart(startAtGesture.current + dt));
      },
      onPanResponderTerminate: (_e, gesture) => {
        const dt = xToTimeLive(gesture.dx);
        commit(clampStart(startAtGesture.current + dt));
      },
    })
  );

  const jumpWindowToPageX = (pageX: number) => {
    const t = xToTimeLive(pageX - trackPageLeft.current);
    setLocalStart(clampStart(t - clipDuration / 2));
  };

  const commitFromPageX = (pageX: number) => {
    const t = xToTimeLive(pageX - trackPageLeft.current);
    commit(clampStart(t - clipDuration / 2));
  };

  const [trackPanResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: (e: GestureResponderEvent) => {
        const t = xToTimeLive(e.nativeEvent.pageX - trackPageLeft.current);
        const s = localStartRef.current;
        return t < s || t > s + clipDuration;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        player.pause();
        draggingRef.current = true;
        jumpWindowToPageX(e.nativeEvent.pageX);
      },
      // Sigue el dedo/mouse aunque el gesto haya arrancado fuera del bloque, para que se
      // pueda arrastrar de corrido desde cualquier punto de la barra en vez de solo saltar.
      onPanResponderMove: (_e, gesture) => jumpWindowToPageX(gesture.moveX),
      onPanResponderRelease: (_e, gesture) => commitFromPageX(gesture.moveX),
      onPanResponderTerminate: (_e, gesture) => commitFromPageX(gesture.moveX),
    })
  );

  const windowLeft = timeToX(localStart);
  const windowWidth = Math.max(0, timeToX(windowEnd) - windowLeft);
  const playheadRatio =
    clipDuration > 0 ? Math.max(0, Math.min(1, (status.currentTime - localStart) / clipDuration)) : 0;
  const showPlayhead = status.currentTime >= localStart - 0.05 && status.currentTime <= windowEnd + 0.05;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.playBtn} activeOpacity={0.8} onPress={handlePlayPause}>
        <Feather name={status.playing ? 'pause' : 'play'} size={20} color="#000" />
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <View
          ref={trackRef}
          style={styles.track}
          onLayout={(e) => {
            setBarWidth(e.nativeEvent.layout.width);
            trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
              trackPageLeft.current = pageX;
            });
          }}
          {...trackPanResponder.panHandlers}
        >
          <View style={styles.baseBar} pointerEvents="none" />

          <View
            style={[styles.window, { left: windowLeft, width: windowWidth }, webCursor('grab')]}
            {...movePanResponder.panHandlers}
          >
            {showPlayhead && (
              <View pointerEvents="none" style={[styles.playhead, { left: `${playheadRatio * 100}%` }]} />
            )}
          </View>
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>
            {formatTime(localStart)} — {formatTime(windowEnd)}
          </Text>
          <Text style={styles.timeText}>{Math.round(clipDuration)}s</Text>
        </View>
      </View>
    </View>
  );
};

// Estilos que solo existen en CSS (cursor) no están en el tipo ViewStyle de RN — mismo
// patrón que EditProfileScreen/TinderScreen para inputs web-only.
const webCursor = (cursor: string) => ({ cursor } as any);

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
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    justifyContent: 'center',
  },
  baseBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (TRACK_HEIGHT - BASE_BAR_HEIGHT) / 2,
    height: BASE_BAR_HEIGHT,
    borderRadius: BASE_BAR_HEIGHT / 2,
    backgroundColor: '#262626',
  },
  window: {
    position: 'absolute',
    top: 0,
    height: TRACK_HEIGHT,
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
  },
  playhead: {
    position: 'absolute',
    top: -6,
    width: 2,
    height: TRACK_HEIGHT + 12,
    marginLeft: -1,
    backgroundColor: theme.colors.error,
    borderRadius: 1,
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
