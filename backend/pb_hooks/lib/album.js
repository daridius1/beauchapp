// Lógica pura del álbum de figuritas: qué trae un sobre. Sin `$app` — testeado en
// __tests__/album.test.js.

const PACK_SIZE = 5;
const PACK_PRICE = 20;

// Cupos diarios de sobres (ver album_pack_claims y album.pb.js): 3 gratis + hasta 3
// comprables a PACK_PRICE c/u, reseteados por día calendario en huso America/Santiago.
// El bono por completar el Beaudle del día es aparte (booleano, no cuenta) porque no
// tiene sentido "más de uno" — el Beaudle solo se juega una vez por día.
const FREE_PACKS_PER_DAY = 3;
const BOUGHT_PACKS_PER_DAY = 3;

// Slots fijos por equipo (0-indexados, 2 dígitos): 00-03 son las cartas especiales
// de hoy (escudo, foto de equipo, DT, capitán); 04-09 quedan reservados para futuras
// cartas especiales sin tener que correr la numeración de nadie. La foto de equipo es
// panorámica y se reparte en 2 láminas FÍSICAMENTE distintas (izquierda/derecha, ver
// buildTeamSlots en LeagueAlbumScreen.tsx) — cada mitad es su propia figurita
// coleccionable (su propio código, su propio count/pasted en album_stickers, sale por
// separado del sorteo de sobres), por eso ocupa 2 slots en vez de 1: el 01 de siempre
// para la izquierda y el primero de los reservados (04) para la derecha, así no hace
// falta correr la numeración de DT/capitán. Los jugadores arrancan recién en el 10 —
// ver team_players.pb.js (asignación permanente) y album.pb.js (armado del sobre y
// del checklist).
const SLOT_CREST = 0;
const SLOT_TEAM_PHOTO_LEFT = 1;
const SLOT_DT = 2;
const SLOT_CAPTAIN = 3;
const SLOT_TEAM_PHOTO_RIGHT = 4;
const FIRST_PLAYER_SLOT = 10;

// Categorías válidas para `album_leagues.category` (ver esa migración) — siempre
// masculina/femenina/mixta, nunca texto libre: son las 3 formas en que de verdad se
// arma una liga acá. Lista compartida entre el schema (la migración usa estos mismos
// valores) y la validación de POST /api/admin/album/set-league-category.
const CATEGORY_VALUES = ["masc", "fem", "mixto"];

// Elige `size` ids CON reemplazo de `playerIds`. Salir repetida dentro del mismo
// sobre es parte del punto del álbum (v1 simple: sin rareza ni pesos todavía).
// `rng` es inyectable (debe devolver un float en [0,1)) para que los tests sean
// determinísticos sin mockear Math.random globalmente.
function pickPack(playerIds, size = PACK_SIZE, rng = Math.random) {
    if (!Array.isArray(playerIds) || playerIds.length === 0) return [];
    const drawn = [];
    for (let i = 0; i < size; i++) {
        const idx = Math.floor(rng() * playerIds.length);
        drawn.push(playerIds[idx]);
    }
    return drawn;
}

// Código de figurita: 2 dígitos de equipo + 2 dígitos de slot, ej. equipo 1 + slot 13
// (el 10º jugador, contando los 3 slots fijos de escudo/foto/DT) = "0113". Ninguno de
// los dos números se recalcula nunca (ver album.pb.js y team_players.pb.js) — esto es
// puro formato de display sobre números ya permanentes.
function stickerCode(teamNumber, slotNumber) {
    const pad = (n) => String(n).padStart(2, "0");
    return pad(teamNumber) + pad(slotNumber);
}

// Copias "sueltas" (sin pegar) de una figurita — las que se pueden pegar u ofrecer en
// un intercambio. `pasted=true` consume conceptualmente UNA copia (la que está pegada
// en el álbum); todo lo que sobra por encima de esa cuenta es lámina suelta. El
// Math.max es por paranoia de la función pura: `count` nunca debería llegar a 0 con
// `pasted=true` (la fila se borra en ese caso, ver album_trades.pb.js), pero esta
// función no debe poder devolver un negativo si algo cambia más adelante.
function looseCount(count, pasted) {
    return Math.max(0, count - (pasted ? 1 : 0));
}

// Intercambios (album_trades.pb.js): tope de láminas por lado de una propuesta y de
// propuestas pendientes que un usuario puede tener abiertas a la vez. Las láminas
// ofrecidas NO se reservan mientras la propuesta está pendiente — quien ofrece puede
// tener la misma repetida comprometida en varias propuestas, y la primera que se
// confirme gana (el confirm revalida ambos lados dentro de la transacción). El tope de
// pendientes es lo único que impide que eso escale a cientos de filas muertas, y de
// paso es el freno anti-spam: el servidor es un Atom con 2 GB (PRINCIPLES.md §1).
const MAX_TRADE_STICKERS = 10;
const MAX_PENDING_TRADES = 20;

// Cuántas veces aparece cada código en una lista. Ofrecer dos copias de la misma
// figurita es legítimo (son repetidas), así que la lista lleva el código repetido y
// todo lo que valide contra el inventario tiene que mirar la cuenta, no la presencia.
function countCodes(codes) {
    const counts = {};
    (codes || []).forEach((code) => {
        counts[code] = (counts[code] || 0) + 1;
    });
    return counts;
}

// Normaliza lo que llega por la API a una lista de códigos usable, o tira el motivo
// por el que no lo es. Devuelve la lista tal cual (con repetidas), no un set: la
// cantidad es parte de la oferta.
function normalizeTradeCodes(raw, max = MAX_TRADE_STICKERS) {
    if (!Array.isArray(raw)) return { error: "Hay que elegir al menos una lámina." };
    const codes = raw.map((c) => String(c || "").trim()).filter((c) => c.length > 0);
    if (codes.length === 0) return { error: "Hay que elegir al menos una lámina." };
    if (codes.length > max) return { error: `No se pueden intercambiar más de ${max} láminas por lado.` };
    if (codes.some((c) => !/^\d{4}$/.test(c))) return { error: "Alguna de las láminas elegidas no es válida." };
    return { codes };
}

// Códigos que el inventario `looseByCode` (código → copias sueltas) no alcanza a
// cubrir, contando repetidas: ofrecer dos copias de la misma lámina exige 2 sueltas.
// Devuelve los códigos que fallan para poder decir cuál, no solo que algo falló.
function uncoveredCodes(codes, looseByCode) {
    const need = countCodes(codes);
    return Object.keys(need).filter((code) => (looseByCode[code] || 0) < need[code]);
}

module.exports = {
    PACK_SIZE, PACK_PRICE, FREE_PACKS_PER_DAY, BOUGHT_PACKS_PER_DAY, pickPack, stickerCode, looseCount,
    SLOT_CREST, SLOT_TEAM_PHOTO_LEFT, SLOT_TEAM_PHOTO_RIGHT, SLOT_DT, SLOT_CAPTAIN, FIRST_PLAYER_SLOT,
    CATEGORY_VALUES,
    MAX_TRADE_STICKERS, MAX_PENDING_TRADES, countCodes, normalizeTradeCodes, uncoveredCodes,
};
