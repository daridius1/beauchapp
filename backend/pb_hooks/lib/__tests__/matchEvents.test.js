const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isValidEvent, isClockGatedSequenceValid, summarizeEvents } = require("../matchEvents.js");

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

test("isValidEvent: pause/resume no necesitan ningún campo extra", () => {
    assert.equal(isValidEvent({ type: "pause" }), true);
    assert.equal(isValidEvent({ type: "resume" }), true);
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
    assert.deepEqual(s.lineupA, [
        { playerId: null, name: "Pedro", photo: null },
        { playerId: null, name: "Luis", photo: null },
        { playerId: null, name: "Ana", photo: null },
    ]);
});

test("summarizeEvents: lineup con jugadores del roster (objeto {playerId,name,photo}) se normaliza igual que los strings sueltos", () => {
    const s = summarizeEvents([
        {
            type: "lineup",
            team: "A",
            players: [
                { playerId: "tp1", name: "Pedro", photo: "pedro.jpg" },
                { playerId: "tp2", name: "Luis" }, // sin foto, opcional
            ],
        },
    ]);
    assert.deepEqual(s.lineupA, [
        { playerId: "tp1", name: "Pedro", photo: "pedro.jpg" },
        { playerId: "tp2", name: "Luis", photo: null },
    ]);
});

test("summarizeEvents: un lineup puede mezclar strings viejos y objetos nuevos sin romperse", () => {
    const s = summarizeEvents([
        { type: "lineup", team: "B", players: ["Marco", { playerId: "tp9", name: "Tomás" }] },
    ]);
    assert.deepEqual(s.lineupB, [
        { playerId: null, name: "Marco", photo: null },
        { playerId: "tp9", name: "Tomás", photo: null },
    ]);
});

test("isValidEvent: lineup acepta players en formato objeto y rechaza objetos sin 'name'", () => {
    assert.equal(
        isValidEvent({ type: "lineup", team: "A", players: [{ playerId: "tp1", name: "Pedro" }] }),
        true
    );
    assert.equal(isValidEvent({ type: "lineup", team: "A", players: [{ playerId: "tp1" }] }), false);
    assert.equal(isValidEvent({ type: "lineup", team: "A", players: [""] }), false);
});

test("isValidEvent: goal/yellow_card/red_card/penalty aceptan playerId opcional y lo rechazan si viene mal tipado", () => {
    assert.equal(
        isValidEvent({ type: "goal", team: "A", player: "Pedro", playerId: "tp1", ownGoal: false }),
        true
    );
    assert.equal(
        isValidEvent({ type: "yellow_card", team: "B", player: "Juan", playerId: "tp2" }),
        true
    );
    assert.equal(
        isValidEvent({ type: "penalty", team: "A", player: "Ana", playerId: "tp3", scored: true }),
        true
    );
    // Sin playerId sigue siendo válido (partidos viejos, o jugadores sin id).
    assert.equal(isValidEvent({ type: "goal", team: "A", player: "Pedro", ownGoal: false }), true);
    // playerId vacío o mal tipado -> inválido.
    assert.equal(
        isValidEvent({ type: "goal", team: "A", player: "Pedro", playerId: "", ownGoal: false }),
        false
    );
    assert.equal(
        isValidEvent({ type: "goal", team: "A", player: "Pedro", playerId: 123, ownGoal: false }),
        false
    );
});

test("isValidEvent: goal/yellow_card/red_card/penalty pueden quedar sin jugador asignado (en blanco)", () => {
    assert.equal(isValidEvent({ type: "goal", team: "A", ownGoal: false }), true);
    assert.equal(isValidEvent({ type: "yellow_card", team: "B" }), true);
    assert.equal(isValidEvent({ type: "red_card", team: "B" }), true);
    assert.equal(isValidEvent({ type: "penalty", team: "A", scored: true }), true);
    // `player` mal tipado (no string, no undefined) sigue siendo inválido.
    assert.equal(isValidEvent({ type: "goal", team: "A", player: 123, ownGoal: false }), false);
});

test("summarizeEvents: un gol/tarjeta/penal sin jugador asignado se sigue contando para el marcador/tarjetas", () => {
    const s = summarizeEvents([
        { type: "goal", team: "A", ownGoal: false },
        { type: "yellow_card", team: "B" },
    ]);
    assert.equal(s.scoreA, 1);
    assert.equal(s.cardsB.yellow, 1);
    assert.equal(s.goals[0].player, undefined);
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

test("summarizeEvents: clockRunning refleja pause/resume además de half_start/half_end", () => {
    assert.equal(summarizeEvents([]).clockRunning, false);
    assert.equal(summarizeEvents([{ type: "half_start", half: 1 }]).clockRunning, true);
    assert.equal(summarizeEvents([{ type: "half_start", half: 1 }, { type: "pause" }]).clockRunning, false);
    assert.equal(
        summarizeEvents([{ type: "half_start", half: 1 }, { type: "pause" }, { type: "resume" }]).clockRunning,
        true
    );
    assert.equal(
        summarizeEvents([{ type: "half_start", half: 1 }, { type: "half_end", half: 1 }]).clockRunning,
        false
    );
});

test("isClockGatedSequenceValid: goles/tarjetas/penales solo son válidos con el reloj corriendo", () => {
    assert.equal(
        isClockGatedSequenceValid([
            { type: "half_start", half: 1 },
            { type: "goal", team: "A", player: "Pedro", ownGoal: false },
        ]),
        true
    );
    // Sin ningún half_start antes -> reloj parado -> inválido.
    assert.equal(
        isClockGatedSequenceValid([{ type: "goal", team: "A", player: "Pedro", ownGoal: false }]),
        false
    );
    // Gol durante una pausa -> inválido.
    assert.equal(
        isClockGatedSequenceValid([
            { type: "half_start", half: 1 },
            { type: "pause" },
            { type: "goal", team: "A", player: "Pedro", ownGoal: false },
        ]),
        false
    );
    // Gol en el entretiempo (después de half_end, antes de half_start del 2do) -> inválido.
    assert.equal(
        isClockGatedSequenceValid([
            { type: "half_start", half: 1 },
            { type: "half_end", half: 1 },
            { type: "goal", team: "A", player: "Pedro", ownGoal: false },
        ]),
        false
    );
    // Convocatoria no está sujeta al reloj -> siempre válida.
    assert.equal(
        isClockGatedSequenceValid([{ type: "lineup", team: "A", players: ["Pedro"] }]),
        true
    );
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
    assert.deepEqual(s.lineupA, [
        { playerId: null, name: "Diego", photo: null },
        { playerId: null, name: "Fabián", photo: null },
        { playerId: null, name: "Cote", photo: null },
    ]);
    assert.equal(s.halfEnded[2], true);
});
