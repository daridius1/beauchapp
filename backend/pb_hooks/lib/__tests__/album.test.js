const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    PACK_SIZE, PACK_PRICE, FREE_PACKS_PER_DAY, BOUGHT_PACKS_PER_DAY, pickPack, stickerCode, looseCount,
    SLOT_CREST, SLOT_TEAM_PHOTO_LEFT, SLOT_TEAM_PHOTO_RIGHT, SLOT_DT, SLOT_CAPTAIN, FIRST_PLAYER_SLOT,
    CATEGORY_VALUES,
} = require("../album.js");

test("PACK_SIZE, PACK_PRICE y los cupos diarios son los valores acordados", () => {
    assert.equal(PACK_SIZE, 5);
    assert.equal(PACK_PRICE, 20);
    assert.equal(FREE_PACKS_PER_DAY, 3);
    assert.equal(BOUGHT_PACKS_PER_DAY, 3);
});

test("pickPack: set vacío devuelve sobre vacío", () => {
    assert.deepEqual(pickPack([], 5), []);
});

test("pickPack: devuelve exactamente `size` elementos del set elegible", () => {
    const ids = ["p1", "p2", "p3"];
    const drawn = pickPack(ids, 5, () => 0);
    assert.equal(drawn.length, 5);
    drawn.forEach((id) => assert.ok(ids.includes(id)));
});

test("pickPack: rng=0 siempre elige el primer id (borde inferior)", () => {
    const ids = ["p1", "p2", "p3"];
    assert.deepEqual(pickPack(ids, 3, () => 0), ["p1", "p1", "p1"]);
});

test("pickPack: rng cercano a 1 elige el último id (borde superior)", () => {
    const ids = ["p1", "p2", "p3"];
    assert.deepEqual(pickPack(ids, 3, () => 0.999999), ["p3", "p3", "p3"]);
});

test("pickPack: puede repetir dentro del mismo sobre (parte del punto del álbum)", () => {
    const ids = ["p1", "p2"];
    let call = 0;
    const rng = () => (call++ % 2 === 0 ? 0 : 0.9);
    const drawn = pickPack(ids, 4, rng);
    assert.deepEqual(drawn, ["p1", "p2", "p1", "p2"]);
});

test("pickPack: respeta un tamaño de sobre distinto al default", () => {
    const ids = ["p1"];
    assert.equal(pickPack(ids, 1).length, 1);
    assert.equal(pickPack(ids, 10).length, 10);
});

test('stickerCode: equipo 1, slot 19 (el 10º jugador, arrancando en FIRST_PLAYER_SLOT) da "0119"', () => {
    assert.equal(stickerCode(1, FIRST_PLAYER_SLOT + 9), "0119");
});

test("stickerCode: rellena con ceros a la izquierda en ambas partes", () => {
    assert.equal(stickerCode(1, 1), "0101");
    assert.equal(stickerCode(1, 2), "0102");
    assert.equal(stickerCode(1, 3), "0103");
});

test("stickerCode: equipo de dos dígitos", () => {
    assert.equal(stickerCode(12, 5), "1205");
});

test("stickerCode: las 4 cartas especiales del equipo 1 son 0100-0103", () => {
    assert.equal(stickerCode(1, SLOT_CREST), "0100");
    assert.equal(stickerCode(1, SLOT_TEAM_PHOTO_LEFT), "0101");
    assert.equal(stickerCode(1, SLOT_DT), "0102");
    assert.equal(stickerCode(1, SLOT_CAPTAIN), "0103");
});

test("stickerCode: la mitad derecha de la foto de equipo usa el primer slot reservado (04)", () => {
    assert.equal(stickerCode(1, SLOT_TEAM_PHOTO_RIGHT), "0104");
});

test("las 2 mitades de la foto de equipo son códigos distintos entre sí", () => {
    assert.notEqual(SLOT_TEAM_PHOTO_LEFT, SLOT_TEAM_PHOTO_RIGHT);
});

test("FIRST_PLAYER_SLOT deja hueco para futuras cartas especiales (05-09, ya que 04 lo toma la mitad derecha de la foto)", () => {
    assert.equal(FIRST_PLAYER_SLOT, 10);
    assert.ok(FIRST_PLAYER_SLOT > SLOT_TEAM_PHOTO_RIGHT + 1);
});

test("looseCount: pegada con una sola copia no deja nada suelto", () => {
    assert.equal(looseCount(1, true), 0);
});

test("looseCount: pegada con copias de más deja el resto suelto", () => {
    assert.equal(looseCount(3, true), 2);
});

test("looseCount: sin pegar, todas las copias están sueltas", () => {
    assert.equal(looseCount(2, false), 2);
});

test("looseCount: sin copias, nada suelto (pegada o no)", () => {
    assert.equal(looseCount(0, false), 0);
    assert.equal(looseCount(0, true), 0);
});

test("CATEGORY_VALUES: siempre masculina/femenina/mixta, nada más", () => {
    assert.deepEqual(CATEGORY_VALUES, ["masc", "fem", "mixto"]);
});
