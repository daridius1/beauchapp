// Lógica pura (sin `$app`/PocketBase) del cálculo de OpenSkill para partidos de ladders.
// Se usa tanto desde ladders.pb.js (vía require) como desde los tests en lib/__tests__
// (vía Node directamente).

function standardPdf(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function standardCdf(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (x > 0) prob = 1 - prob;
    return prob;
}

function vMatch(t) {
    const cdf = standardCdf(t);
    if (cdf < 1e-10) return -t;
    return standardPdf(t) / cdf;
}

function wMatch(t) {
    const v = vMatch(t);
    return v * (v + t);
}

// redPlayers/bluePlayers: Array<{ userId, mu, sigma }>. winner: 'red' | 'blue' | 'draw'.
// Devuelve { red: [...], blue: [...] } con { userId, mu, sigma, ordinal_rating, delta } actualizados.
function calculateOpenSkillUpdate(redPlayers, bluePlayers, winner) {
    const BETA = 4.166666666666667;
    const BETA_SQ = BETA * BETA;

    let muRed = 0, sigmaSqRed = 0;
    redPlayers.forEach(p => {
        muRed += p.mu;
        sigmaSqRed += p.sigma * p.sigma;
    });

    let muBlue = 0, sigmaSqBlue = 0;
    bluePlayers.forEach(p => {
        muBlue += p.mu;
        sigmaSqBlue += p.sigma * p.sigma;
    });

    const cSq = 2 * BETA_SQ + sigmaSqRed + sigmaSqBlue;
    const c = Math.sqrt(cSq);

    let diff = 0;
    if (winner === 'red') {
        diff = (muRed - muBlue) / c;
    } else if (winner === 'blue') {
        diff = (muBlue - muRed) / c;
    } else {
        diff = Math.abs(muRed - muBlue) / c;
    }

    const v = vMatch(diff);
    const w = wMatch(diff);

    const updatedRed = redPlayers.map(p => {
        const sigSq = p.sigma * p.sigma;
        let newMu = p.mu;
        if (winner === 'red') {
            newMu += (sigSq / c) * v;
        } else if (winner === 'blue') {
            newMu -= (sigSq / c) * v;
        }
        const newSigSq = sigSq * (1 - (sigSq / cSq) * w);
        const newSigma = Math.max(0.0001, Math.sqrt(Math.max(0.0001, newSigSq)));
        const newOrdinal = Math.max(0, Math.round((newMu - 3 * newSigma) * 100) / 100);

        return {
            userId: p.userId,
            mu: newMu,
            sigma: newSigma,
            ordinal_rating: newOrdinal,
            delta: newOrdinal - (p.mu - 3 * p.sigma)
        };
    });

    const updatedBlue = bluePlayers.map(p => {
        const sigSq = p.sigma * p.sigma;
        let newMu = p.mu;
        if (winner === 'blue') {
            newMu += (sigSq / c) * v;
        } else if (winner === 'red') {
            newMu -= (sigSq / c) * v;
        }
        const newSigSq = sigSq * (1 - (sigSq / cSq) * w);
        const newSigma = Math.max(0.0001, Math.sqrt(Math.max(0.0001, newSigSq)));
        const newOrdinal = Math.max(0, Math.round((newMu - 3 * newSigma) * 100) / 100);

        return {
            userId: p.userId,
            mu: newMu,
            sigma: newSigma,
            ordinal_rating: newOrdinal,
            delta: newOrdinal - (p.mu - 3 * p.sigma)
        };
    });

    return { red: updatedRed, blue: updatedBlue };
}

module.exports = { calculateOpenSkillUpdate };
