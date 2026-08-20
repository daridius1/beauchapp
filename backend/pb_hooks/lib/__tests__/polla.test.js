const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    isValidPick,
    outcomeOf,
    pickPoints,
    bettingCloseTimeFromBlock,
    isBettingClosed,
    computePollaLeaderboard,
    CLOSE_MINUTES_BEFORE,
} = require("../polla.js");

// --- Puntaje -----------------------------------------------------------------

test("isValidPick: solo local, empate y visita", () => {
    assert.equal(isValidPick("home"), true);
    assert.equal(isValidPick("draw"), true);
    assert.equal(isValidPick("away"), true);
    assert.equal(isValidPick("winner"), false);
    assert.equal(isValidPick(""), false);
    assert.equal(isValidPick(undefined), false);
});

test("outcomeOf: traduce el marcador al vocabulario de la apuesta", () => {
    assert.equal(outcomeOf(2, 1), "home");
    assert.equal(outcomeOf(1, 2), "away");
    assert.equal(outcomeOf(0, 0), "draw");
    assert.equal(outcomeOf(3, 3), "draw");
});

test("pickPoints: acertar el ganador vale 1", () => {
    assert.equal(pickPoints("home", 2, 1), 1);
    assert.equal(pickPoints("away", 0, 1), 1);
});

test("pickPoints: acertar el empate vale 2", () => {
    assert.equal(pickPoints("draw", 0, 0), 2);
    assert.equal(pickPoints("draw", 2, 2), 2);
});

test("pickPoints: errar no vale nada", () => {
    assert.equal(pickPoints("home", 0, 1), 0);
    assert.equal(pickPoints("draw", 1, 0), 0);
    assert.equal(pickPoints("away", 1, 1), 0);
});

test("pickPoints: una apuesta inválida no puntúa aunque el resultado coincida", () => {
    assert.equal(pickPoints("local", 2, 1), 0);
    assert.equal(pickPoints(null, 0, 0), 0);
});

test("pickPoints: un marcador ausente se lee como 0-0, o sea empate", () => {
    assert.equal(pickPoints("draw", undefined, undefined), 2);
    assert.equal(pickPoints("home", undefined, undefined), 0);
});

// --- Cierre ------------------------------------------------------------------

test("bettingCloseTimeFromBlock: cierra 10 minutos antes de la hora del bloque", () => {
    const iso = bettingCloseTimeFromBlock("2026-08-20-15");
    const cierre = new Date(iso);
    const inicio = new Date(2026, 7, 20, 15, 0, 0, 0);
    assert.equal(inicio.getTime() - cierre.getTime(), CLOSE_MINUTES_BEFORE * 60 * 1000);
});

test("bettingCloseTimeFromBlock: un blockCode ilegible no da fecha de cierre", () => {
    assert.equal(bettingCloseTimeFromBlock(""), null);
    assert.equal(bettingCloseTimeFromBlock("corto"), null);
    assert.equal(bettingCloseTimeFromBlock(null), null);
    assert.equal(bettingCloseTimeFromBlock("XXXX-XX-XX-XX"), null);
});

test("isBettingClosed: abierto antes de la hora, cerrado después", () => {
    const cierre = new Date(2026, 7, 20, 14, 50, 0, 0).toISOString();
    assert.equal(isBettingClosed(cierre, new Date(2026, 7, 20, 14, 49).getTime()), false);
    assert.equal(isBettingClosed(cierre, new Date(2026, 7, 20, 14, 51).getTime()), true);
});

test("isBettingClosed: justo en el instante de cierre ya está cerrado", () => {
    const cierre = new Date(2026, 7, 20, 14, 50, 0, 0);
    assert.equal(isBettingClosed(cierre.toISOString(), cierre.getTime()), true);
});

test("isBettingClosed: sin fecha se trata como CERRADO (lado seguro)", () => {
    // Un partido al que le falte el dato no debe dejar apostar ni espiar apuestas ajenas.
    assert.equal(isBettingClosed(null, Date.now()), true);
    assert.equal(isBettingClosed("", Date.now()), true);
    assert.equal(isBettingClosed("no-es-una-fecha", Date.now()), true);
});

// --- Tabla de posiciones -----------------------------------------------------

const partidos = [
    { id: "m1", status: "played", scoreA: 2, scoreB: 1 },   // gana local
    { id: "m2", status: "played", scoreA: 1, scoreB: 1 },   // empate
    { id: "m3", status: "confirmed", scoreA: 0, scoreB: 0 }, // todavía no jugado
];

test("computePollaLeaderboard: suma 1 por ganador y 2 por empate acertados", () => {
    const tabla = computePollaLeaderboard(partidos, [
        { user: "u1", match: "m1", pick: "home" },
        { user: "u1", match: "m2", pick: "draw" },
    ]);
    assert.equal(tabla.length, 1);
    assert.equal(tabla[0].points, 3);
    assert.equal(tabla[0].hits, 2);
});

test("computePollaLeaderboard: un partido no jugado no puntúa ni cuenta como resuelto", () => {
    const tabla = computePollaLeaderboard(partidos, [
        { user: "u1", match: "m3", pick: "draw" },
    ]);
    assert.equal(tabla[0].points, 0);
    assert.equal(tabla[0].bets, 1);
    assert.equal(tabla[0].resolved, 0);
});

test("computePollaLeaderboard: ordena por puntos, luego aciertos, luego alfabético", () => {
    const usersById = {
        u1: { name: "Ana" },
        u2: { name: "Beto" },
        u3: { name: "Carla" },
    };
    const tabla = computePollaLeaderboard(
        partidos,
        [
            { user: "u1", match: "m1", pick: "home" }, // 1 punto
            { user: "u2", match: "m2", pick: "draw" }, // 2 puntos
            { user: "u3", match: "m1", pick: "home" }, // 1 punto
        ],
        usersById
    );
    assert.deepEqual(tabla.map((r) => `${r.name}:${r.points}`), ["Beto:2", "Ana:1", "Carla:1"]);
});

test("computePollaLeaderboard: una apuesta a un partido inexistente no rompe ni puntúa", () => {
    const tabla = computePollaLeaderboard(partidos, [
        { user: "u1", match: "fantasma", pick: "home" },
    ]);
    assert.equal(tabla[0].points, 0);
    assert.equal(tabla[0].bets, 1);
    assert.equal(tabla[0].resolved, 0);
});

test("computePollaLeaderboard: copia los datos de la persona para mostrar", () => {
    const tabla = computePollaLeaderboard(
        partidos,
        [{ user: "u1", match: "m1", pick: "home" }],
        { u1: { name: "Ana", username: "ana", avatar: "a.jpg" } }
    );
    assert.equal(tabla[0].username, "ana");
    assert.equal(tabla[0].avatar, "a.jpg");
});

test("computePollaLeaderboard: tolera entradas vacías o mal formadas", () => {
    assert.deepEqual(computePollaLeaderboard(null, null), []);
    assert.deepEqual(computePollaLeaderboard([], []), []);
    assert.deepEqual(computePollaLeaderboard(partidos, [{ pick: "home" }]), []);
});

// --- Estado visual de los botones -------------------------------------------
//
// Los seis casos tienen que quedar distinguibles SOLO con color. El que motivó todo
// esto: "aposté y fallé" contra "no aposté", que se veían idénticos.

const { pickVisual, cardOutcome } = require("../polla.js");

test("pickVisual: partido abierto — solo se marca mi apuesta", () => {
    assert.equal(pickVisual("home", "home", null, false), "mine");
    assert.equal(pickVisual("draw", "home", null, false), "neutral");
    assert.equal(pickVisual("away", "home", null, false), "neutral");
});

test("pickVisual: partido abierto sin apostar — todo neutro", () => {
    assert.equal(pickVisual("home", undefined, null, false), "neutral");
    assert.equal(pickVisual("draw", undefined, null, false), "neutral");
});

test("pickVisual: cerrado sin resultado — mi apuesta se marca, el resto se apaga", () => {
    assert.equal(pickVisual("home", "home", null, true), "mine");
    assert.equal(pickVisual("draw", "home", null, true), "dim");
});

test("pickVisual: acerté — mi apuesta es a la vez el resultado", () => {
    assert.equal(pickVisual("home", "home", "home", true), "hit");
    assert.equal(pickVisual("draw", "home", "home", true), "dim");
});

test("pickVisual: fallé — mi apuesta en rojo Y el resultado en verde", () => {
    // Este par es la señal de "jugué y perdí": hay un botón `miss`.
    assert.equal(pickVisual("home", "home", "draw", true), "miss");
    assert.equal(pickVisual("draw", "home", "draw", true), "result");
    assert.equal(pickVisual("away", "home", "draw", true), "dim");
});

test("pickVisual: no aposté — el resultado se marca, pero NADA en rojo", () => {
    const visuals = ["home", "draw", "away"].map((p) => pickVisual(p, undefined, "draw", true));
    assert.deepEqual(visuals, ["dim", "result", "dim"]);
    assert.equal(visuals.includes("miss"), false, "sin apuesta no puede haber rojo");
    assert.equal(visuals.includes("hit"), false, "sin apuesta no puede haber verde lleno");
});

test("pickVisual: 'acerté' y 'no aposté' se distinguen — verde lleno vs solo borde", () => {
    assert.equal(pickVisual("draw", "draw", "draw", true), "hit");
    assert.equal(pickVisual("draw", undefined, "draw", true), "result");
});

test("pickVisual: 'fallé' y 'no aposté' se distinguen — solo el primero tiene rojo", () => {
    const falle = ["home", "draw", "away"].map((p) => pickVisual(p, "home", "draw", true));
    const noAposte = ["home", "draw", "away"].map((p) => pickVisual(p, undefined, "draw", true));
    assert.equal(falle.includes("miss"), true);
    assert.equal(noAposte.includes("miss"), false);
    assert.notDeepEqual(falle, noAposte);
});

test("cardOutcome: el borde de la tarjeta refuerza el mismo estado", () => {
    assert.equal(cardOutcome("home", "home"), "hit");
    assert.equal(cardOutcome("home", "draw"), "miss");
    assert.equal(cardOutcome(undefined, "draw"), "none");
    assert.equal(cardOutcome("home", null), "none");
});
