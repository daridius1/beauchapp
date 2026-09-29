const ALLIANCE_IDS = ["urbana", "pop", "gotico", "hiphop", "punk", "rock"];
const MAX_NIKITA_SCORE = 10000000;

function isAllianceId(value) {
    return ALLIANCE_IDS.includes(String(value || ""));
}

function sanitizeNikitaScore(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > MAX_NIKITA_SCORE) return null;
    return Math.floor(numeric);
}

function nikitaRunPayload(userId, runId, seed, startedAt) {
    return `nikita-v1|${userId}|${runId}|${Number(seed) >>> 0}|${Math.floor(Number(startedAt))}`;
}

function buildAllianceScoreboard(rows) {
    const totals = Object.fromEntries(
        ALLIANCE_IDS.map((alliance) => [alliance, { alliance, points: 0, players: 0 }]),
    );
    for (const row of rows || []) {
        if (!isAllianceId(row.alliance)) continue;
        totals[row.alliance] = {
            alliance: row.alliance,
            points: Math.max(0, Math.floor(Number(row.points) || 0)),
            players: Math.max(0, Math.floor(Number(row.players) || 0)),
        };
    }
    return ALLIANCE_IDS
        .map((alliance) => totals[alliance])
        .sort((a, b) => b.points - a.points || ALLIANCE_IDS.indexOf(a.alliance) - ALLIANCE_IDS.indexOf(b.alliance));
}

function normalizeProfessorSearch(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .slice(0, 80);
}

function buildProfessorScoreboard(rows) {
    const totals = Object.fromEntries(
        ALLIANCE_IDS.map((alliance) => [alliance, { alliance, professors: 0 }]),
    );
    for (const row of rows || []) {
        if (!isAllianceId(row.alliance)) continue;
        totals[row.alliance] = {
            alliance: row.alliance,
            professors: Math.max(0, Math.floor(Number(row.professors) || 0)),
        };
    }
    return ALLIANCE_IDS
        .map((alliance) => totals[alliance])
        .sort((a, b) => b.professors - a.professors || ALLIANCE_IDS.indexOf(a.alliance) - ALLIANCE_IDS.indexOf(b.alliance));
}

function normalizeDisciplineName(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .slice(0, 80);
}

function sanitizeDisciplineName(value) {
    const name = String(value || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (name.length < 2) return null;
    return { name, normalizedName: normalizeDisciplineName(name) };
}

function normalizePlacements(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const unknown = Object.keys(value).filter((key) => !isAllianceId(key));
    if (unknown.length > 0) return null;

    const placements = [];
    const usedPlaces = new Set();
    for (const alliance of ALLIANCE_IDS) {
        const raw = value[alliance];
        if (raw === null || raw === undefined || raw === "") continue;
        const place = Number(raw);
        if (!Number.isInteger(place) || place < 1 || place > ALLIANCE_IDS.length || usedPlaces.has(place)) {
            return null;
        }
        usedPlaces.add(place);
        placements.push({ alliance, place });
    }
    return placements.sort((a, b) => a.place - b.place);
}

function buildDisciplineList(rows) {
    const byId = new Map();
    for (const row of rows || []) {
        const id = String(row.id || "");
        if (!id) continue;
        if (!byId.has(id)) byId.set(id, { id, name: String(row.name || ""), placements: [] });
        if (isAllianceId(row.alliance)) {
            const place = Number(row.place);
            if (Number.isInteger(place) && place >= 1 && place <= ALLIANCE_IDS.length) {
                byId.get(id).placements.push({ alliance: row.alliance, place });
            }
        }
    }
    return Array.from(byId.values()).map((discipline) => ({
        ...discipline,
        placements: discipline.placements.sort((a, b) => a.place - b.place),
    }));
}

function isAllianceAdmin(type, subtype) {
    return String(type || "") === "organization" && String(subtype || "") === "alliance";
}

module.exports = {
    ALLIANCE_IDS,
    MAX_NIKITA_SCORE,
    isAllianceId,
    sanitizeNikitaScore,
    nikitaRunPayload,
    buildAllianceScoreboard,
    normalizeProfessorSearch,
    buildProfessorScoreboard,
    normalizeDisciplineName,
    sanitizeDisciplineName,
    normalizePlacements,
    buildDisciplineList,
    isAllianceAdmin,
};
