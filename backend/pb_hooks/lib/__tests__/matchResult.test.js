const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resultTokenDecision, teamRefereeDecision, appendRefereeTeamLog } = require("../matchResult.js");

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

test("teamRefereeDecision: equipo asignado y partido 'confirmed' pasa", () => {
    const match = { refereeTeams: ["teamX", "teamY"], status: "confirmed" };
    assert.equal(teamRefereeDecision(match, "teamX").ok, true);
});

test("teamRefereeDecision: equipo asignado y partido 'played' (corrección) pasa", () => {
    const match = { refereeTeams: ["teamX", "teamY"], status: "played" };
    assert.equal(teamRefereeDecision(match, "teamY").ok, true);
});

test("teamRefereeDecision: equipo no asignado se rechaza", () => {
    const match = { refereeTeams: ["teamX", "teamY"], status: "confirmed" };
    assert.equal(teamRefereeDecision(match, "teamZ").ok, false);
});

test("teamRefereeDecision: sin refereeTeams asignados se rechaza", () => {
    const match = { refereeTeams: [], status: "confirmed" };
    assert.equal(teamRefereeDecision(match, "teamX").ok, false);
});

test("teamRefereeDecision: sin teamId se rechaza", () => {
    const match = { refereeTeams: ["teamX"], status: "confirmed" };
    assert.equal(teamRefereeDecision(match, "").ok, false);
});

test("teamRefereeDecision: partido cancelado se rechaza aunque el equipo esté asignado", () => {
    const match = { refereeTeams: ["teamX"], status: "cancelled" };
    assert.equal(teamRefereeDecision(match, "teamX").ok, false);
});

test("appendRefereeTeamLog: un JSONField nuevo con null empieza un arreglo", () => {
    assert.deepEqual(
        appendRefereeTeamLog("null", "teamX", "2026-09-13T00:00:00.000Z"),
        [{ team: "teamX", at: "2026-09-13T00:00:00.000Z" }]
    );
});

test("appendRefereeTeamLog: conserva envíos previos y agrega el nuevo", () => {
    const previous = JSON.stringify([{ team: "teamX", at: "2026-09-12T00:00:00.000Z" }]);
    assert.deepEqual(
        appendRefereeTeamLog(previous, "teamY", "2026-09-13T00:00:00.000Z"),
        [
            { team: "teamX", at: "2026-09-12T00:00:00.000Z" },
            { team: "teamY", at: "2026-09-13T00:00:00.000Z" },
        ]
    );
});
