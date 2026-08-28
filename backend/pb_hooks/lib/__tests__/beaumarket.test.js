const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MIN_OUTCOMES, MAX_OUTCOMES, MAX_CHART_POINTS, MIN_CHART_POINTS,
    poolPercentages, payoutForStake, finalPayout, computePoolHistory,
} = require('../beaumarket.js');

test('constantes de rango de resultados', () => {
    assert.equal(MIN_OUTCOMES, 2);
    assert.equal(MAX_OUTCOMES, 10);
});

test('constantes del gráfico de oscilación', () => {
    assert.equal(MIN_CHART_POINTS, 2);
    assert.equal(MAX_CHART_POINTS, 60);
});

test('poolPercentages: pozo vacío -> reparto uniforme, no división por cero', () => {
    const p = poolPercentages([0, 0, 0]);
    p.forEach((pi) => assert.ok(Math.abs(pi - 100 / 3) < 1e-9));
});

test('poolPercentages: proporcional exacto a lo apostado en cada resultado', () => {
    assert.deepEqual(poolPercentages([30, 10, 60]), [30, 10, 60]);
    assert.deepEqual(poolPercentages([1, 1]), [50, 50]);
});

test('poolPercentages: siempre suma 100 sobre muchos pozos aleatorios (invariante)', () => {
    for (let i = 0; i < 200; i++) {
        const n = 2 + Math.floor(Math.random() * 8);
        const pool = Array.from({ length: n }, () => Math.floor(Math.random() * 1000));
        const sum = poolPercentages(pool).reduce((a, c) => a + c, 0);
        assert.ok(Math.abs(sum - 100) < 1e-9, `suma=${sum}`);
    }
});

test('payoutForStake: pozo del resultado ganador == pozo total -> cada quien recibe exactamente lo que apostó', () => {
    // Único resultado con apuestas: nadie más aporta al pozo total, así que no hay nada
    // extra que repartir — se recupera 1:1.
    assert.equal(payoutForStake(40, 100, 100), 40);
});

test('payoutForStake: reparte el pozo total a prorrata de la apuesta dentro del pozo ganador', () => {
    // Pozo ganador = 100 (40 míos + 60 de otra persona), pozo total = 250 (100 + 150 en
    // los resultados perdedores). Yo puse el 40% del pozo ganador -> recibo el 40% del
    // pozo total.
    assert.ok(Math.abs(payoutForStake(40, 100, 250) - 100) < 1e-9);
});

test('payoutForStake: pozo del resultado en 0 -> 0 (nunca división por cero)', () => {
    assert.equal(payoutForStake(0, 0, 500), 0);
});

test('payoutForStake: la suma de los pagos de TODAS las posiciones ganadoras agota exactamente el pozo total', () => {
    for (let i = 0; i < 100; i++) {
        const winnerStakes = Array.from({ length: 1 + Math.floor(Math.random() * 6) }, () => 1 + Math.floor(Math.random() * 500));
        const winnerPool = winnerStakes.reduce((a, c) => a + c, 0);
        const otherPools = Array.from({ length: 1 + Math.floor(Math.random() * 4) }, () => Math.floor(Math.random() * 500));
        const totalPool = winnerPool + otherPools.reduce((a, c) => a + c, 0);
        const totalPaid = winnerStakes.reduce((a, stake) => a + payoutForStake(stake, winnerPool, totalPool), 0);
        assert.ok(Math.abs(totalPaid - totalPool) < 1e-6, `totalPaid=${totalPaid} totalPool=${totalPool}`);
    }
});

test('finalPayout: redondea hacia abajo (breakage), nunca reparte de más', () => {
    // 1 de pozo ganador contra 10 de pozo total -> pago exacto = 10, entero limpio.
    assert.equal(finalPayout(1, 1, 10), 10);
    // 3 de pozo ganador (mío + de otra persona) contra 10 total -> mi pago exacto sería
    // 3.333..., que se recorta a 3 (nunca 4).
    assert.equal(finalPayout(1, 3, 10), 3);
});

test('finalPayout: la suma de pagos enteros a todos los ganadores nunca supera el pozo total (breakage acotado)', () => {
    for (let i = 0; i < 200; i++) {
        const winnerStakes = Array.from({ length: 1 + Math.floor(Math.random() * 8) }, () => 1 + Math.floor(Math.random() * 500));
        const winnerPool = winnerStakes.reduce((a, c) => a + c, 0);
        const otherPools = Array.from({ length: 1 + Math.floor(Math.random() * 4) }, () => Math.floor(Math.random() * 500));
        const totalPool = winnerPool + otherPools.reduce((a, c) => a + c, 0);
        const totalPaid = winnerStakes.reduce((a, stake) => a + finalPayout(stake, winnerPool, totalPool), 0);
        assert.ok(totalPaid <= totalPool, `totalPaid=${totalPaid} totalPool=${totalPool}`);
        // El breakage nunca puede ser tan grande como para perder un ganador entero de más.
        assert.ok(totalPool - totalPaid < winnerStakes.length);
    }
});

test('computePoolHistory: sin apuestas -> MIN_CHART_POINTS puntos, reparto uniforme constante', () => {
    const points = computePoolHistory([], 2, 1000, 5000, 60);
    assert.equal(points.length, MIN_CHART_POINTS);
    points.forEach((p) => {
        assert.ok(Math.abs(p.percentages[0] - 50) < 1e-9);
        assert.ok(Math.abs(p.percentages[1] - 50) < 1e-9);
    });
    assert.equal(points[0].t, 1000);
    assert.equal(points[points.length - 1].t, 5000);
});

test('computePoolHistory: la cantidad de puntos no supera bets.length + 1 aunque el techo sea mayor', () => {
    const bets = [
        { outcomeIndex: 0, amountDelta: 5, createdAtMs: 2000 },
        { outcomeIndex: 1, amountDelta: 3, createdAtMs: 3000 },
    ];
    const points = computePoolHistory(bets, 2, 1000, 5000, 60);
    assert.equal(points.length, 3); // bets.length + 1, no 60
});

test('computePoolHistory: la cantidad de puntos queda topada en maxPoints con muchas apuestas', () => {
    const bets = [];
    for (let i = 0; i < 500; i++) {
        bets.push({ outcomeIndex: i % 2, amountDelta: 1, createdAtMs: 1000 + i });
    }
    const points = computePoolHistory(bets, 2, 1000, 2000, 60);
    assert.equal(points.length, 60);
});

test('computePoolHistory: cada punto refleja el pozo acumulado hasta ese instante (last-observation-carried-forward)', () => {
    const bets = [
        { outcomeIndex: 0, amountDelta: 10, createdAtMs: 100 },
        { outcomeIndex: 1, amountDelta: 10, createdAtMs: 900 },
    ];
    const points = computePoolHistory(bets, 2, 0, 1000, 60);
    assert.equal(points.length, 3); // bets.length + 1: t=0, t=500, t=1000
    assert.equal(points[0].t, 0);
    assert.deepEqual(points[0].percentages, [50, 50]); // antes de cualquier apuesta
    assert.equal(points[1].t, 500);
    assert.deepEqual(points[1].percentages, [100, 0]); // solo entró la primera apuesta
    assert.equal(points[2].t, 1000);
    assert.deepEqual(points[2].percentages, [50, 50]); // pool [10,10] -> simétrico de nuevo
});

test('computePoolHistory: cada punto suma ~100% entre resultados', () => {
    const bets = [
        { outcomeIndex: 0, amountDelta: 6, createdAtMs: 1100 },
        { outcomeIndex: 1, amountDelta: 9, createdAtMs: 1200 },
        { outcomeIndex: 2, amountDelta: 3, createdAtMs: 1300 },
    ];
    const points = computePoolHistory(bets, 3, 1000, 2000, 60);
    points.forEach((p) => {
        const sum = p.percentages.reduce((s, x) => s + x, 0);
        assert.ok(Math.abs(sum - 100) < 1e-6, `suma de porcentajes = ${sum}`);
    });
});

test('computePoolHistory: ignora de forma defensiva un outcomeIndex fuera de rango', () => {
    const bets = [
        { outcomeIndex: 0, amountDelta: 10, createdAtMs: 1100 },
        { outcomeIndex: 5, amountDelta: 999, createdAtMs: 1200 }, // fuera de rango, se ignora
    ];
    const points = computePoolHistory(bets, 2, 1000, 2000, 60);
    const last = points[points.length - 1];
    assert.deepEqual(last.percentages, [100, 0]);
});

test('computePoolHistory: rango de tiempo degenerado (start === end) no revienta', () => {
    const points = computePoolHistory([], 2, 5000, 5000, 60);
    assert.equal(points.length, MIN_CHART_POINTS);
    points.forEach((p) => assert.equal(p.t, 5000));
});

test('computePoolHistory: acepta retiros (amountDelta negativo) sin romper el invariante de suma 100', () => {
    const bets = [
        { outcomeIndex: 0, amountDelta: 20, createdAtMs: 1100 },
        { outcomeIndex: 1, amountDelta: 20, createdAtMs: 1150 },
        { outcomeIndex: 0, amountDelta: -8, createdAtMs: 1300 },
    ];
    const points = computePoolHistory(bets, 2, 1000, 2000, 60);
    const last = points[points.length - 1];
    const sum = last.percentages.reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(sum - 100) < 1e-6);
    assert.deepEqual(last.percentages, [37.5, 62.5]); // pool final [12, 20] -> 12/32, 20/32
});
