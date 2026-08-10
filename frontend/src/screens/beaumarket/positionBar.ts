// Lógica pura para dibujar la barra de "tu posición" que vive dentro de cada fila de
// leyenda de OddsChart (ya no es una sección aparte). Separada de LegendRow/OddsChart
// para poder razonar sobre ella sin JSX de por medio.
import { BeaumarketPosition } from '../../services/beaumarketService';

// Piso mínimo de ancho — sin acciones (posición cerrada del todo, vendida completa) el
// pill igual se dibuja, como una línea delgada del color del resultado, en vez de
// desaparecer por completo (0% de ancho sería invisible).
const MIN_TRACK_PCT = 1;

export interface PositionBarSegments {
  // Ancho del pill de esta posición respecto al ancho completo de la fila — compara el
  // TAMAÑO entre posiciones distintas (más acciones se ve como una barra más larga). Es
  // lo único que representa la barra: cuántas acciones tienes en ese resultado, sin
  // partirla en tramos.
  trackWidthPct: number;
  caption: string;
  isWinner: boolean;
  isLoser: boolean;
}

// El texto de abajo (caption) mantiene siempre el mismo formato de dos números, sin
// importar el estado del mercado: lo invertido (netInvested, puede ser negativo si ya
// recuperaste de sobra vendiendo parte de la posición) y lo que recibirías si ese
// resultado gana (shares — 1 ℬ por acción, siempre, sin importar el precio). Antes de
// resolver esa segunda cifra es una proyección; al resolver a favor pasa a ser lo
// ganado; al resolver en contra, sigue mostrando lo que se pudo haber ganado (nunca
// desaparece) — el formato no cambia en ningún estado, solo el texto de abajo y, para el
// caso perdedor, el color de la barra en sí (ver isLoser en LegendRow.tsx).
//
// maxScale = la posición más grande (en acciones) entre TODAS las que tiene el usuario en
// ese mercado — define qué tan largo se ve el pill de cada fila entre sí.
export function computePositionBar(
  position: BeaumarketPosition,
  status: string,
  winningOutcomeIndex: number | null,
  maxScale: number
): PositionBarSegments {
  const isWinner = status === 'resolved' && position.outcomeIndex === winningOutcomeIndex;
  const isLoser = status === 'resolved' && position.outcomeIndex !== winningOutcomeIndex;
  const trackWidthPct = Math.max(MIN_TRACK_PCT, (position.shares / Math.max(1, maxScale)) * 100);

  let caption: string;
  if (status === 'resolved') {
    caption = isWinner
      ? `${position.netInvested} ℬ invertidos → ${position.shares} ℬ ganados`
      : `${position.netInvested} ℬ invertidos → ${position.shares} ℬ que pudiste ganar`;
  } else if (status === 'cancelled') {
    caption = `${position.netInvested} ℬ invertidos → ${position.shares} ℬ reembolsados`;
  } else {
    caption = `${position.netInvested} ℬ invertidos → ${position.shares} ℬ si gana`;
  }

  return { trackWidthPct, caption, isWinner, isLoser };
}
