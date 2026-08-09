// Lógica pura (sin `$app`) para Beaumarket — market maker automático LMSR (Logarithmic
// Market Scoring Rule, Robin Hanson). Ver backend/pb_hooks/beaumarket.pb.js para la
// orquestación con $app y backend/pb_hooks/lib/__tests__/beaumarket.test.js para los
// tests (incluyen los mismos números verificados a mano con `node` antes de escribir
// este archivo).
//
// q = vector de acciones netas en circulación por resultado (uno por outcome, arranca
// en todo ceros = precio uniforme 1/n). b = parámetro de liquidez: más alto = precio más
// "pesado" (hace falta más volumen para moverlo), más bajo = más sensible/dramático.
//
// Fórmulas (verificadas numéricamente, no solo de memoria, antes de implementar):
//   C(q)                    = b * ln(Σ e^(qᵢ/b))                    — función de costo
//   pᵢ(q)                   = e^(qᵢ/b) / Σ e^(qⱼ/b)                 — precio marginal
//   costo de Δ acciones de i = C(q con qᵢ+=Δ) - C(q)
//   inversión cerrada: dado un presupuesto X, cuántas acciones Δ compra sin necesitar
//   búsqueda iterativa:
//     Δ = b * ln((S + e^(qᵢ/b)) * e^(X/b) - S) - qᵢ,  S = Σ_{j≠i} e^(qⱼ/b)
//   pérdida máxima de la casa para SIEMPRE en ese mercado, sin importar qué tan
//   adversarial sea el trading: b * ln(n)  (n = cantidad de resultados)

const MIN_OUTCOMES = 2;
const MAX_OUTCOMES = 10;
const DEFAULT_B = 30;
const MIN_B = 5;
const MAX_B = 500;

// Techo visual de puntos del gráfico de oscilación (mismo razonamiento documentado ya en
// este proyecto para el gráfico de probabilidades: en un gráfico de línea de celular
// pasado cierto punto los puntos dejan de aportar información y se vuelven ruido).
const MAX_CHART_POINTS = 60;
const MIN_CHART_POINTS = 2;

// Log-sum-exp con el truco de restar el máximo antes de exponenciar — sin esto, un
// mercado con harto volumen acumulado (q grande) puede hacer que Math.exp reviente a
// Infinity. Es barato hacerlo siempre, así que se hace siempre, no solo cuando "hace
// falta".
function logSumExp(values) {
    const m = Math.max(...values);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
        sum += Math.exp(values[i] - m);
    }
    return m + Math.log(sum);
}

function costFunction(q, b) {
    return b * logSumExp(q.map((qi) => qi / b));
}

// Devuelve un array de precios (0..1) que siempre suma 1.
function prices(q, b) {
    const m = Math.max(...q);
    const exps = q.map((qi) => Math.exp((qi - m) / b));
    const sum = exps.reduce((a, c) => a + c, 0);
    return exps.map((e) => e / sum);
}

// Costo de mover el resultado outcomeIndex en deltaShares (positivo = comprar, negativo
// = vender). Positivo = el usuario paga; negativo = el usuario recibe.
function costForShares(q, b, outcomeIndex, deltaShares) {
    const qAfter = q.slice();
    qAfter[outcomeIndex] += deltaShares;
    return costFunction(qAfter, b) - costFunction(q, b);
}

// Inversión cerrada: dado un presupuesto en puntos, cuántas acciones (reales, sin
// redondear todavía — quien llama debe hacer Math.floor y recalcular el costo exacto de
// esa cantidad entera, ver beaumarket.pb.js) compra ese presupuesto al estado actual.
function sharesForBudget(q, b, outcomeIndex, budgetPoints) {
    let S = 0;
    for (let j = 0; j < q.length; j++) {
        if (j !== outcomeIndex) S += Math.exp(q[j] / b);
    }
    const oldTotal = S + Math.exp(q[outcomeIndex] / b);
    const inner = oldTotal * Math.exp(budgetPoints / b) - S;
    if (inner <= 0) return -Infinity; // presupuesto no alcanza ni para una fracción de acción
    return b * Math.log(inner) - q[outcomeIndex];
}

// Pérdida máxima teórica de la casa para este mercado, sin importar qué tan adversarial
// sea el trading — la garantía matemática central de LMSR.
function maxLoss(b, outcomeCount) {
    return b * Math.log(outcomeCount);
}

// trades: [{ outcomeIndex, sharesDelta, createdAtMs }], YA ordenadas cronológicamente
// (ascendente) por quien llama. rangeStartMs/rangeEndMs delimitan el eje X (creación del
// mercado -> ahora, o -> cuándo se resolvió/canceló si ya terminó). La cantidad de
// puntos se decide acá (backend, no en el frontend): al menos MIN_CHART_POINTS, hasta
// MAX_CHART_POINTS, y no más que trades.length + 1.
function computeLmsrPriceHistory(trades, outcomeCount, b, rangeStartMs, rangeEndMs, maxPoints) {
    const cap = maxPoints || MAX_CHART_POINTS;
    const numBuckets = Math.min(cap, Math.max(MIN_CHART_POINTS, trades.length + 1));

    const q = new Array(outcomeCount).fill(0);
    const safeEnd = Math.max(rangeEndMs, rangeStartMs);
    const span = safeEnd - rangeStartMs;

    let tradeIdx = 0;
    const points = [];
    for (let i = 0; i < numBuckets; i++) {
        const t = numBuckets > 1 ? rangeStartMs + (i / (numBuckets - 1)) * span : safeEnd;
        while (tradeIdx < trades.length && trades[tradeIdx].createdAtMs <= t) {
            const tr = trades[tradeIdx];
            if (tr.outcomeIndex >= 0 && tr.outcomeIndex < outcomeCount) {
                q[tr.outcomeIndex] += tr.sharesDelta;
            }
            tradeIdx++;
        }
        points.push({ t, percentages: prices(q, b).map((p) => p * 100) });
    }

    return points;
}

// Costo base (en ℬ) de la posición VIGENTE en cada resultado — cuánto llevas realmente
// invertido en las acciones que todavía tienes, no el neto de caja histórico. Usa
// promedio ponderado de costo (el mismo método que cualquier cartera de acciones: al
// vender una fracción de la posición, se libera esa misma fracción del costo base
// acumulado, sin importar a qué precio se vendió) en vez de simplemente restar los
// ingresos de la venta del total gastado — esa resta ingenua puede dejar un costBasis
// mayor a las acciones que quedan si vendiste con el precio más bajo que cuando
// compraste, lo cual rompe la garantía de que costBasis <= shares (ver README de
// costForShares: comprar siempre cuesta menos de 1 ℬ por acción porque el precio LMSR
// siempre es menor a 100%, así que el costo promedio ponderado de cualquier posición
// vigente SIEMPRE es menor a la cantidad de acciones que la componen).
// trades: [{ outcomeIndex, sharesDelta, cost, createdAtMs }] de un usuario en un
// mercado, en cualquier orden — se ordenan acá. Devuelve { [outcomeIndex]: costBasis }.
function computeCostBasis(trades) {
    const sorted = trades.slice().sort((a, b) => a.createdAtMs - b.createdAtMs);
    const shares = {};
    const costBasis = {};
    sorted.forEach((t) => {
        const idx = t.outcomeIndex;
        const heldShares = shares[idx] || 0;
        const heldCost = costBasis[idx] || 0;
        if (t.sharesDelta > 0) {
            shares[idx] = heldShares + t.sharesDelta;
            costBasis[idx] = heldCost + t.cost;
        } else if (t.sharesDelta < 0) {
            const sold = -t.sharesDelta;
            const avgCost = heldShares > 0 ? heldCost / heldShares : 0;
            shares[idx] = heldShares - sold;
            costBasis[idx] = Math.max(0, heldCost - avgCost * sold);
        }
    });
    return costBasis;
}

module.exports = {
    MIN_OUTCOMES, MAX_OUTCOMES, DEFAULT_B, MIN_B, MAX_B, MAX_CHART_POINTS, MIN_CHART_POINTS,
    costFunction, prices, costForShares, sharesForBudget, maxLoss, computeLmsrPriceHistory,
    computeCostBasis,
};
