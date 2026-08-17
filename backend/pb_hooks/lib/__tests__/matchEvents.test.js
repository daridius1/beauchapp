const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isValidEvent, summarizeEvents } = require("../matchEvents.js");

test("isValidEvent: acepta cada tipo bien formado", () => {
    assert.equal(isValidEvent({ type: "lineup", team: "A", players: ["Pedro"] }), true);
    assert.equal(isValidEvent({ type: "half_start", half: 1 }), true);
    assert.equal(isValidEvent({ type: "half_end", half: 2 }), true);
    assert.equal(isValidEvent({ type: "goal", team: "A", player: "Pedro", ownGoal: false }), true);
    assert.equal(isValidEvent({ type: "yellow_card", team: "B", player: "Juan" }), true);
    assert.equal(isValidEvent({ type: "red_card", team: "B", player: "Juan" }), true);
    assert.equal(isValidEvent({ type: "penalty", team: "A", player: "Ana", scored: true }), true);
});

test("isValidEvent: rechaza tipos desconocidos o campos faltantes/mal tipados", () => {
    assert.equal(isValidEvent(null), false);
    assert.equal(isValidEvent({ type: "foo" }), false);
    assert.equal(isValidEvent({ type: "goal", team: "A", player: "Pedro" }), false); // falta ownGoal
    assert.equal(isValidEvent({ type: "goal", team: "C", player: "Pedro", ownGoal: false }), false); // team inválido
    assert.equal(isValidEvent({ type: "half_start", half: 3 }), false);
    assert.equal(isValidEvent({ type: "penalty", team: "A", player: "Ana" }), false); // falta scored
});

test("summarizeEvents: arreglo vacío devuelve estado en cero", () => {
    const s = summarizeEvents([]);
    assert.equal(s.scoreA, 0);
    assert.equal(s.scoreB, 0);
    assert.deepEqual(s.cardsA, { yellow: 0, red: 0 });
    assert.deepEqual(s.lineupA, []);
    assert.equal(s.currentHalf, 0);
});

test("summarizeEvents: gol normal suma para el equipo que lo metió", () => {
    const s = summarizeEvents([{ type: "goal", team: "A", player: "Pedro", ownGoal: false }]);
    assert.equal(s.scoreA, 1);
    assert.equal(s.scoreB, 0);
});

test("summarizeEvents: autogol suma para el equipo CONTRARIO al jugador", () => {
    // Un jugador del equipo A mete en su propio arco -> el punto es para B.
    const s = summarizeEvents([{ type: "goal", team: "A", player: "Pedro", ownGoal: true }]);
    assert.equal(s.scoreA, 0);
    assert.equal(s.scoreB, 1);
    assert.equal(s.goals[0].scoringTeam, "B");
});

test("summarizeEvents: penal solo suma si scored=true, y no genera un gol duplicado", () => {
    const scored = summarizeEvents([{ type: "penalty", team: "B", player: "Ana", scored: true }]);
    assert.equal(scored.scoreB, 1);
    assert.equal(scored.goals.length, 0); // el penal no crea un evento "goal" aparte

    const missed = summarizeEvents([{ type: "penalty", team: "B", player: "Ana", scored: false }]);
    assert.equal(missed.scoreB, 0);
});

test("summarizeEvents: tarjetas se cuentan por equipo y tipo", () => {
    const s = summarizeEvents([
        { type: "yellow_card", team: "A", player: "Pedro" },
        { type: "yellow_card", team: "A", player: "Luis" },
        { type: "red_card", team: "B", player: "Ana" },
    ]);
    assert.equal(s.cardsA.yellow, 2);
    assert.equal(s.cardsA.red, 0);
    assert.equal(s.cardsB.red, 1);
});

test("summarizeEvents: la convocatoria es la ÚLTIMA entrada 'lineup' de cada equipo, no una acumulación", () => {
    const s = summarizeEvents([
        { type: "lineup", team: "A", players: ["Pedro", "Luis"] },
        { type: "lineup", team: "A", players: ["Pedro", "Luis", "Ana"] }, // corrección/ampliación posterior
    ]);
    assert.deepEqual(s.lineupA, ["Pedro", "Luis", "Ana"]);
});

test("summarizeEvents: half_start/half_end quedan reflejados y currentHalf es el último tiempo iniciado", () => {
    const s = summarizeEvents([
        { type: "half_start", half: 1 },
        { type: "half_end", half: 1 },
        { type: "half_start", half: 2 },
    ]);
    assert.equal(s.halfStarted[1], true);
    assert.equal(s.halfEnded[1], true);
    assert.equal(s.halfStarted[2], true);
    assert.equal(s.halfEnded[2], false);
    assert.equal(s.currentHalf, 2);
});

test("summarizeEvents: eventos inválidos dentro del arreglo se ignoran en vez de romper el resumen", () => {
    const s = summarizeEvents([
        { type: "goal", team: "A", player: "Pedro", ownGoal: false },
        { type: "not_a_real_type" },
        { type: "goal", team: "B", player: "Ana", ownGoal: false },
    ]);
    assert.equal(s.scoreA, 1);
    assert.equal(s.scoreB, 1);
});

test("summarizeEvents: 'deshacer' es simplemente re-resumir con el último elemento sacado", () => {
    const events = [
        { type: "goal", team: "A", player: "Pedro", ownGoal: false },
        { type: "yellow_card", team: "B", player: "Ana" },
    ];
    const before = summarizeEvents(events);
    assert.equal(before.scoreA, 1);
    assert.equal(before.cardsB.yellow, 1);

    const undone = summarizeEvents(events.slice(0, -1));
    assert.equal(undone.scoreA, 1);
    assert.equal(undone.cardsB.yellow, 0);
});

// Partido de prueba con de todo: goles normales, autogol, penal convertido, penal
// errado, amarillas y una roja — el mismo escenario que se usa para el partido de
// prueba real creado en la liga.
test("summarizeEvents: escenario completo de partido calculado a mano", () => {
    const events = [
        { type: "lineup", team: "A", players: ["Diego", "Fabián", "Cote"] },
        { type: "lineup", team: "B", players: ["Marco", "Tomás", "Seba"] },
        { type: "half_start", half: 1 },
        { type: "goal", team: "A", player: "Diego", ownGoal: false }, // A 1-0
        { type: "yellow_card", team: "B", player: "Marco" },
        { type: "goal", team: "B", player: "Tomás", ownGoal: false }, // A 1-1
        { type: "goal", team: "A", player: "Fabián", ownGoal: true }, // autogol de A -> A 1-2
        { type: "half_end", half: 1 },
        { type: "half_start", half: 2 },
        { type: "penalty", team: "A", player: "Cote", scored: true }, // A 2-2
        { type: "yellow_card", team: "B", player: "Seba" },
        { type: "yellow_card", team: "B", player: "Seba" }, // segunda amarilla, se registra igual
        { type: "red_card", team: "B", player: "Seba" },
        { type: "penalty", team: "B", player: "Marco", scored: false }, // no suma
        { type: "half_end", half: 2 },
    ];
    const s = summarizeEvents(events);
    assert.equal(s.scoreA, 2);
    assert.equal(s.scoreB, 2);
    assert.equal(s.cardsA.yellow, 0);
    assert.equal(s.cardsB.yellow, 3); // Marco + las dos de Seba (no hay conversión automática a roja)
    assert.equal(s.cardsB.red, 1);
    assert.equal(s.goals.length, 3); // Diego, Tomás y el autogol de Fabián (los penales no cuentan acá)
    assert.equal(s.penalties.length, 2);
    assert.deepEqual(s.lineupA, ["Diego", "Fabián", "Cote"]);
    assert.equal(s.halfEnded[2], true);
});
