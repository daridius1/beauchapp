import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { mixWithGray } from './chartColors';

const BAR_HEIGHT = 20;
// Verde tipo "check" de confirmación (mismo tono que el estado "Abierto" en la lista de
// mercados) — no un emoji de billete/ticket, un visto bueno tipo checkbox.
const WINNER_COLOR = '#22c55e';

// Fila de leyenda de ancho completo, usada por OddsChart — cuando es interactiva (hay
// onPress), también sirve como botón para operar ese resultado. Cuando el usuario tiene
// una posición vigente en ese resultado, la fila se extiende con una barra que muestra
// cuánto lleva invertido vs. cuánto recibiría si gana (ver positionBar.ts) — no hay una
// sección aparte de "tus posiciones", vive directamente acá, debajo del nombre y el
// porcentaje de cada opción.
interface LegendRowProps {
  color: string;
  label: string;
  valueText: string;
  isWinner?: boolean;
  isLast?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  positionBar?: { trackWidthPct: number; solidPct: number; extPct: number; caption: string; isLoser?: boolean } | null;
}

export const LegendRow: React.FC<LegendRowProps> = ({
  color,
  label,
  valueText,
  isWinner,
  isLast,
  onPress,
  disabled,
  positionBar,
}) => {
  const interactive = !!onPress && !disabled;

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowDivider]}
      activeOpacity={interactive ? 0.6 : 1}
      disabled={!interactive}
      onPress={onPress}
    >
      <View style={styles.headerRow}>
        <View style={[styles.dot, { backgroundColor: color }, isWinner && styles.dotWinnerGlow]} />
        <View style={styles.labelGroup}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          {isWinner && <Feather name="check-circle" size={13} color={WINNER_COLOR} style={styles.winnerIcon} />}
        </View>
        <Text style={[styles.value, { color }]}>{valueText}</Text>
        {/* Sin reservar espacio cuando no es interactivo — el label (flex:1) absorbe el
            ancho libre y el valor se corre hasta donde estaba el chevron. */}
        {interactive && <Feather name="chevron-right" size={16} color={theme.colors.textMuted} style={styles.chevron} />}
      </View>

      {positionBar && (() => {
        // Barra de un resultado perdedor: mucho más gris que el color normal (pero sin
        // perderlo del todo) — únicamente la barra, el texto de abajo mantiene su color
        // habitual. Los dos tramos (apostado/acciones que se pudieron ganar) se siguen
        // viendo igual de diferenciados entre sí (misma opacidad relativa de siempre).
        // La del ganador, en cambio, se resalta con un brillo sutil (mismo tono verde del
        // ícono de check).
        const barColor = positionBar.isLoser ? mixWithGray(color, 0.85) : color;
        return (
          <View style={styles.barBlock}>
            <View style={styles.trackOuter}>
              <View style={[styles.track, { width: `${positionBar.trackWidthPct}%` }, isWinner && styles.trackWinnerGlow]}>
                {/* overflow:hidden vive en este wrapper interno, no en "track" — si
                    quedara en el mismo view que el shadow del brillo, se recortaría
                    el brillo junto con el contenido. */}
                <View style={styles.trackClip}>
                  <View style={styles.barRow}>
                    <View style={[styles.bar, { width: `${positionBar.solidPct}%`, backgroundColor: barColor }]} />
                    {positionBar.extPct > 0 && (
                      <View style={[styles.bar, styles.barExtension, { width: `${positionBar.extPct}%`, backgroundColor: barColor }]} />
                    )}
                  </View>
                </View>
              </View>
            </View>
            <Text style={[styles.caption, { color }]}>{positionBar.caption}</Text>
          </View>
        );
      })()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingVertical: theme.spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  // Brillo para la opción ganadora una vez resuelto el mercado — mismo tono verde que el
  // ícono de check, sin cambiar el color propio de la opción.
  dotWinnerGlow: {
    shadowColor: WINNER_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  // flex:1 vive acá (no en "label" directamente) para que el ícono de ganador quede
  // pegado al texto ya truncado, en vez de empujado al borde derecho de la fila.
  labelGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  label: {
    flexShrink: 1,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  winnerIcon: {
    marginLeft: 5,
    flexShrink: 0,
  },
  value: {
    fontSize: 13,
    fontWeight: '800',
  },
  chevron: {
    marginLeft: 6,
  },
  barBlock: {
    marginTop: 8,
  },
  // Contenedor de ancho completo — nunca tiene fondo propio, solo le da a "track" el
  // 100% de referencia para que su ancho proporcional (trackWidthPct) sea comparable
  // entre las distintas posiciones del usuario.
  trackOuter: {
    height: BAR_HEIGHT,
  },
  // El "pill" real de esta posición: su ancho (trackWidthPct) compara el tamaño contra
  // las otras posiciones, pero su fondo gris + lo que se pinta adentro (solid/extension)
  // siempre suman exactamente el 100% de ESTE pill, nunca del contenedor completo.
  track: {
    height: BAR_HEIGHT,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.border,
  },
  trackClip: {
    height: '100%',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  trackWinnerGlow: {
    shadowColor: WINNER_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: WINNER_COLOR,
  },
  barRow: {
    flexDirection: 'row',
    height: '100%',
  },
  bar: {
    height: '100%',
  },
  barExtension: {
    opacity: 0.35,
  },
  caption: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
});
