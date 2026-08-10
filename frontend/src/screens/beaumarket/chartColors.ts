// Paleta de colores por resultado (hasta 10, el máximo permitido por mercado),
// compartida entre OddsChart y su LegendRow (barra de posición) para que un mismo resultado se vea del
// mismo color en los dos gráficos.
export const OUTCOME_COLORS = [
  '#38bdf8', '#facc15', '#ef4444', '#22c55e', '#a78bfa',
  '#fb923c', '#f472b6', '#2dd4bf', '#94a3b8', '#eab308',
];

// Mezcla un color de la paleta de arriba con gris medio (mismo tono que
// theme.colors.textMuted, #888888) — usado para la barra de posición de un resultado
// perdedor: mucho más gris que el color normal, pero sin perderlo del todo.
// grayRatio en [0,1]: 0 = color original, 1 = gris puro.
export function mixWithGray(hex: string, grayRatio: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const gray = 0x88;
  const mix = (c: number) => Math.round(c * (1 - grayRatio) + gray * grayRatio);
  const toHex = (c: number) => mix(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
