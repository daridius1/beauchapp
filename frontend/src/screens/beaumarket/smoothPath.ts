// Curva suave para las líneas de OddsChart — Catmull-Rom convertida a Bézier cúbica
// entre cada par de puntos consecutivos, en vez de las rectas de un Polyline. Con pocos
// puntos (el gráfico solo tiene hasta MAX_CHART_POINTS del backend) da un trazo curvo que
// pasa exactamente por cada punto real, sin necesitar ninguna librería externa de
// gráficos ni perder ningún dato — a diferencia de un suavizado por promedio móvil, que
// desplazaría los puntos de su valor real.
export interface Point {
  x: number;
  y: number;
}

// Factor 1/6 es la conversión estándar de tangente Catmull-Rom (tensión 1) a puntos de
// control de Bézier cúbica: en los extremos, sin vecino real de un lado, se usa el propio
// punto de borde como si fuera su propio vecino (tangente hacia el otro lado nada más).
export function smoothPathD(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}
