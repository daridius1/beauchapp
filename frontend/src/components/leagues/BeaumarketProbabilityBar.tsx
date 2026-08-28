import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { OUTCOME_COLORS } from '../../screens/beaumarket/chartColors';

// Ancho mínimo de un segmento para que nunca sea un hilo invisible cuando un resultado
// tiene muy poca probabilidad — mismo criterio que positionBar.ts en Beaumarket.
const MIN_SEGMENT_PCT = 6;

interface BeaumarketProbabilityBarProps {
  // Siempre 3 posiciones en este orden: gana local, empate, gana visita — así lo arma
  // POST /api/liga/matches/accept al crear el mercado automático de un partido.
  prices: number[];
  winningOutcomeIndex: number | null;
  status: 'open' | 'closed' | 'resolved' | 'cancelled';
  onPress?: () => void;
}

// Normaliza los 3 porcentajes aplicando el piso mínimo sin perder que sumen 100 — a
// diferencia del bug ya corregido en positionBar.ts, acá si un segmento sube todos los
// demás se reparten la diferencia a prorrata de su propio tamaño, no solo el vecino.
function normalizeSegments(prices: number[]): number[] {
  const floored = prices.map((p) => Math.max(0, p));
  const withFloor = floored.map((p) => (p > 0 && p < MIN_SEGMENT_PCT ? MIN_SEGMENT_PCT : p));
  const total = withFloor.reduce((a, c) => a + c, 0);
  if (total <= 0) return floored.map(() => 100 / floored.length);
  return withFloor.map((p) => (p / total) * 100);
}

// Barra horizontal de 3 tramos con la probabilidad que predice el mercado de Beaumarket
// enlazado a un partido — mismo formato que una casilla de cuotas de un partido real
// (local / empate / visita), pero mostrando % de pozo apostado en vez de una cuota.
export const BeaumarketProbabilityBar: React.FC<BeaumarketProbabilityBarProps> = ({
  prices,
  winningOutcomeIndex,
  status,
  onPress,
}) => {
  if (!prices || prices.length !== 3) return null;
  const segments = normalizeSegments(prices);
  const labels = ['Local', 'Empate', 'Visita'];
  const isResolved = status === 'resolved' && winningOutcomeIndex !== null;

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper style={styles.container} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.header}>
        <Text style={styles.title}>Predicción de Beaumarket</Text>
        {status === 'cancelled' ? (
          <Text style={styles.statusMuted}>Mercado cancelado</Text>
        ) : (
          onPress && <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        )}
      </View>

      <View style={styles.track}>
        {segments.map((widthPct, idx) => (
          <View
            key={idx}
            style={[
              styles.segment,
              {
                width: `${widthPct}%`,
                backgroundColor: OUTCOME_COLORS[idx],
                opacity: isResolved && winningOutcomeIndex !== idx ? 0.35 : 1,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.legendRow}>
        {labels.map((label, idx) => (
          <View key={idx} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: OUTCOME_COLORS[idx] }]} />
            <Text style={[styles.legendLabel, isResolved && winningOutcomeIndex === idx && styles.legendLabelWinner]}>
              {label} {Math.round(prices[idx])}%
            </Text>
          </View>
        ))}
      </View>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusMuted: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  track: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  segment: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  legendLabelWinner: {
    fontWeight: '800',
  },
});
