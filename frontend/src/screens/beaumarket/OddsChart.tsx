import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line as SvgLine, Circle } from 'react-native-svg';
import { theme } from '../../theme/theme';
import { BeaumarketOddsHistoryPoint, BeaumarketPosition } from '../../services/beaumarketService';
import { OUTCOME_COLORS } from './chartColors';
import { LegendRow } from './LegendRow';
import { computePositionBar } from './positionBar';
import { smoothPathD } from './smoothPath';

// Ancho de referencia SOLO para el primer render (antes de medir el contenedor real por
// onLayout) — nunca se usa para dibujar de verdad, así que no importa que no coincida
// con el ancho final.
const CHART_W = 300;
const CHART_H = 140;
const MARKER_RADIUS = 3;
// Deja aire a los costados y arriba/abajo para que el puntito del final de cada línea no
// quede pegado al borde del viewBox y se recorte a la mitad — el radio del punto más un
// colchón. Antes solo existía en X (el eje Y llegaba hasta el borde exacto en 0%/100%,
// así que la pelotita se cortaba a la mitad justo en esos casos).
const PLOT_PADDING_X = MARKER_RADIUS + 1;
const PLOT_PADDING_Y = MARKER_RADIUS + 1;

interface OddsChartProps {
  outcomes: string[];
  history: BeaumarketOddsHistoryPoint[];
  winningOutcomeIndex?: number | null;
  status: 'open' | 'closed' | 'resolved' | 'cancelled';
  // Posiciones vigentes del usuario — si tiene acciones en un resultado, su fila de
  // leyenda se extiende con la barra "invertido -> si gana" (ver positionBar.ts). No hay
  // una sección aparte de "tus posiciones".
  myPositions: BeaumarketPosition[];
  // La leyenda hace triple función: describe el gráfico, muestra tu posición y sirve
  // para operar — tocar un resultado abre el modal de compra/venta. Sin esto, la
  // leyenda queda solo informativa (ej. mercado ya cerrado/resuelto).
  onSelectOutcome?: (index: number) => void;
  disabled?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Escalera de intervalos "lindos" para las marcas de fecha del eje X — mismo espíritu
// que el algoritmo de ticks de D3/Highcharts: se elige el intervalo más chico que deje
// la cantidad de marcas dentro de TARGET_AXIS_LABEL_COUNT, en vez de mostrar una marca
// por cada punto (con mercados largos serían decenas, ilegible en un gráfico angosto).
const NICE_DAY_INTERVALS = [1, 2, 3, 5, 7, 10, 14, 21, 30, 60, 90, 180, 365, 730];
// 5 para que el eje X tenga el mismo ritmo visual que las 5 líneas horizontales del
// eje Y (100/75/50/25/0%) — ni denso ni vacío en un gráfico de este ancho.
const TARGET_AXIS_LABEL_COUNT = 5;

// Solo fechas de día (ej. "23/9"), nunca hora — y ninguna marca si todavía no pasó al
// menos un día completo (con todo ocurriendo "hoy", una fecha no aporta nada, solo
// ruido). Las marcas se alinean a medianoche real, no a un offset arbitrario desde minT.
function computeDateAxisLabels(minT: number, maxT: number): string[] {
  const spanDays = (maxT - minT) / DAY_MS;
  if (spanDays < 1) return [];

  let interval = NICE_DAY_INTERVALS[NICE_DAY_INTERVALS.length - 1];
  for (const candidate of NICE_DAY_INTERVALS) {
    if (spanDays / candidate <= TARGET_AXIS_LABEL_COUNT) {
      interval = candidate;
      break;
    }
  }

  const firstBoundary = new Date(minT);
  firstBoundary.setHours(0, 0, 0, 0);
  if (firstBoundary.getTime() < minT) {
    firstBoundary.setDate(firstBoundary.getDate() + 1);
  }

  const labels: string[] = [];
  let t = firstBoundary.getTime();
  while (t <= maxT) {
    const d = new Date(t);
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    t += interval * DAY_MS;
  }
  return labels;
}

export const OddsChart: React.FC<OddsChartProps> = ({ outcomes, history, winningOutcomeIndex, status, myPositions, onSelectOutcome, disabled }) => {
  // El viewBox del SVG usa el ancho REAL medido del contenedor (onLayout), no un ancho
  // fijo — con `width="100%"` pero un viewBox de ancho fijo (300), en un contenedor más
  // ancho el SVG estiraba el contenido horizontalmente sin estirarlo verticalmente
  // (distorsionaba la pelotita a óvalo y engrosaba las líneas de forma pareja). Al medir
  // el ancho real y usarlo también como viewBox, la escala siempre es 1:1 — cero
  // distorsión, sin importar qué tan ancha quede la vista.
  const [chartAreaWidth, setChartAreaWidth] = useState(CHART_W);
  const handleChartAreaLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - chartAreaWidth) > 0.5) setChartAreaWidth(w);
  };

  if (!history || history.length === 0) return null;

  // Referencia para que el pill de cada posición sea comparable en tamaño entre sí: la
  // posición más grande (en pago proyectado) ocupa el ancho completo, las demás se ven
  // más cortas en proporción. El reparto sólido/extensión DENTRO de cada pill no usa esta
  // escala (ver positionBar.ts) — así ambas cosas se leen bien a la vez.
  const maxPositionScale = Math.max(1, ...myPositions.map((p) => Math.max(p.amount, p.estimatedPayout)));

  // El eje X es tiempo real (history[i].t, en epoch ms) — la cantidad de puntos y su
  // espaciado ya vienen decididos por el backend (computeOddsHistoryByTime), no se
  // recalculan acá.
  const minT = history[0].t;
  const maxT = history[history.length - 1].t;
  const span = maxT - minT;
  const plotW = chartAreaWidth - PLOT_PADDING_X * 2;
  const plotH = CHART_H - PLOT_PADDING_Y * 2;
  const xFor = (t: number) => PLOT_PADDING_X + (span > 0 ? ((t - minT) / span) * plotW : plotW / 2);
  const yFor = (pct: number) => PLOT_PADDING_Y + plotH - (pct / 100) * plotH;
  const dateLabels = computeDateAxisLabels(minT, maxT);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Evolución de probabilidades</Text>

      <View style={styles.chartRow}>
        <View style={styles.chartArea} onLayout={handleChartAreaLayout}>
          <Svg width="100%" height={CHART_H} viewBox={`0 0 ${chartAreaWidth} ${CHART_H}`}>
            {[0, 25, 50, 75, 100].map((pct) => (
              <SvgLine
                key={pct}
                x1={0}
                x2={chartAreaWidth}
                y1={yFor(pct)}
                y2={yFor(pct)}
                stroke={theme.colors.border}
                strokeWidth={1}
              />
            ))}

            {outcomes.map((_, outcomeIdx) => {
              const color = OUTCOME_COLORS[outcomeIdx % OUTCOME_COLORS.length];
              const points = history.map((p) => ({ x: xFor(p.t), y: yFor(p.percentages[outcomeIdx] ?? 0) }));
              const last = history[history.length - 1];
              return (
                <React.Fragment key={outcomeIdx}>
                  <Path d={smoothPathD(points)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  <Circle cx={xFor(last.t)} cy={yFor(last.percentages[outcomeIdx] ?? 0)} r={MARKER_RADIUS} fill={color} />
                </React.Fragment>
              );
            })}
          </Svg>

          {dateLabels.length > 0 && (
            <View style={styles.timeAxisRow}>
              {dateLabels.map((label, i) => (
                <Text key={i} style={styles.timeAxisLabel}>{label}</Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.axisLabels}>
          {[100, 75, 50, 25, 0].map((pct) => (
            <Text key={pct} style={styles.axisLabel}>{pct}%</Text>
          ))}
        </View>
      </View>

      <View style={styles.legend}>
        {outcomes.map((label, idx) => {
          const color = OUTCOME_COLORS[idx % OUTCOME_COLORS.length];
          const last = history[history.length - 1];
          const pct = Math.round(last.percentages[idx] ?? 0);
          const isWinner = winningOutcomeIndex != null && winningOutcomeIndex === idx;
          const position = myPositions.find((p) => p.outcomeIndex === idx);
          const positionBar = position ? computePositionBar(position, status, winningOutcomeIndex ?? null, maxPositionScale) : null;

          return (
            <LegendRow
              key={idx}
              color={color}
              label={label}
              valueText={`${pct}%`}
              isWinner={isWinner}
              isLast={idx === outcomes.length - 1}
              disabled={disabled}
              positionBar={positionBar}
              onPress={onSelectOutcome ? () => onSelectOutcome(idx) : undefined}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  chartRow: {
    flexDirection: 'row',
  },
  axisLabels: {
    width: 32,
    height: CHART_H,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingLeft: 6,
  },
  axisLabel: {
    fontSize: 9,
    color: theme.colors.textMuted,
  },
  chartArea: {
    flex: 1,
  },
  timeAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeAxisLabel: {
    fontSize: 9,
    color: theme.colors.textMuted,
  },
  legend: {
    marginTop: theme.spacing.sm,
  },
});
