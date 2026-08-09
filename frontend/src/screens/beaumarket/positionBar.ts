// Lógica pura para dibujar la barra de "tu posición" que vive dentro de cada fila de
// leyenda de OddsChart (ya no es una sección aparte). Separada de LegendRow/OddsChart
// para poder razonar sobre ella sin JSX de por medio.
import { BeaumarketPosition } from '../../services/beaumarketService';

const MIN_VISIBLE_SEGMENT_PCT = 4;

export interface PositionBarSegments {
  // Ancho del "pill" de esta posición respecto al ancho completo de la fila — compara el
  // TAMAÑO entre posiciones distintas (apostar más se ve como una barra más larga).
  trackWidthPct: number;
  // Ancho del tramo sólido/extensión respecto al pill de ESTA posición (no de la fila
  // completa) — siempre solidPct + extPct = 100, así que "3 apostados de 4 si gana" se
  // ve literalmente como 3/4 del pill, sin importar qué tan grande sea el pill en sí.
  solidPct: number;
  extPct: number;
  caption: string;
  isWinner: boolean;
  isLoser: boolean;
}

// Mientras el resultado todavía no se conoce (mercado abierto o recién cerrado, sin
// resolver), la barra tiene dos tramos: lo que efectivamente llevas invertido
// (costBasis, sólido) y una extensión más transparente hasta lo que recibirías si ese
// resultado gana (shares — 1 ℬ por acción, siempre, sin importar el precio). La
// extensión nunca es negativa porque el precio LMSR siempre es menor a 100%: comprar una
// acción siempre cuesta menos de 1 ℬ, y costBasis se calcula con costo promedio
// ponderado (ver computeCostBasis en el backend), así que costBasis <= shares siempre.
function isProjecting(status: string): boolean {
  return status === 'open' || status === 'closed';
}

function finalValueFor(position: BeaumarketPosition, status: string, winningOutcomeIndex: number | null): number {
  if (status === 'resolved') return position.outcomeIndex === winningOutcomeIndex ? position.shares : 0;
  return position.shares; // cancelled: reembolso 1:1
}

// maxScale = la posición más grande (en acciones) entre TODAS las que tiene el usuario en
// ese mercado — define qué tan largo se ve el pill de cada fila entre sí. El reparto
// interno solid/extension del pill NO usa maxScale, usa las acciones de ESA posición
// nada más, para que el tramo sólido siempre se lea como la fracción correcta de SU
// propio pill.
export function computePositionBar(
  position: BeaumarketPosition,
  status: string,
  winningOutcomeIndex: number | null,
  maxScale: number
): PositionBarSegments {
  const isWinner = status === 'resolved' && position.outcomeIndex === winningOutcomeIndex;
  const isLoser = status === 'resolved' && position.outcomeIndex !== winningOutcomeIndex;
  const shares = Math.max(1, position.shares);
  const trackWidthPct = (position.shares / Math.max(1, maxScale)) * 100;

  if (isProjecting(status)) {
    const solidShares = Math.min(position.costBasis, position.shares);
    const solidPct = (solidShares / shares) * 100;
    let extPct = 100 - solidPct;
    // Piso mínimo de ancho para que la extensión nunca sea un hilo invisible cuando el
    // precio ya está muy cerca del 100% — mismo espíritu que el colchón que ya tiene
    // OddsChart para que los puntos del final de línea no queden cortados.
    if (extPct > 0 && extPct < MIN_VISIBLE_SEGMENT_PCT) extPct = MIN_VISIBLE_SEGMENT_PCT;
    return {
      trackWidthPct,
      solidPct,
      extPct,
      caption: `${position.costBasis} ℬ apostados → ${position.shares} ℬ si gana`,
      isWinner,
      isLoser,
    };
  }

  const finalValue = finalValueFor(position, status, winningOutcomeIndex);
  return {
    trackWidthPct,
    solidPct: (finalValue / shares) * 100,
    extPct: 0,
    caption: isLoser ? `${position.shares} acc. · Perdida` : `${position.shares} acc. · ${finalValue} ℬ`,
    isWinner,
    isLoser,
  };
}
