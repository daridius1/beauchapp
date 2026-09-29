const NIKITA_SKIN_PRICE = 50;
const NIKITA_REWARD_THRESHOLDS = [283, 1085, 2470, 3967, 5538, 7164, 8833, 10539];
const NIKITA_REWARD_MIN_SCORE = NIKITA_REWARD_THRESHOLDS[0];

const NIKITA_SKIN_IDS = [
    "gcine-gris", "patin", "palestina", "gcine", "gmi", "bombachaya", "michis", "pymes", "hiphop",
    "computacion", "quimica", "minas", "geologia", "biotecnologia", "mecanica", "civil",
    "matematica", "industrial", "geofisica", "astronomia", "fisica", "electrica",
];

function isNikitaSkinId(value) {
    return NIKITA_SKIN_IDS.includes(String(value || ""));
}

// Los cortes corresponden a las mismas alturas de la economía anterior (50,
// 150, 300... unidades), recalculadas con la curva n log n vigente.
function nikitaRewardForScore(score) {
    const safeScore = Math.max(0, Math.floor(Number(score) || 0));
    let reward = 0;
    for (const threshold of NIKITA_REWARD_THRESHOLDS) {
        if (safeScore < threshold) break;
        reward += 1;
    }
    return reward;
}

module.exports = {
    NIKITA_SKIN_PRICE,
    NIKITA_REWARD_MIN_SCORE,
    NIKITA_REWARD_THRESHOLDS,
    NIKITA_SKIN_IDS,
    isNikitaSkinId,
    nikitaRewardForScore,
};
