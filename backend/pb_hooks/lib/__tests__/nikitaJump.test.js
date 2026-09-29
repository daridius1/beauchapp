const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MAX_TICKS,
    legacyNikitaScoreForDistance,
    nikitaScoreForDistance,
    createNikitaState,
    stepNikitaState,
    sanitizeReplay,
    simulateNikitaReplay,
} = require('../nikitaJump.js');

const VERIFIED_REPLAY = [
    { t: 0, d: -1 }, { t: 20, d: 1 }, { t: 60, d: -1 }, { t: 80, d: 0 },
    { t: 100, d: -1 }, { t: 120, d: 1 }, { t: 140, d: -1 }, { t: 160, d: 1 },
    { t: 180, d: -1 }, { t: 200, d: 0 }, { t: 220, d: -1 }, { t: 240, d: 1 },
    { t: 260, d: 0 }, { t: 280, d: 1 }, { t: 320, d: 0 }, { t: 360, d: -1 },
    { t: 380, d: 0 }, { t: 400, d: 1 }, { t: 420, d: 0 }, { t: 460, d: 1 },
    { t: 480, d: -1 }, { t: 520, d: 1 }, { t: 580, d: -1 }, { t: 600, d: 0 },
    { t: 620, d: -1 }, { t: 660, d: 1 }, { t: 680, d: 0 }, { t: 760, d: -1 },
    { t: 780, d: 1 }, { t: 800, d: -1 }, { t: 840, d: 1 }, { t: 860, d: 0 },
    { t: 880, d: 1 }, { t: 900, d: -1 }, { t: 920, d: 1 }, { t: 940, d: -1 },
    { t: 960, d: 1 }, { t: 1000, d: 0 }, { t: 1020, d: 1 }, { t: 1040, d: 0 },
    { t: 1080, d: -1 },
];

test('un replay determinista reproduce exactamente puntaje, duración y game over', () => {
    const state = simulateNikitaReplay(12345, 1082, VERIFIED_REPLAY);
    assert.ok(state);
    assert.equal(state.finished, true);
    assert.equal(state.tick, 642);
    assert.equal(state.score, 363);
    assert.equal(state.deathReason, 'fall');
    assert.equal(state.hits, 1);
});

test('el puntaje usa una curva n log n sobre la distancia', () => {
    assert.equal(nikitaScoreForDistance(0), 0);
    assert.equal(nikitaScoreForDistance(50), 283);
    assert.equal(nikitaScoreForDistance(150), 1085);
    assert.ok(nikitaScoreForDistance(300) > nikitaScoreForDistance(150) * 2);
    assert.ok(nikitaScoreForDistance(300) < nikitaScoreForDistance(150) * 4);
});

test('reconoce el puntaje lineal de una pestaña anterior sin cambiar el canónico', () => {
    assert.equal(legacyNikitaScoreForDistance(61.09), 610);
    assert.equal(nikitaScoreForDistance(61.09), 363);
});

test('la misma semilla y controles siempre producen el mismo estado', () => {
    const first = simulateNikitaReplay(987654321, 1082, VERIFIED_REPLAY);
    const second = simulateNikitaReplay(987654321, 1082, VERIFIED_REPLAY);
    assert.deepEqual(first, second);
});

test('rechaza ticks, direcciones y orden de eventos inválidos', () => {
    assert.equal(sanitizeReplay([], 0), null);
    assert.equal(sanitizeReplay([], MAX_TICKS + 1), null);
    assert.equal(sanitizeReplay([{ t: 2, d: 1 }, { t: 1, d: 0 }], 10), null);
    assert.equal(sanitizeReplay([{ t: 1, d: 2 }], 10), null);
    assert.equal(sanitizeReplay([{ t: 10, d: 1 }], 10), null);
});

test('la cámara solo avanza al ganar altura y deja poco margen para retroceder', () => {
    const state = createNikitaState(1);
    while (state.player.vy < 0) stepNikitaState(state, 0);
    const distanceAtApex = state.distance;
    for (let i = 0; i < 10; i++) stepNikitaState(state, 0);
    assert.equal(state.distance, distanceAtApex);

    while (!state.finished && state.tick < 500) stepNikitaState(state, 0);
    assert.equal(state.finished, true);
    assert.ok(state.tick < 500);
    assert.ok(state.score > 0);
    assert.ok(state.deathReason === 'fall' || state.deathReason === 'projectile');
});

test('la última plataforma usada permanece visible y las demás se eliminan al salir', () => {
    const state = createNikitaState(9);
    const lastPlatformId = state.lastLandedPlatformId;
    state.player = { x: 44, y: 90, vy: -20 };

    stepNikitaState(state, 0);

    const retained = state.platforms.find((platform) => platform.id === lastPlatformId);
    assert.ok(retained);
    assert.equal(retained.y, 133);
    assert.ok(state.platforms.every((platform) => platform.y >= 0 && platform.y < 140));

    state.lastLandedPlatformId = null;
    state.player = { x: 44, y: 90, vy: -20 };
    stepNikitaState(state, 0);
    assert.equal(state.platforms.some((platform) => platform.id === lastPlatformId), false);
    assert.ok(state.platforms.every((platform) => platform.y >= 0 && platform.y < 140));
});

test('cada rebote consume un uso de la plataforma y la elimina al agotarse', () => {
    const state = createNikitaState(1);
    const platform = state.platforms[0];
    state.player = { x: 44, y: platform.y - 12.4, vy: 30 };

    stepNikitaState(state, 0);
    assert.equal(platform.remainingBounces, 2);

    for (let use = 0; use < 2; use++) {
        state.player = { x: 44, y: platform.y - 12.4, vy: 30 };
        stepNikitaState(state, 0);
    }
    assert.equal(state.platforms.some((item) => item.id === platform.id), false);
});

test('los proyectiles conservan su posición relativa al mapa cuando se mueve la cámara', () => {
    const state = createNikitaState(7);
    const platform = state.platforms[3];
    state.player = { x: 44, y: 99, vy: -10 };
    state.projectiles.push({
        id: 1,
        kind: 'linear_algebra',
        glyph: 'p',
        x: 10,
        y: 20,
        baseX: 10,
        baseY: 20,
        vx: 0,
        vy: 0,
        age: 0,
        phase: 0,
        normalX: 0,
        normalY: 0,
        waveAmplitude: 0,
        waveStep: 0,
        gravity: 0,
        reflectionsRemaining: 0,
        variant: 0,
        trail: [],
        hit: false,
        splitAfter: 0,
        mirrorX: 0,
        mirrorY: 0,
    });
    const relativeY = state.projectiles[0].y - platform.y;

    stepNikitaState(state, 0);

    const shiftedPlatform = state.platforms.find((item) => item.id === platform.id);
    assert.ok(shiftedPlatform);
    assert.equal(state.projectiles[0].y - shiftedPlatform.y, relativeY);
});

test('los monstruos aparecen arriba y disparan proyectiles deterministas', () => {
    const state = createNikitaState(12345);
    let currentPlatformY = 130;
    let target = null;
    let previousVelocity = state.player.vy;

    while (!state.finished && state.tick < 700) {
        if (!target || !state.platforms.some((platform) => platform.id === target.id)) target = null;
        if (!target) {
            target = state.platforms
                .filter((platform) => platform.y < currentPlatformY - 8 && platform.y > currentPlatformY - 38)
                .sort((first, second) => second.y - first.y)[0] || null;
        }
        const playerCenter = state.player.x + 6;
        const targetCenter = target ? target.x + target.width / 2 : 50;
        const direction = Math.abs(targetCenter - playerCenter) < 1 ? 0 : targetCenter < playerCenter ? -1 : 1;
        previousVelocity = state.player.vy;
        stepNikitaState(state, direction);
        if (previousVelocity > 0 && state.player.vy < 0) {
            const landed = state.platforms.find((platform) => Math.abs(state.player.y + 12 - platform.y) < 1.5);
            if (landed) {
                currentPlatformY = landed.y;
                target = null;
            }
        }
    }

    assert.ok(state.nextMonsterId > 1);
    assert.ok(state.nextProjectileId > 1);
});

test('los jefes entran de a uno, salen por el lado contrario y rotan en orden', () => {
    const state = createNikitaState(42);
    state.nextMonsterTick = 0;
    stepNikitaState(state, 0);
    assert.equal(state.monsters.length, 1);
    assert.equal(state.monsters[0].kind, 'intro_algebra');
    assert.ok(state.monsters[0].x < 0 || state.monsters[0].x > 78);

    const finishAndSpawn = (distance) => {
        state.monsters[0].age = state.monsters[0].lifetime - 1;
        stepNikitaState(state, 0);
        assert.equal(state.monsters.length, 0);
        state.distance = distance;
        state.nextMonsterTick = state.tick;
        stepNikitaState(state, 0);
        assert.equal(state.monsters.length, 1);
        return state.monsters[0].kind;
    };

    assert.equal(finishAndSpawn(120), 'intro_calculus');
    assert.equal(finishAndSpawn(240), 'classical_physics');
    assert.equal(finishAndSpawn(450), 'linear_algebra');
    assert.equal(finishAndSpawn(600), 'differential');
    assert.equal(finishAndSpawn(750), 'modern_physics');
});

function stateWithShootingMonster(kind) {
    const state = createNikitaState(77);
    const setup = {
        intro_algebra: { id: 1, distance: 0 },
        linear_algebra: { id: 1, distance: 450 },
        intro_calculus: { id: 2, distance: 120 },
        differential: { id: 2, distance: 600 },
        classical_physics: { id: 3, distance: 240 },
        modern_physics: { id: 3, distance: 750 },
    }[kind];
    state.nextMonsterTick = 999999;
    state.distance = setup.distance;
    state.player = { x: 70, y: 110, vy: 0 };
    state.monsters = [{
        id: setup.id,
        kind,
        x: 10,
        y: 10,
        vx: 1,
        baseY: 10,
        age: 240,
        lifetime: 480,
        shotCooldown: 0,
    }];
    return state;
}

test('un jefe no evoluciona mientras sigue en pantalla', () => {
    const state = stateWithShootingMonster('classical_physics');
    state.distance = 900;

    stepNikitaState(state, 0);

    assert.equal(state.monsters[0].kind, 'classical_physics');
    assert.equal(state.projectiles[0].kind, 'classical_physics');
});

test('Introducción al Álgebra dispara p, q y r en línea recta', () => {
    const state = stateWithShootingMonster('intro_algebra');
    const glyphs = [];
    for (let shot = 0; shot < 3; shot++) {
        state.monsters[0].shotCooldown = 0;
        stepNikitaState(state, 0);
        glyphs.push(state.projectiles[state.projectiles.length - 1].glyph);
    }
    assert.deepEqual(glyphs, ['p', 'q', 'r']);
    assert.ok(state.projectiles.every((projectile) => projectile.waveAmplitude === 0 && projectile.gravity === 0));
});

test('Diferencial dispara con desplazamiento senoidal', () => {
    const state = stateWithShootingMonster('differential');
    stepNikitaState(state, 0);
    const projectile = state.projectiles[0];
    for (let tick = 0; tick < 10; tick++) stepNikitaState(state, 0);
    assert.ok(Math.hypot(projectile.x - projectile.baseX, projectile.y - projectile.baseY) > 0.5);
    assert.ok(projectile.trail.length > 0);
});

test('Física Clásica dispara con aceleración parabólica', () => {
    const state = stateWithShootingMonster('classical_physics');
    stepNikitaState(state, 0);
    const projectile = state.projectiles[0];
    const initialVelocity = projectile.vy;
    for (let tick = 0; tick < 10; tick++) stepNikitaState(state, 0);
    assert.ok(projectile.gravity > 0);
    assert.ok(initialVelocity < 0);
    assert.ok(projectile.vy > initialVelocity);
});

test('Álgebra Lineal dispara matrices más grandes', () => {
    const state = stateWithShootingMonster('linear_algebra');
    stepNikitaState(state, 0);
    assert.equal(state.projectiles[0].glyph, '1 0\n0 1');
});

test('los proyectiles aceleran y los jefes disparan con más frecuencia al avanzar', () => {
    const earlyState = stateWithShootingMonster('linear_algebra');
    const lateState = stateWithShootingMonster('linear_algebra');
    lateState.distance = 1080;

    stepNikitaState(earlyState, 0);
    stepNikitaState(lateState, 0);

    const earlyProjectile = earlyState.projectiles[0];
    const lateProjectile = lateState.projectiles[0];
    const earlySpeed = Math.hypot(earlyProjectile.vx, earlyProjectile.vy);
    const lateSpeed = Math.hypot(lateProjectile.vx, lateProjectile.vy);

    assert.ok(lateSpeed > earlySpeed);
    assert.ok(lateState.monsters[0].shotCooldown < earlyState.monsters[0].shotCooldown);
});

test('Física Moderna hace pasar un fotón por un espejo antes de separarlo', () => {
    const state = stateWithShootingMonster('modern_physics');
    stepNikitaState(state, 0);
    assert.equal(state.projectiles.length, 1);
    assert.equal(state.projectiles[0].variant, -1);
    assert.ok(state.projectiles[0].mirrorY > state.projectiles[0].y);

    for (let tick = 0; tick < 21; tick++) stepNikitaState(state, 0);
    assert.equal(state.projectiles.length, 3);
    assert.deepEqual(state.projectiles.map((projectile) => projectile.variant), [0, 1, 2]);
    assert.ok(state.projectiles.every((projectile) => projectile.glyph === 'γ'));
});

test('los impactos consumen vidas y la tercera colisión termina la partida', () => {
    const state = stateWithShootingMonster('intro_algebra');
    for (let hit = 1; hit <= 3; hit++) {
        state.monsters[0].shotCooldown = 0;
        stepNikitaState(state, 0);
        const projectile = state.projectiles[state.projectiles.length - 1];
        projectile.x = state.player.x + 4;
        projectile.y = state.player.y + 4;
        projectile.baseX = projectile.x;
        projectile.baseY = projectile.y;
        projectile.vx = 0;
        projectile.vy = 0;
        state.invulnerabilityTicks = 0;
        state.monsters[0].shotCooldown = 9999;
        stepNikitaState(state, 0);
        assert.equal(state.lives, 3 - hit);
    }
    assert.equal(state.hits, 3);
    assert.equal(state.finished, true);
    assert.equal(state.deathReason, 'projectile');
});

test('las bolitas recuperan vidas o entregan diez segundos de inmunidad', () => {
    const lifeState = createNikitaState(1);
    lifeState.lives = 2;
    lifeState.pickups = [{ id: 1, kind: 'life', x: 44, y: 112 }];
    stepNikitaState(lifeState, 0);
    assert.equal(lifeState.lives, 3);
    assert.equal(lifeState.pickups.length, 0);

    const immunityState = createNikitaState(1);
    immunityState.pickups = [{ id: 1, kind: 'immunity', x: 44, y: 112 }];
    stepNikitaState(immunityState, 0);
    assert.equal(immunityState.invulnerabilityTicks, 600);
    assert.equal(immunityState.pickups.length, 0);
});

test('el área dejada por Diferencial también registra impactos', () => {
    const state = stateWithShootingMonster('differential');
    stepNikitaState(state, 0);
    const projectile = state.projectiles[0];
    projectile.x = 0;
    projectile.y = 0;
    projectile.baseX = 0;
    projectile.baseY = 0;
    projectile.vx = 0;
    projectile.vy = 0;
    projectile.waveAmplitude = 0;
    projectile.trail = [{
        x: state.player.x,
        y: state.player.y,
        baseX: state.player.x,
        baseY: state.player.y,
    }];

    stepNikitaState(state, 0);

    assert.equal(state.hits, 1);
    assert.equal(state.finished, false);
});
