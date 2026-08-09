const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MIN_OUTCOMES, MAX_OUTCOMES, MAX_CHART_POINTS, MIN_CHART_POINTS, DEFAULT_B, MIN_B, MAX_B,
    costFunction, prices, costForShares, sharesForBudget, maxLoss, computeLmsrPriceHistory,
    computeCostBasis,
} = require('../beaumarket.js');

test('constantes de rango de resultados y liquidez', () => {
    assert.equal(MIN_OUTCOMES, 2);
    assert.equal(MAX_OUTCOMES, 10);
    assert.equal(DEFAULT_B, 30);
    assert.equal(MIN_B, 5);
    assert.equal(MAX_B, 500);
});

test('constantes del gráfico de oscilación', () => {
    assert.equal(MIN_CHART_POINTS, 2);
    assert.equal(MAX_CHART_POINTS, 60);
});

test('costFunction: q todo ceros -> b*ln(n)', () => {
    assert.ok(Math.abs(costFunction([0, 0, 0], 10) - 10 * Math.log(3)) < 1e-9);
});

test('prices: q todo ceros -> precio uniforme 1/n, suma exacta 1', () => {
    const p = prices([0, 0, 0], 10);
    p.forEach((pi) => assert.ok(Math.abs(pi - 1 / 3) < 1e-9));
    assert.ok(Math.abs(p.reduce((a, c) => a + c, 0) - 1) < 1e-12);
});

test('prices: siempre suma 1 sobre muchos estados de q aleatorios (invariante)', () => {
    for (let i = 0; i < 200; i++) {
        const n = 2 + Math.floor(Math.random() * 8);
        const b = 5 + Math.random() * 100;
        const q = Array.from({ length: n }, () => (Math.random() - 0.5) * 200);
        const sum = prices(q, b).reduce((a, c) => a + c, 0);
        assert.ok(Math.abs(sum - 1) < 1e-9, `suma=${sum}`);
    }
});

test('costForShares: comprar 10 acciones desde q=[0,0,0], b=10 -> número exacto verificado a mano', () => {
    const cost = costForShares([0, 0, 0], 10, 0, 10);
    assert.ok(Math.abs(cost - 4.5283242526394165) < 1e-9);
});

test('costForShares: vender es exactamente lo inverso de comprar (misma trayectoria)', () => {
    const q0 = [0, 0, 0];
    const b = 10;
    const buyCost = costForShares(q0, b, 0, 10);
    const q1 = [10, 0, 0];
    const sellProceeds = costForShares(q1, b, 0, -10);
    assert.ok(Math.abs(buyCost + sellProceeds) < 1e-9);
});

test('costForShares: comprar más de un resultado sube su precio y baja el de los demás', () => {
    const b = 10;
    const before = prices([0, 0, 0], b);
    const after = prices([10, 0, 0], b);
    assert.ok(after[0] > before[0]);
    assert.ok(after[1] < before[1]);
    assert.ok(after[2] < before[2]);
});

test('sharesForBudget: inversión cerrada round-tripea exacto contra costForShares (compra)', () => {
    const q = [0, 0, 0];
    const b = 10;
    const cost = costForShares(q, b, 0, 10);
    const shares = sharesForBudget(q, b, 0, cost);
    assert.ok(Math.abs(shares - 10) < 1e-6);
});

test('sharesForBudget: round-tripea exacto también partiendo de un q no-cero', () => {
    const q = [15, 5, -3];
    const b = 25;
    const cost = costForShares(q, b, 1, 7);
    const shares = sharesForBudget(q, b, 1, cost);
    assert.ok(Math.abs(shares - 7) < 1e-6);
});

test('sharesForBudget: round-tripea exacto para un presupuesto negativo (venta)', () => {
    const q = [10, 0, 0];
    const b = 10;
    const proceeds = costForShares(q, b, 0, -4); // negativo, lo que recibiría al vender 4
    const shares = sharesForBudget(q, b, 0, proceeds);
    assert.ok(Math.abs(shares - (-4)) < 1e-6);
});

test('sharesForBudget: presupuesto insuficiente (no alcanza ni una fracción positiva) -> -Infinity', () => {
    // Un presupuesto extremadamente negativo pide vender más de lo que la fórmula puede resolver.
    const shares = sharesForBudget([0, 0, 0], 10, 0, -1e9);
    assert.equal(shares, -Infinity);
});

test('maxLoss: b*ln(n), números exactos a mano', () => {
    assert.ok(Math.abs(maxLoss(10, 3) - 10 * Math.log(3)) < 1e-9);
    assert.ok(Math.abs(maxLoss(30, 2) - 30 * Math.log(2)) < 1e-9);
});

test('maxLoss: crece con b y con la cantidad de resultados', () => {
    assert.ok(maxLoss(50, 3) > maxLoss(10, 3));
    assert.ok(maxLoss(10, 5) > maxLoss(10, 2));
});

test('redondeo a favor de la casa: floor sobre el delta de saldo nunca genera puntos de la nada', () => {
    // Comprar: el usuario paga Math.floor(cost) puntos como mínimo entero >= cost real
    // en magnitud -> se implementa como floor(-cost) puntos a descontar, nunca menos de
    // lo que realmente cuesta. Vender: floor(proceeds), nunca más de lo que realmente
    // vale. Se verifica la dirección del redondeo, no un valor específico de la ruta
    // (esa combinación vive en beaumarket.pb.js, acá solo se verifica que costForShares
    // no devuelve un entero limpio -> hace falta redondear).
    const cost = costForShares([0, 0, 0], 10, 0, 10);
    assert.notEqual(cost, Math.floor(cost));
});

test('computeLmsrPriceHistory: sin trades -> MIN_CHART_POINTS puntos, precio uniforme constante', () => {
    const points = computeLmsrPriceHistory([], 2, 30, 1000, 5000, 60);
    assert.equal(points.length, MIN_CHART_POINTS);
    points.forEach((p) => {
        assert.ok(Math.abs(p.percentages[0] - 50) < 1e-9);
        assert.ok(Math.abs(p.percentages[1] - 50) < 1e-9);
    });
    assert.equal(points[0].t, 1000);
    assert.equal(points[points.length - 1].t, 5000);
});

test('computeLmsrPriceHistory: la cantidad de puntos no supera trades.length + 1 aunque el techo sea mayor', () => {
    const trades = [
        { outcomeIndex: 0, sharesDelta: 5, createdAtMs: 2000 },
        { outcomeIndex: 1, sharesDelta: 3, createdAtMs: 3000 },
    ];
    const points = computeLmsrPriceHistory(trades, 2, 30, 1000, 5000, 60);
    assert.equal(points.length, 3); // trades.length + 1, no 60
});

test('computeLmsrPriceHistory: la cantidad de puntos queda topada en maxPoints con muchos trades', () => {
    const trades = [];
    for (let i = 0; i < 500; i++) {
        trades.push({ outcomeIndex: i % 2, sharesDelta: 1, createdAtMs: 1000 + i });
    }
    const points = computeLmsrPriceHistory(trades, 2, 30, 1000, 2000, 60);
    assert.equal(points.length, 60);
});

test('computeLmsrPriceHistory: cada punto refleja el q acumulado hasta ese instante (last-observation-carried-forward)', () => {
    const b = 10;
    const trades = [
        { outcomeIndex: 0, sharesDelta: 10, createdAtMs: 100 },
        { outcomeIndex: 1, sharesDelta: 10, createdAtMs: 900 },
    ];
    const points = computeLmsrPriceHistory(trades, 2, b, 0, 1000, 60);
    assert.equal(points.length, 3); // trades.length + 1: t=0, t=500, t=1000
    assert.equal(points[0].t, 0);
    assert.deepEqual(points[0].percentages, [50, 50]); // antes de cualquier trade
    assert.equal(points[1].t, 500);
    const expectedAfterFirst = prices([10, 0], b).map((p) => p * 100);
    assert.ok(Math.abs(points[1].percentages[0] - expectedAfterFirst[0]) < 1e-9);
    assert.equal(points[2].t, 1000);
    const expectedAfterBoth = prices([10, 10], b).map((p) => p * 100);
    assert.ok(Math.abs(points[2].percentages[0] - expectedAfterBoth[0]) < 1e-9);
    assert.ok(Math.abs(points[2].percentages[0] - 50) < 1e-9); // simétrico -> vuelve a 50/50
});

test('computeLmsrPriceHistory: cada punto suma ~100% entre resultados', () => {
    const trades = [
        { outcomeIndex: 0, sharesDelta: 6, createdAtMs: 1100 },
        { outcomeIndex: 1, sharesDelta: 9, createdAtMs: 1200 },
        { outcomeIndex: 2, sharesDelta: 3, createdAtMs: 1300 },
    ];
    const points = computeLmsrPriceHistory(trades, 3, 20, 1000, 2000, 60);
    points.forEach((p) => {
        const sum = p.percentages.reduce((s, x) => s + x, 0);
        assert.ok(Math.abs(sum - 100) < 1e-6, `suma de porcentajes = ${sum}`);
    });
});

test('computeLmsrPriceHistory: ignora de forma defensiva un outcomeIndex fuera de rango', () => {
    const trades = [
        { outcomeIndex: 0, sharesDelta: 10, createdAtMs: 1100 },
        { outcomeIndex: 5, sharesDelta: 999, createdAtMs: 1200 }, // fuera de rango, se ignora
    ];
    const points = computeLmsrPriceHistory(trades, 2, 10, 1000, 2000, 60);
    const last = points[points.length - 1];
    const expected = prices([10, 0], 10).map((p) => p * 100);
    assert.ok(Math.abs(last.percentages[0] - expected[0]) < 1e-9);
});

test('computeLmsrPriceHistory: rango de tiempo degenerado (start === end) no revienta', () => {
    const points = computeLmsrPriceHistory([], 2, 10, 5000, 5000, 60);
    assert.equal(points.length, MIN_CHART_POINTS);
    points.forEach((p) => assert.equal(p.t, 5000));
});

test('computeLmsrPriceHistory: acepta ventas (sharesDelta negativo) sin romper el invariante de suma 100', () => {
    const trades = [
        { outcomeIndex: 0, sharesDelta: 20, createdAtMs: 1100 },
        { outcomeIndex: 0, sharesDelta: -8, createdAtMs: 1300 },
    ];
    const points = computeLmsrPriceHistory(trades, 2, 15, 1000, 2000, 60);
    const last = points[points.length - 1];
    const sum = last.percentages.reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(sum - 100) < 1e-6);
    const expected = prices([12, 0], 15).map((p) => p * 100);
    assert.ok(Math.abs(last.percentages[0] - expected[0]) < 1e-9);
});

test('computeCostBasis: solo compras -> costBasis es la suma de lo pagado', () => {
    const trades = [
        { outcomeIndex: 0, sharesDelta: 20, cost: 15, createdAtMs: 100 },
        { outcomeIndex: 0, sharesDelta: 28, cost: 15, createdAtMs: 200 },
    ];
    assert.deepEqual(computeCostBasis(trades), { 0: 30 });
});

test('computeCostBasis: vender libera costo proporcional a la fracción de acciones vendidas, NO el neto de caja', () => {
    // Compra 20 acciones por 15 (costo promedio 0.75/acción). Vende 10 (la mitad de las
    // acciones) recibiendo solo 2 de vuelta porque el precio se desplomó. El neto de
    // caja ingenuo daría costBasis = 15 - 2 = 13 sobre solo 10 acciones restantes (13 >
    // 10, imposible según la garantía LMSR). El método correcto libera la mitad
    // PROPORCIONAL del costo (7.5), dejando costBasis = 7.5 <= 10 acciones restantes.
    const trades = [
        { outcomeIndex: 0, sharesDelta: 20, cost: 15, createdAtMs: 100 },
        { outcomeIndex: 0, sharesDelta: -10, cost: -2, createdAtMs: 200 },
    ];
    const result = computeCostBasis(trades);
    assert.ok(Math.abs(result[0] - 7.5) < 1e-9);
});

test('computeCostBasis: invariante costBasis <= shares se cumple SIEMPRE incluso vendiendo en pérdida, sobre casos aleatorios', () => {
    for (let i = 0; i < 200; i++) {
        let shares = 0;
        const trades = [];
        let t = 0;
        const steps = 1 + Math.floor(Math.random() * 8);
        for (let s = 0; s < steps; s++) {
            t += 100;
            if (shares === 0 || Math.random() < 0.6) {
                // compra: costo por acción siempre < 1 (garantía LMSR)
                const bought = 1 + Math.floor(Math.random() * 20);
                const costPerShare = Math.random(); // en [0, 1)
                trades.push({ outcomeIndex: 0, sharesDelta: bought, cost: bought * costPerShare, createdAtMs: t });
                shares += bought;
            } else {
                // venta: cantidad al azar hasta lo que se tiene, a cualquier precio (incluso 0)
                const sold = 1 + Math.floor(Math.random() * shares);
                const proceedsPerShare = Math.random();
                trades.push({ outcomeIndex: 0, sharesDelta: -sold, cost: -(sold * proceedsPerShare), createdAtMs: t });
                shares -= sold;
            }
        }
        const costBasis = computeCostBasis(trades)[0] || 0;
        assert.ok(costBasis <= shares + 1e-9, `costBasis=${costBasis} shares=${shares}`);
    }
});

test('computeCostBasis: vender todo deja costBasis en 0', () => {
    const trades = [
        { outcomeIndex: 0, sharesDelta: 20, cost: 15, createdAtMs: 100 },
        { outcomeIndex: 0, sharesDelta: -20, cost: -18, createdAtMs: 200 },
    ];
    assert.equal(computeCostBasis(trades)[0], 0);
});

test('computeCostBasis: separa correctamente por outcomeIndex', () => {
    const trades = [
        { outcomeIndex: 0, sharesDelta: 10, cost: 5, createdAtMs: 100 },
        { outcomeIndex: 1, sharesDelta: 20, cost: 12, createdAtMs: 150 },
        { outcomeIndex: 0, sharesDelta: -5, cost: -3, createdAtMs: 200 },
    ];
    const result = computeCostBasis(trades);
    assert.ok(Math.abs(result[0] - 2.5) < 1e-9);
    assert.equal(result[1], 12);
});

test('computeCostBasis: no depende del orden de entrada (ordena internamente por createdAtMs)', () => {
    const chronological = [
        { outcomeIndex: 0, sharesDelta: 20, cost: 15, createdAtMs: 100 },
        { outcomeIndex: 0, sharesDelta: -10, cost: -2, createdAtMs: 200 },
    ];
    const shuffled = [chronological[1], chronological[0]];
    assert.deepEqual(computeCostBasis(chronological), computeCostBasis(shuffled));
});
