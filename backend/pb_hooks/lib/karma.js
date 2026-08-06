// Lógica pura (sin `$app`/PocketBase) para el cálculo de Karma. Se usa tanto desde
// karma.pb.js (vía require) como desde los tests en lib/__tests__ (vía Node directamente).

// Karma que aporta UNA calificación individual: 2*(rating-3) para problemas,
// 1*(rating-3) + 1*(difficulty-3) para pautas (solo si el valor fue realmente calificado, >0).
function karmaDeltaForRating(isPauta, rVal, dVal) {
    let delta = 0;
    if (!isPauta) {
        if (rVal > 0) delta += 2 * (rVal - 3);
    } else {
        if (rVal > 0) delta += 1 * (rVal - 3);
        if (dVal > 0) delta += 1 * (dVal - 3);
    }
    return delta;
}

module.exports = { karmaDeltaForRating };
