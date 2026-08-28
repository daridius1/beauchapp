// Lógica pura (sin `$app`) para Beaumarket — pari-mutuel: cada apuesta va directo al
// pozo del resultado elegido (sin market maker, sin curva de precio), el porcentaje que
// se muestra es proporcional a lo apostado, y al resolver el pozo total se reparte entre
// quienes acertaron a prorrata de su apuesta. Ver backend/pb_hooks/beaumarket.pb.js para
// la orquestación con $app y backend/pb_hooks/lib/__tests__/beaumarket.test.js para los
// tests.
//
// pool = vector de ℬ apostados por resultado (uno por outcome, arranca en todo ceros).
// La casa nunca gana ni pierde: todo lo que entra al pozo sale repartido entre los
// ganadores, nunca menos ni más — a diferencia del LMSR anterior, acá no hay ninguna
// garantía matemática de pérdida máxima que razonar porque no hay pérdida posible.

const MIN_OUTCOMES = 2;
const MAX_OUTCOMES = 10;

// Techo visual de puntos del gráfico de oscilación (mismo razonamiento documentado ya en
// este proyecto para el gráfico de probabilidades: en un gráfico de línea de celular
// pasado cierto punto los puntos dejan de aportar información y se vuelven ruido).
const MAX_CHART_POINTS = 60;
const MIN_CHART_POINTS = 2;

// Porcentaje de cada resultado — directamente su fracción del pozo total, sin ninguna
// fórmula exponencial de por medio. Con el pozo todavía vacío (mercado recién creado, sin
// ninguna apuesta) no hay de dónde sacar una proporción real, así que se reparte parejo
// entre los resultados en vez de dividir por cero.
function poolPercentages(pool) {
    const total = pool.reduce((a, c) => a + c, 0);
    if (total <= 0) return pool.map(() => 100 / pool.length);
    return pool.map((p) => (p / total) * 100);
}

// Pago (como número real, sin redondear todavía) de una apuesta de stakeAmount sobre un
// resultado cuyo pozo — CONTANDO esa misma apuesta ya sumada adentro — es outcomePool,
// contra un pozo total (de todos los resultados) de totalPool. Es la fórmula central de
// pari-mutuel: tu parte del pozo total es proporcional a qué fracción del pozo del
// resultado ganador pusiste tú. outcomePool siempre es > 0 acá porque, para que exista
// una apuesta a repartir, tuvo que haber al menos esa apuesta en el pozo.
function payoutForStake(stakeAmount, outcomePool, totalPool) {
    if (outcomePool <= 0) return 0;
    return (stakeAmount * totalPool) / outcomePool;
}

// Pago final entero al resolver un mercado — redondeado hacia abajo. El resto que sobra
// por el redondeo se queda sin repartir (breakage): es la práctica estándar en apuestas
// pari-mutuel reales, y la única forma de garantizar que la suma de todos los pagos
// nunca supere el pozo total disponible.
function finalPayout(stakeAmount, outcomePool, totalPool) {
    return Math.floor(payoutForStake(stakeAmount, outcomePool, totalPool));
}

// bets: [{ outcomeIndex, amountDelta, createdAtMs }], YA ordenadas cronológicamente
// (ascendente) por quien llama. rangeStartMs/rangeEndMs delimitan el eje X (creación del
// mercado -> ahora, o -> cuándo se cerró/resolvió/canceló, si ya terminó). La cantidad de
// puntos se decide acá (backend, no en el frontend): al menos MIN_CHART_POINTS, hasta
// MAX_CHART_POINTS, y no más que bets.length + 1. Mismo espíritu que el histórico LMSR
// anterior, pero la reconstrucción es una suma acumulada simple en vez de una curva
// exponencial: el pozo de cada resultado en el instante t es la suma de todo
// amountDelta con created <= t.
function computePoolHistory(bets, outcomeCount, rangeStartMs, rangeEndMs, maxPoints) {
    const cap = maxPoints || MAX_CHART_POINTS;
    const numBuckets = Math.min(cap, Math.max(MIN_CHART_POINTS, bets.length + 1));

    const pool = new Array(outcomeCount).fill(0);
    const safeEnd = Math.max(rangeEndMs, rangeStartMs);
    const span = safeEnd - rangeStartMs;

    let betIdx = 0;
    const points = [];
    for (let i = 0; i < numBuckets; i++) {
        const t = numBuckets > 1 ? rangeStartMs + (i / (numBuckets - 1)) * span : safeEnd;
        while (betIdx < bets.length && bets[betIdx].createdAtMs <= t) {
            const b = bets[betIdx];
            if (b.outcomeIndex >= 0 && b.outcomeIndex < outcomeCount) {
                pool[b.outcomeIndex] += b.amountDelta;
            }
            betIdx++;
        }
        points.push({ t, percentages: poolPercentages(pool) });
    }

    return points;
}

module.exports = {
    MIN_OUTCOMES, MAX_OUTCOMES, MAX_CHART_POINTS, MIN_CHART_POINTS,
    poolPercentages, payoutForStake, finalPayout, computePoolHistory,
};
