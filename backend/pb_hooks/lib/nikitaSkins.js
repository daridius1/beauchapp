const NIKITA_SKIN_PRICE = 50;

const NIKITA_SKIN_IDS = [
    "gcine-gris", "patin", "palestina", "gcine", "gmi", "bombachaya", "michis", "pymes", "hiphop",
    "computacion", "quimica", "minas", "geologia", "biotecnologia", "mecanica", "civil",
    "matematica", "industrial", "geofisica", "astronomia", "fisica", "electrica",
];

function isNikitaSkinId(value) {
    return NIKITA_SKIN_IDS.includes(String(value || ""));
}

// La recompensa empieza recién al superar el tramo inicial y crece lentamente:
// una buena partida aporta, pero no alcanza por sí sola para comprar una skin.
function nikitaRewardForScore(score) {
    const safeScore = Math.max(0, Math.floor(Number(score) || 0));
    if (safeScore < 500) return 0;
    return Math.min(8, 1 + Math.floor(safeScore / 1500));
}

module.exports = {
    NIKITA_SKIN_PRICE,
    NIKITA_SKIN_IDS,
    isNikitaSkinId,
    nikitaRewardForScore,
};
