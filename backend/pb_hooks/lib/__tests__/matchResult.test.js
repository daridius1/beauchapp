const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resultTokenDecision } = require("../matchResult.js");

function futureIso(days) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

test("resultTokenDecision: token correcto y vigente pasa", () => {
    const match = { resultToken: "abc123", resultTokenExpiresAt: futureIso(5) };
    assert.equal(resultTokenDecision(match, "abc123").ok, true);
});

test("resultTokenDecision: token incorrecto se rechaza", () => {
    const match = { resultToken: "abc123", resultTokenExpiresAt: futureIso(5) };
    const decision = resultTokenDecision(match, "otro");
    assert.equal(decision.ok, false);
});

test("resultTokenDecision: sin token guardado (ya usado o nunca generado) se rechaza", () => {
    const match = { resultToken: "", resultTokenExpiresAt: futureIso(5) };
    assert.equal(resultTokenDecision(match, "abc123").ok, false);
});

test("resultTokenDecision: sin token provisto se rechaza", () => {
    const match = { resultToken: "abc123", resultTokenExpiresAt: futureIso(5) };
    assert.equal(resultTokenDecision(match, "").ok, false);
});

test("resultTokenDecision: token vencido se rechaza", () => {
    const match = { resultToken: "abc123", resultTokenExpiresAt: futureIso(-1) };
    const decision = resultTokenDecision(match, "abc123");
    assert.equal(decision.ok, false);
    assert.match(decision.error, /venció/);
});

test("resultTokenDecision: sin fecha de vencimiento se rechaza", () => {
    const match = { resultToken: "abc123", resultTokenExpiresAt: "" };
    assert.equal(resultTokenDecision(match, "abc123").ok, false);
});
