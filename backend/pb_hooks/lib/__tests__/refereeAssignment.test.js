const { test } = require("node:test");
const assert = require("node:assert/strict");
const { pickLeastBusyReferees } = require("../refereeAssignment.js");

test("pickLeastBusyReferees: elige los 2 candidatos con menor conteo", () => {
    const result = pickLeastBusyReferees(["A", "B", "C", "D"], { A: 3, B: 0, C: 1, D: 5 }, []);
    assert.deepEqual(result, ["B", "C"]);
});

test("pickLeastBusyReferees: excluye a los equipos que juegan el partido, aunque tengan el menor conteo", () => {
    const result = pickLeastBusyReferees(["A", "B", "C", "D"], { A: 0, B: 0, C: 3, D: 5 }, ["A", "B"]);
    assert.deepEqual(result, ["C", "D"]);
});

test("pickLeastBusyReferees: un equipo sin conteo previo cuenta como 0 (el más prioritario)", () => {
    const result = pickLeastBusyReferees(["A", "B", "C"], { A: 2, B: 5 }, []);
    // C no aparece en countByTeam -> cuenta 0, debe salir elegido junto con A (el otro más bajo).
    assert.deepEqual(result, ["C", "A"]);
});

test("pickLeastBusyReferees: con menos de 2 candidatos disponibles, devuelve lo que haya", () => {
    assert.deepEqual(pickLeastBusyReferees(["A"], { A: 0 }, []), ["A"]);
    assert.deepEqual(pickLeastBusyReferees([], {}, []), []);
    assert.deepEqual(pickLeastBusyReferees(["A", "B"], { A: 0, B: 0 }, ["A", "B"]), []);
});

test("pickLeastBusyReferees: empate de conteo se resuelve por el orden de los candidatos (estable)", () => {
    const result = pickLeastBusyReferees(["A", "B", "C"], { A: 0, B: 0, C: 0 }, []);
    assert.deepEqual(result, ["A", "B"]);
});
