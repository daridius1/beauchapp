// Curva suave para las líneas de OddsChart — interpolación cúbica MONÓTONA (método de
// Steffen, el mismo de curveMonotoneX de D3) convertida a Bézier entre cada par de puntos
// consecutivos, en vez de las rectas de un Polyline. Pasa exactamente por cada punto real,
// sin librerías externas y sin desplazar ningún dato (a diferencia de un promedio móvil).
//
// Antes era Catmull-Rom, que sobrepasa: tras un salto brusco (ej. 0% → 100% y después
// plano) la curva se inflaba más allá del 100% o por debajo del 0%, se salía del viewBox y
// la línea aparecía cortada. Además dibujaba máximos y mínimos que nunca ocurrieron. Con
// la versión monótona cada tramo queda dentro del rango de sus dos puntos, así que es
// imposible salirse de 0–100 y un tramo plano se ve plano.
export interface Point {
  x: number;
  y: number;
}

const sign = (v: number) => (v < 0 ? -1 : 1);

// Pendiente en el punto interior (x1, y1). Si las secantes de ambos lados tienen signo
// distinto el punto es un extremo local y la tangente queda horizontal — eso es lo que
// impide el sobrepaso. El tope min(|s0|, |s1|, |p|/2) garantiza que el tramo sea monótono.
// Con x repetidos (h = 0) la división da ±Infinity/NaN; el `|| 0` final cubre el NaN.
function interiorSlope(p0: Point, p1: Point, p2: Point): number {
  const h0 = p1.x - p0.x;
  const h1 = p2.x - p1.x;
  const s0 = (p1.y - p0.y) / h0;
  const s1 = (p2.y - p1.y) / h1;
  const p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}

// Pendiente en un extremo, a partir de la del vecino interior: queda entre la mitad y
// 1,5 veces la secante del tramo, así que ese tramo también es monótono.
function endSlope(a: Point, b: Point, neighborSlope: number): number {
  const h = b.x - a.x;
  return h ? (3 * (b.y - a.y) / h - neighborSlope) / 2 : neighborSlope;
}

export function smoothPathD(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

  const n = points.length;
  const slopes = new Array<number>(n);
  for (let i = 1; i < n - 1; i++) {
    slopes[i] = interiorSlope(points[i - 1], points[i], points[i + 1]);
  }
  slopes[0] = endSlope(points[0], points[1], slopes[1]);
  slopes[n - 1] = endSlope(points[n - 2], points[n - 1], slopes[n - 2]);

  // Hermite → Bézier: los puntos de control van a un tercio del ancho del tramo en X, así
  // que la curva nunca retrocede en el tiempo aunque los puntos estén espaciados desigual.
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = (b.x - a.x) / 3;
    d += ` C ${a.x + dx},${a.y + dx * slopes[i]} ${b.x - dx},${b.y - dx * slopes[i + 1]} ${b.x},${b.y}`;
  }
  return d;
}
