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

// La barra siempre tiene el mismo formato de dos tramos, sin importar el estado del
// mercado: lo que efectivamente llevas invertido (costBasis, sólido) y una extensión más
// transparente hasta lo que recibirías si ese resultado gana (shares — 1 ℬ por acción,
// siempre, sin importar el precio). Antes de resolver, esa extensión es una proyección;
// al resolver a favor, la extensión pasa a ser simplemente lo ganado (shares == lo
// recibido), así que el formato no cambia — solo cambia el texto de abajo. La extensión
// nunca es negativa porque el precio LMSR siempre es menor a 100%: comprar una acción
// siempre cuesta menos de 1 ℬ, y costBasis se calcula con costo promedio ponderado (ver
// computeCostBasis en el backend), así que costBasis <= shares siempre. El único caso
// realmente distinto es haber perdido: ahí no hay nada que mostrar como extensión.
//
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

  const solidShares = Math.min(position.costBasis, position.shares);
  const solidPct = (solidShares / shares) * 100;
  // Si perdiste no queda nada que proyectar como extensión — en cualquier otro caso
  // (abierto, cerrado, ganaste, cancelado) la extensión llega hasta "shares", que es
  // exactamente lo que recibes en todos esos casos.
  let extPct = isLoser ? 0 : 100 - solidPct;
  // Piso mínimo de ancho para que la extensión nunca sea un hilo invisible cuando el
  // precio ya está muy cerca del 100% — mismo espíritu que el colchón que ya tiene
  // OddsChart para que los puntos del final de línea no queden cortados.
  if (extPct > 0 && extPct < MIN_VISIBLE_SEGMENT_PCT) extPct = MIN_VISIBLE_SEGMENT_PCT;

  let caption: string;
  if (status === 'resolved') {
    caption = isWinner
      ? `${position.costBasis} ℬ apostados → ${position.shares} ℬ ganados`
      : `${position.costBasis} ℬ apostados → Perdida`;
  } else if (status === 'cancelled') {
    caption = `${position.costBasis} ℬ apostados → ${position.shares} ℬ reembolsados`;
  } else {
    caption = `${position.costBasis} ℬ apostados → ${position.shares} ℬ si gana`;
  }

  return { trackWidthPct, solidPct, extPct, caption, isWinner, isLoser };
}
