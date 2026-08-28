// Lógica pura para dibujar la barra de "tu posición" que vive dentro de cada fila de
// leyenda de OddsChart (ya no es una sección aparte). Separada de LegendRow/OddsChart
// para poder razonar sobre ella sin JSX de por medio.
import { BeaumarketPosition } from '../../services/beaumarketService';

const MIN_TRACK_PCT = 1;
const MIN_VISIBLE_SEGMENT_PCT = 4;

export interface PositionBarSegments {
  // Ancho del "pill" de esta posición respecto al ancho completo de la fila — compara el
  // TAMAÑO entre posiciones distintas (apostar más se ve como una barra más larga).
  trackWidthPct: number;
  // Ancho del tramo sólido/extensión respecto al pill de ESTA posición (no de la fila
  // completa) — siempre solidPct + extPct = 100, así que "30 apostados de 60 si gana" se
  // ve literalmente como la mitad del pill, sin importar qué tan grande sea el pill en sí.
  solidPct: number;
  extPct: number;
  caption: string;
  isWinner: boolean;
  isLoser: boolean;
}

// La barra siempre tiene el mismo formato de dos tramos, sin importar el estado del
// mercado (incluida una posición perdedora): lo que efectivamente llevas apostado
// (amount, sólido) y una extensión hasta lo que recibirías si ese resultado gana
// (estimatedPayout). Antes de resolver, esa extensión es una proyección que se mueve con
// cada apuesta nueva de cualquiera en el mercado; al resolver a favor, pasa a ser
// simplemente lo ganado; al resolver en contra, sigue mostrando lo que se pudo haber
// ganado (nunca desaparece) — el formato de dos tramos no cambia en ningún estado, solo
// el texto de abajo y, para el caso perdedor, el color de la barra en sí (ver isLoser en
// LegendRow.tsx). La única excepción real es "cancelado": ahí no hay pago proyectado que
// mostrar, el reembolso es 1:1 lo apostado, así que el tramo sólido ocupa el pill entero.
//
// Esta proyección SOLO vive acá (seguimiento de una apuesta ya hecha) — el modal para
// apostar (TradeModal) nunca la muestra, justo porque en ese momento sería la promesa más
// engañosa (ver comentario de cabecera en beaumarket.pb.js).
//
// maxScale = el pago proyectado más grande (en ℬ) entre TODAS las posiciones que tiene el
// usuario en ese mercado — define qué tan largo se ve el pill de cada fila entre sí.
export function computePositionBar(
  position: BeaumarketPosition,
  status: string,
  winningOutcomeIndex: number | null,
  maxScale: number
): PositionBarSegments {
  const isWinner = status === 'resolved' && position.outcomeIndex === winningOutcomeIndex;
  const isLoser = status === 'resolved' && position.outcomeIndex !== winningOutcomeIndex;
  const isCancelled = status === 'cancelled';

  const pillSize = Math.max(position.amount, position.estimatedPayout, 1);
  const trackWidthPct = Math.max(MIN_TRACK_PCT, (pillSize / Math.max(1, maxScale)) * 100);

  let solidPct: number;
  if (isCancelled || position.estimatedPayout <= 0) {
    solidPct = 100;
  } else {
    solidPct = Math.min(100, (position.amount / position.estimatedPayout) * 100);
  }
  let extPct = 100 - solidPct;
  // Piso mínimo de ancho para que la extensión nunca sea un hilo invisible cuando la
  // ganancia proyectada es chica comparada con lo apostado. Recalcula solidPct después
  // del piso (no al revés) para que la invariante solidPct + extPct = 100 se mantenga
  // siempre — antes el piso solo subía extPct sin bajar solidPct, así que la barra podía
  // dibujarse con un ancho combinado de más de 100%.
  if (extPct > 0 && extPct < MIN_VISIBLE_SEGMENT_PCT) extPct = MIN_VISIBLE_SEGMENT_PCT;
  solidPct = 100 - extPct;

  let caption: string;
  if (status === 'resolved') {
    caption = isWinner
      ? `${position.amount} ℬ apostados → ${position.estimatedPayout} ℬ ganados`
      : `${position.amount} ℬ apostados → ${position.estimatedPayout} ℬ que pudiste ganar`;
  } else if (isCancelled) {
    caption = `${position.amount} ℬ apostados → ${position.amount} ℬ reembolsados`;
  } else {
    caption = `${position.amount} ℬ apostados → ${position.estimatedPayout} ℬ si gana`;
  }

  return { trackWidthPct, solidPct, extPct, caption, isWinner, isLoser };
}
