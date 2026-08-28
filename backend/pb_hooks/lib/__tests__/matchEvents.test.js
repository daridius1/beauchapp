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

// ---------------------------------------------------------------------------------
// mergeEvents — fusión de bitácoras concurrentes. Escenario de fondo: dos personas
// arbitran el mismo partido con el mismo código, sincronizando cada ~10 s, así que
// cada una manda su bitácora completa partiendo de una base que ya quedó vieja.
// Ver auditoria-2026-08-19.md §4.1.
// ---------------------------------------------------------------------------------

const { eventKey, mergeEvents } = require("../matchEvents.js");

const golA = { id: "e1", type: "goal", team: "A", ownGoal: false, at: "2026-08-19T20:30:00.000Z" };
const tarjetaB = { id: "e2", type: "yellow_card", team: "B", at: "2026-08-19T20:31:00.000Z" };
const golB = { id: "e3", type: "goal", team: "B", ownGoal: false, at: "2026-08-19T20:32:00.000Z" };

test("eventKey: usa el id cuando existe y deriva uno estable del contenido cuando no", () => {
    assert.equal(eventKey(golA), "e1");
    const legacy = { type: "goal", team: "A", ownGoal: false, at: "2026-08-19T20:30:00.000Z" };
    assert.equal(eventKey(legacy), "legacy:goal@2026-08-19T20:30:00.000Z");
    // Mismo evento legado leído dos veces produce la misma clave — es lo que evita
    // que una bitácora vieja se duplique en cada fusión.
    assert.equal(eventKey(legacy), eventKey({ ...legacy }));
});

test("mergeEvents: el evento que subió otro árbitro NO se pierde (el bug original)", () => {
    // B partió de una base vacía y no vio el gol que A ya había subido.
    const stored = [golA];
    const incomingDeB = [tarjetaB];
    const merged = mergeEvents(stored, incomingDeB, []);
    assert.deepEqual(merged.map((ev) => ev.id), ["e1", "e2"]);
});

test("mergeEvents: sin fusión el push de B habría dejado la bitácora en solo su evento", () => {
    // Documenta explícitamente qué hacía el código anterior, para que no vuelva.
    const comportamientoViejo = [tarjetaB];
    const merged = mergeEvents([golA], [tarjetaB], []);
    assert.notDeepEqual(merged, comportamientoViejo);
    assert.equal(merged.length, 2);
});

test("mergeEvents: ordena cronológicamente por `at` aunque lleguen intercalados", () => {
    const merged = mergeEvents([golB], [golA, tarjetaB], []);
    assert.deepEqual(merged.map((ev) => ev.id), ["e1", "e2", "e3"]);
});

test("mergeEvents: un borrado deliberado sí se propaga", () => {
    // El cliente tenía e1 y e2 en su base, y manda solo e1 => borró e2 a propósito.
    const merged = mergeEvents([golA, tarjetaB], [golA], ["e1", "e2"]);
    assert.deepEqual(merged.map((ev) => ev.id), ["e1"]);
});

test("mergeEvents: no confunde 'no lo conozco' con 'lo borré'", () => {
    // e3 lo subió otra persona DESPUÉS de que este cliente tomara su base [e1,e2].
    // No está en incoming, pero tampoco en baseKeys, así que debe sobrevivir.
    const merged = mergeEvents([golA, tarjetaB, golB], [golA, tarjetaB], ["e1", "e2"]);
    assert.deepEqual(merged.map((ev) => ev.id), ["e1", "e2", "e3"]);
});

test("mergeEvents: sin baseKeys la fusión es unión pura (cliente viejo, nunca pierde datos)", () => {
    const merged = mergeEvents([golA, tarjetaB], [golA], null);
    assert.deepEqual(merged.map((ev) => ev.id), ["e1", "e2"]);
});

test("mergeEvents: una edición del cliente sobre un evento existente gana", () => {
    const editado = { ...golA, player: "Diego" };
    const merged = mergeEvents([golA], [editado], ["e1"]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].player, "Diego");
});

test("mergeEvents: no duplica eventos legados sin id al re-sincronizar", () => {
    const legacy = { type: "goal", team: "A", ownGoal: false, at: "2026-08-19T20:30:00.000Z" };
    const merged = mergeEvents([legacy], [{ ...legacy }], null);
    assert.equal(merged.length, 1);
});

test("mergeEvents: fusiona bitácoras legadas y nuevas sin perder ninguna", () => {
    const legacy = { type: "half_start", half: 1, at: "2026-08-19T20:00:00.000Z" };
    const merged = mergeEvents([legacy], [golA], []);
    assert.deepEqual(merged.map((ev) => ev.type), ["half_start", "goal"]);
});

test("mergeEvents: tolera entradas no-arreglo sin reventar", () => {
    assert.deepEqual(mergeEvents(null, null, null), []);
    assert.deepEqual(mergeEvents(undefined, [golA], undefined).map((ev) => ev.id), ["e1"]);
});

test("mergeEvents: el marcador resultante cuenta los goles de ambos árbitros", () => {
    const merged = mergeEvents([golA], [golB], []);
    const s = summarizeEvents(merged);
    assert.equal(s.scoreA, 1);
    assert.equal(s.scoreB, 1);
});

// ---------------------------------------------------------------------------------
// matchWriteDecision — quién puede escribir sobre el informe de un partido.
// Ver auditoria-2026-08-19.md §4.4.
// ---------------------------------------------------------------------------------

const { matchWriteDecision } = require("../matchEvents.js");

const LIGA = "liga_1";
const OTRO = "usuario_2";
const CODE = "ABC123";

test("matchWriteDecision: en juego, el código correcto autoriza a cualquiera", () => {
    const d = matchWriteDecision("confirmed", LIGA, CODE, OTRO, CODE);
    assert.equal(d.ok, true);
    assert.equal(d.isAmend, false);
});

test("matchWriteDecision: en juego, el código incorrecto no autoriza", () => {
    const d = matchWriteDecision("confirmed", LIGA, CODE, OTRO, "ZZZZZZ");
    assert.equal(d.ok, false);
    assert.match(d.error, /Código incorrecto/);
});

test("matchWriteDecision: partido finalizado — el código ya no sirve", () => {
    // Este es el punto del arreglo: antes esto devolvía autorización y permitía
    // reescribir el marcador oficial de un partido cerrado semanas atrás.
    const d = matchWriteDecision("played", LIGA, CODE, OTRO, CODE);
    assert.equal(d.ok, false);
    assert.match(d.error, /Solo la liga organizadora/);
});

test("matchWriteDecision: partido finalizado — la liga dueña sí puede enmendar", () => {
    const d = matchWriteDecision("played", LIGA, CODE, LIGA, CODE);
    assert.equal(d.ok, true);
    assert.equal(d.isAmend, true);
});

test("matchWriteDecision: la liga dueña puede enmendar aunque no mande el código", () => {
    const d = matchWriteDecision("played", LIGA, CODE, LIGA, "");
    assert.equal(d.ok, true);
    assert.equal(d.isAmend, true);
});

test("matchWriteDecision: un partido suspendido o cancelado no lo escribe nadie", () => {
    for (const status of ["suspended", "cancelled", "proposed", ""]) {
        const d = matchWriteDecision(status, LIGA, CODE, LIGA, CODE);
        assert.equal(d.ok, false, `status ${status} no debería autorizar`);
        assert.match(d.error, /ya no se puede arbitrar/);
        assert.equal(d.reason, "not_arbitrable");
    }
});

test("matchWriteDecision: partido finalizado sin autorización — reason 'amend_forbidden'", () => {
    // El caso "huérfano": un árbitro que reconecta después de que el partido se
    // cerró por otra vía. El cliente usa este reason (no el texto del error) para
    // saber que reintentar solo nunca va a funcionar.
    const d = matchWriteDecision("played", LIGA, CODE, OTRO, CODE);
    assert.equal(d.reason, "amend_forbidden");
});

test("matchWriteDecision: código incorrecto — reason 'bad_code'", () => {
    const d = matchWriteDecision("confirmed", LIGA, CODE, OTRO, "ZZZZZZ");
    assert.equal(d.reason, "bad_code");
});

test("matchWriteDecision: autorizado — reason es null", () => {
    const d1 = matchWriteDecision("confirmed", LIGA, CODE, OTRO, CODE);
    assert.equal(d1.reason, null);
    const d2 = matchWriteDecision("played", LIGA, CODE, LIGA, CODE);
    assert.equal(d2.reason, null);
});

// ---------------------------------------------------------------------------------
// computeTopScorers — tabla de goleadores del campeonato.
// ---------------------------------------------------------------------------------

const { computeTopScorers } = require("../matchEvents.js");

const partido = (teamAId, teamBId, events) => ({ teamAId, teamBId, events });

test("computeTopScorers: suma goles del mismo jugador entre partidos distintos", () => {
    const tabla = computeTopScorers([
        partido("rojo", "azul", [
            { type: "goal", team: "A", player: "Diego", playerId: "p1", ownGoal: false, at: "1" },
            { type: "goal", team: "A", player: "Diego", playerId: "p1", ownGoal: false, at: "2" },
        ]),
        partido("rojo", "verde", [
            { type: "goal", team: "A", player: "Diego", playerId: "p1", ownGoal: false, at: "3" },
        ]),
    ]);
    assert.equal(tabla.length, 1);
    assert.equal(tabla[0].goals, 3);
    assert.equal(tabla[0].teamId, "rojo");
});

test("computeTopScorers: un penal convertido cuenta, uno errado no", () => {
    const tabla = computeTopScorers([
        partido("rojo", "azul", [
            { type: "penalty", team: "A", player: "Ana", playerId: "p2", scored: true, at: "1" },
            { type: "penalty", team: "A", player: "Ana", playerId: "p2", scored: false, at: "2" },
        ]),
    ]);
    assert.equal(tabla[0].goals, 1);
});

test("computeTopScorers: un autogol NO se le acredita a quien lo hizo", () => {
    const tabla = computeTopScorers([
        partido("rojo", "azul", [
            { type: "goal", team: "A", player: "Fabián", playerId: "p3", ownGoal: true, at: "1" },
        ]),
    ]);
    assert.deepEqual(tabla, []);
});

test("computeTopScorers: un gol sin jugador asignado no entra en la tabla", () => {
    const tabla = computeTopScorers([
        partido("rojo", "azul", [{ type: "goal", team: "A", ownGoal: false, at: "1" }]),
    ]);
    assert.deepEqual(tabla, []);
});

test("computeTopScorers: no fusiona homónimos de equipos distintos sin playerId", () => {
    const tabla = computeTopScorers([
        partido("rojo", "azul", [
            { type: "goal", team: "A", player: "Juan", ownGoal: false, at: "1" },
            { type: "goal", team: "B", player: "Juan", ownGoal: false, at: "2" },
        ]),
    ]);
    assert.equal(tabla.length, 2);
    assert.deepEqual(tabla.map((s) => s.teamId).sort(), ["azul", "rojo"]);
});

test("computeTopScorers: el mismo playerId sí se fusiona aunque cambie el nombre mostrado", () => {
    const tabla = computeTopScorers([
        partido("rojo", "azul", [
            { type: "goal", team: "A", player: "Diego", playerId: "p1", ownGoal: false, at: "1" },
            { type: "goal", team: "A", player: "Diego S.", playerId: "p1", ownGoal: false, at: "2" },
        ]),
    ]);
    assert.equal(tabla.length, 1);
    assert.equal(tabla[0].goals, 2);
});

test("computeTopScorers: ordena por goles y desempata alfabéticamente", () => {
    const tabla = computeTopScorers([
        partido("rojo", "azul", [
            { type: "goal", team: "A", player: "Zoe", playerId: "z", ownGoal: false, at: "1" },
            { type: "goal", team: "A", player: "Ana", playerId: "a", ownGoal: false, at: "2" },
            { type: "goal", team: "B", player: "Beto", playerId: "b", ownGoal: false, at: "3" },
            { type: "goal", team: "B", player: "Beto", playerId: "b", ownGoal: false, at: "4" },
        ]),
    ]);
    assert.deepEqual(tabla.map((s) => `${s.name}:${s.goals}`), ["Beto:2", "Ana:1", "Zoe:1"]);
});

test("computeTopScorers: toma la foto del jugador de la convocatoria del partido", () => {
    const tabla = computeTopScorers([
        partido("rojo", "azul", [
            { type: "lineup", team: "A", players: [{ playerId: "p1", name: "Diego", photo: "d.jpg" }], at: "0" },
            { type: "goal", team: "A", player: "Diego", playerId: "p1", ownGoal: false, at: "1" },
        ]),
    ]);
    assert.equal(tabla[0].photo, "d.jpg");
});

test("computeTopScorers: tolera entradas vacías o mal formadas", () => {
    assert.deepEqual(computeTopScorers(null), []);
    assert.deepEqual(computeTopScorers([]), []);
    assert.deepEqual(computeTopScorers([partido("a", "b", null)]), []);
});

// ---------------------------------------------------------------------------------
// Soft delete: un evento eliminado se marca con `deleted: true` y NO se saca de la
// bitácora. Todo lo derivado tiene que ignorarlo — si una sola función se olvida, un
// gol eliminado sigue contando en su vista.
// ---------------------------------------------------------------------------------

const { isDeletedEvent } = require("../matchEvents.js");

test("isDeletedEvent: solo es true con el flag explícito", () => {
    assert.equal(isDeletedEvent({ type: "goal", deleted: true }), true);
    assert.equal(isDeletedEvent({ type: "goal", deleted: false }), false);
    assert.equal(isDeletedEvent({ type: "goal" }), false);
    assert.equal(isDeletedEvent(null), false);
});

test("isValidEvent: acepta el flag deleted y rechaza un valor que no sea booleano", () => {
    assert.equal(isValidEvent({ type: "goal", team: "A", ownGoal: false, deleted: true }), true);
    assert.equal(isValidEvent({ type: "goal", team: "A", ownGoal: false, deleted: false }), true);
    assert.equal(isValidEvent({ type: "goal", team: "A", ownGoal: false, deleted: "sí" }), false);
});

test("summarizeEvents: un gol borrado no cuenta en el marcador", () => {
    const s = summarizeEvents([
        { type: "half_start", half: 1, at: "1" },
        { type: "goal", team: "A", ownGoal: false, at: "2" },
        { type: "goal", team: "A", ownGoal: false, at: "3", deleted: true },
    ]);
    assert.equal(s.scoreA, 1);
});

test("summarizeEvents: una tarjeta borrada no cuenta", () => {
    const s = summarizeEvents([
        { type: "half_start", half: 1, at: "1" },
        { type: "yellow_card", team: "B", at: "2", deleted: true },
        { type: "red_card", team: "B", at: "3" },
    ]);
    assert.equal(s.cardsB.yellow, 0);
    assert.equal(s.cardsB.red, 1);
});

test("summarizeEvents: un penal convertido y borrado no suma", () => {
    const s = summarizeEvents([
        { type: "half_start", half: 1, at: "1" },
        { type: "penalty", team: "A", scored: true, at: "2", deleted: true },
    ]);
    assert.equal(s.scoreA, 0);
});

test("summarizeEvents: una convocatoria borrada no reemplaza a la vigente", () => {
    const s = summarizeEvents([
        { type: "lineup", team: "A", players: ["Diego"], at: "1" },
        { type: "lineup", team: "A", players: ["Otro"], at: "2", deleted: true },
    ]);
    assert.deepEqual(s.lineupA.map((p) => p.name), ["Diego"]);
});

test("isClockGatedSequenceValid: un gol borrado fuera de tiempo no invalida la secuencia", () => {
    // Es el caso que permite borrar un evento mal cargado sin que el arreglo entero
    // quede rechazado por el servidor.
    const events = [
        { type: "half_start", half: 1, at: "1" },
        { type: "half_end", half: 1, at: "2" },
        { type: "goal", team: "A", ownGoal: false, at: "3", deleted: true },
    ];
    assert.equal(isClockGatedSequenceValid(events), true);
});

test("isClockGatedSequenceValid: un gol vigente fuera de tiempo sí invalida", () => {
    const events = [
        { type: "half_start", half: 1, at: "1" },
        { type: "half_end", half: 1, at: "2" },
        { type: "goal", team: "A", ownGoal: false, at: "3" },
    ];
    assert.equal(isClockGatedSequenceValid(events), false);
});

test("computeTopScorers: un gol borrado no se le acredita al jugador", () => {
    const tabla = computeTopScorers([
        {
            teamAId: "rojo",
            teamBId: "azul",
            events: [
                { type: "goal", team: "A", player: "Diego", playerId: "p1", ownGoal: false, at: "1" },
                { type: "goal", team: "A", player: "Diego", playerId: "p1", ownGoal: false, at: "2", deleted: true },
            ],
        },
    ]);
    assert.equal(tabla[0].goals, 1);
});

test("computeTopScorers: si todos sus goles se borraron, el jugador sale de la tabla", () => {
    const tabla = computeTopScorers([
        {
            teamAId: "rojo",
            teamBId: "azul",
            events: [
                { type: "goal", team: "A", player: "Diego", playerId: "p1", ownGoal: false, at: "1", deleted: true },
            ],
        },
    ]);
    assert.deepEqual(tabla, []);
});

test("mergeEvents: un borrado se propaga como una edición más, sin depender de baseKeys", () => {
    // Es la ventaja de fondo del soft delete: antes, para que un borrado llegara al
    // servidor había que mandar `baseKeys`; ahora el evento marcado viaja solo.
    const vivo = { id: "e1", type: "goal", team: "A", ownGoal: false, at: "2026-08-20T20:00:00.000Z" };
    const borrado = { ...vivo, deleted: true };
    const merged = mergeEvents([vivo], [borrado], null);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].deleted, true);
    assert.equal(summarizeEvents(merged).scoreA, 0);
});

test("mergeEvents: el evento borrado sobrevive a la fusión (no se pierde el rastro)", () => {
    const otro = { id: "e2", type: "goal", team: "B", ownGoal: false, at: "2026-08-20T20:05:00.000Z" };
    const borrado = { id: "e1", type: "goal", team: "A", ownGoal: false, at: "2026-08-20T20:00:00.000Z", deleted: true };
    const merged = mergeEvents([borrado], [otro], []);
    assert.deepEqual(merged.map((e) => e.id), ["e1", "e2"]);
    assert.equal(merged[0].deleted, true);
});
