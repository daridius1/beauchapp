// Versión portada (solo para previsualización en el modal de compra) de las mismas
// fórmulas LMSR que viven en backend/pb_hooks/lib/beaumarket.js — el cálculo real y
// autoritativo de cuántas acciones se compran y a qué costo SIEMPRE lo hace el backend
// dentro de la transacción; esto solo evita que el usuario tenga que esperar un
// round-trip de red para ver una estimación mientras escribe el monto.

function prices(q: number[], b: number): number[] {
  const m = Math.max(...q);
  const exps = q.map((qi) => Math.exp((qi - m) / b));
  const sum = exps.reduce((a, c) => a + c, 0);
  return exps.map((e) => e / sum);
}

function logSumExp(values: number[]): number {
  const m = Math.max(...values);
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += Math.exp(values[i] - m);
  return m + Math.log(sum);
}

function costFunction(q: number[], b: number): number {
  return b * logSumExp(q.map((qi) => qi / b));
}

function costForShares(q: number[], b: number, outcomeIndex: number, deltaShares: number): number {
  const qAfter = q.slice();
  qAfter[outcomeIndex] += deltaShares;
  return costFunction(qAfter, b) - costFunction(q, b);
}

// Dado un presupuesto en puntos, cuántas acciones (fraccionarias, sin redondear) compra
// al estado actual de q/b. Ver la derivación completa en beaumarket.js.
export function sharesForBudget(q: number[], b: number, outcomeIndex: number, budgetPoints: number): number {
  let S = 0;
  for (let j = 0; j < q.length; j++) {
    if (j !== outcomeIndex) S += Math.exp(q[j] / b);
  }
  const oldTotal = S + Math.exp(q[outcomeIndex] / b);
  const inner = oldTotal * Math.exp(budgetPoints / b) - S;
  if (inner <= 0) return -Infinity;
  return b * Math.log(inner) - q[outcomeIndex];
}

export function previewBuy(q: number[], b: number, outcomeIndex: number, budgetPoints: number): { shares: number; priceAfterPct: number } {
  const rawShares = sharesForBudget(q, b, outcomeIndex, budgetPoints);
  const shares = Math.max(0, Math.floor(rawShares));
  const qAfter = q.slice();
  qAfter[outcomeIndex] += shares;
  const priceAfterPct = prices(qAfter, b)[outcomeIndex] * 100;
  return { shares, priceAfterPct };
}

// Espejo de previewBuy para el lado de venta — mismo redondeo (floor) que el backend
// usa en /api/beaumarket/sell, para que la previsualización no prometa más de lo que la
// ruta real vaya a entregar.
export function previewSell(q: number[], b: number, outcomeIndex: number, shares: number): { proceeds: number; priceAfterPct: number } {
  const proceeds = Math.max(0, Math.floor(-costForShares(q, b, outcomeIndex, -shares)));
  const qAfter = q.slice();
  qAfter[outcomeIndex] -= shares;
  const priceAfterPct = prices(qAfter, b)[outcomeIndex] * 100;
  return { proceeds, priceAfterPct };
}
