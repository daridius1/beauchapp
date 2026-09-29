const TICK_RATE = 60;
const MAX_TICKS = TICK_RATE * 60 * 10;
const MAX_REPLAY_EVENTS = 5000;
const GAME_HEIGHT = 140;
const PLAYER_WIDTH = 12;
const PLAYER_HITBOX_INSET = 2;
const MONSTER_WIDTH = 22;
const MONSTER_HEIGHT = 17;
const CAMERA_ANCHOR_Y = 100;
const FIXED_DT = 1 / TICK_RATE;

function initialPlatforms() {
    return [
        { id: 1, x: 34, y: 130, width: 32, remainingBounces: 3 },
        { id: 2, x: 12, y: 106, width: 24, remainingBounces: 3 },
        { id: 3, x: 57, y: 82, width: 24, remainingBounces: 3 },
        { id: 4, x: 25, y: 58, width: 23, remainingBounces: 3 },
        { id: 5, x: 64, y: 34, width: 22, remainingBounces: 3 },
        { id: 6, x: 16, y: 10, width: 22, remainingBounces: 3 },
    ];
}

function createNikitaState(seed) {
    return {
        player: { x: 44, y: 112, vy: -78 },
        platforms: initialPlatforms(),
        monsters: [],
        projectiles: [],
        pickups: [],
        lives: 3,
        hits: 0,
        invulnerabilityTicks: 0,
        score: 0,
        distance: 0,
        tick: 0,
        nextPlatformId: 7,
        lastLandedPlatformId: 1,
        nextMonsterId: 1,
        nextProjectileId: 1,
        nextPickupId: 1,
        nextMonsterTick: 180,
        rngState: Number(seed) >>> 0,
        finished: false,
        deathReason: null,
    };
}

function nextRandom(state) {
    state.rngState = (state.rngState + 0x6D2B79F5) >>> 0;
    let value = state.rngState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function rounded(value) {
    return Math.round(value * 1000000) / 1000000;
}

function difficultyFor(state) {
    return Math.min(1, state.distance / 650);
}

function combatDifficultyFor(state) {
    return Math.min(1.35, state.distance / 800);
}

function shiftWorld(state, shift) {
    if (shift <= 0) return;
    state.distance = rounded(state.distance + shift);
    state.platforms = state.platforms.map((platform) => ({
        ...platform,
        y: rounded(platform.y + shift),
    }));
    state.pickups = state.pickups.map((pickup) => ({
        ...pickup,
        y: rounded(pickup.y + shift),
    }));
    state.projectiles = state.projectiles.map((projectile) => ({
        ...projectile,
        y: rounded(projectile.y + shift),
        baseY: rounded(projectile.baseY + shift),
        trail: projectile.trail.map((point) => ({
            ...point,
            y: rounded(point.y + shift),
            baseY: rounded(point.baseY + shift),
        })),
        mirrorY: rounded(projectile.mirrorY + shift),
    }));
}

function platformBounces(state, difficulty) {
    const roll = nextRandom(state);
    const oneBounceChance = 0.45 * difficulty * difficulty;
    const twoBounceChance = 0.65 * difficulty;
    if (roll < oneBounceChance) return 1;
    if (roll < oneBounceChance + twoBounceChance) return 2;
    return 3;
}

function pickupRoll(state, platformId) {
    let value = (state.rngState ^ Math.imul(platformId, 0x9E3779B1)) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x21F0AAAD);
    value = Math.imul(value ^ (value >>> 15), 0x735A2D97);
    return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}

function maybeSpawnPickup(state, platform, difficulty) {
    const roll = pickupRoll(state, platform.id);
    const appearanceChance = 0.22 - difficulty * 0.16;
    if (roll >= appearanceChance) return;
    state.pickups.push({
        id: state.nextPickupId++,
        kind: roll / appearanceChance < 0.55 ? 'life' : 'immunity',
        x: rounded(platform.x + platform.width / 2 - 2.5),
        y: rounded(platform.y - 7),
    });
}

function fillPlatforms(state, difficulty) {
    if (state.platforms.length === 0) return;
    let top = Math.min(...state.platforms.map((platform) => platform.y));
    while (top > 7) {
        const nextTop = top - (20 + difficulty * 6 + nextRandom(state) * 6);
        if (nextTop < 1) break;
        top = nextTop;
        const width = 23 - difficulty * 8 + nextRandom(state) * 6;
        const platform = {
            id: state.nextPlatformId++,
            x: rounded(4 + nextRandom(state) * (92 - width)),
            y: rounded(top),
            width: rounded(width),
            remainingBounces: platformBounces(state, difficulty),
        };
        state.platforms.push(platform);
        maybeSpawnPickup(state, platform, difficulty);
    }
    state.platforms = state.platforms.filter((platform) => platform.y >= 0 && platform.y < GAME_HEIGHT);
    state.pickups = state.pickups.filter((pickup) => pickup.y >= -5 && pickup.y < GAME_HEIGHT);
}

function spawnMonster(state, difficulty) {
    const id = state.nextMonsterId++;
    const direction = nextRandom(state) < 0.5 ? -1 : 1;
    const baseY = rounded(8 + nextRandom(state) * 5);
    const lifetime = Math.round((12 - difficulty * 1.5) * TICK_RATE);
    state.monsters.push({
        id,
        kind: evolvedMonsterKind(id, state.distance),
        x: direction > 0 ? -MONSTER_WIDTH : 100,
        y: baseY,
        vx: direction,
        baseY,
        age: 0,
        lifetime,
        shotCooldown: Math.round(90 - difficulty * 30 + nextRandom(state) * 45),
    });
}

function evolvedMonsterKind(id, distance) {
    const slot = (id - 1) % 3;
    if (slot === 0) return distance >= 450 ? 'linear_algebra' : 'intro_algebra';
    if (slot === 1) return distance >= 600 ? 'differential' : 'intro_calculus';
    return distance >= 750 ? 'modern_physics' : 'classical_physics';
}

function spawnProjectile(state, monster, difficulty) {
    const originX = monster.x + MONSTER_WIDTH / 2;
    const originY = monster.y + MONSTER_HEIGHT / 2;
    const targetX = state.player.x + PLAYER_WIDTH / 2;
    const targetY = state.player.y + PLAYER_WIDTH / 2;
    const deltaX = targetX - originX;
    const deltaY = targetY - originY;
    const length = Math.max(1, Math.sqrt(deltaX * deltaX + deltaY * deltaY));
    const makeProjectile = () => ({
        id: state.nextProjectileId++,
        kind: monster.kind,
        glyph: '',
        x: rounded(originX),
        y: rounded(originY),
        baseX: rounded(originX),
        baseY: rounded(originY),
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

    if (monster.kind === 'modern_physics') {
        const directionX = deltaX / length;
        const directionY = deltaY / length;
        const speed = 26 + difficulty * 32;
        const projectile = makeProjectile();
        projectile.vx = rounded(directionX * speed);
        projectile.vy = rounded(directionY * speed);
        projectile.glyph = 'γ';
        projectile.variant = -1;
        projectile.splitAfter = 22;
        projectile.mirrorX = rounded(originX + projectile.vx * FIXED_DT * projectile.splitAfter);
        projectile.mirrorY = rounded(originY + projectile.vy * FIXED_DT * projectile.splitAfter);
        state.projectiles.push(projectile);
        return;
    }

    const projectile = makeProjectile();
    if (monster.kind === 'intro_calculus' || monster.kind === 'differential') {
        const speed = 22 + difficulty * 34;
        projectile.vx = rounded(deltaX / length * speed);
        projectile.vy = rounded(deltaY / length * speed);
        projectile.normalX = rounded(-deltaY / length);
        projectile.normalY = rounded(deltaX / length);
        projectile.waveAmplitude = rounded(3.5 + difficulty * 1.5);
        projectile.waveStep = rounded(0.14 + difficulty * 0.04);
        projectile.phase = rounded((projectile.id % 4) * Math.PI / 2);
        projectile.glyph = monster.kind === 'differential' ? '∫' : 'f';
    } else if (monster.kind === 'classical_physics') {
        const flightTime = 2.3 - difficulty * 0.65;
        projectile.vy = rounded(-(28 + difficulty * 20));
        projectile.gravity = rounded(2 * (deltaY - projectile.vy * flightTime) / (flightTime * flightTime));
        projectile.vx = rounded(deltaX / flightTime);
        projectile.glyph = '●';
    } else if (monster.kind === 'linear_algebra') {
        const speed = 23 + difficulty * 36;
        projectile.vx = rounded(deltaX / length * speed);
        projectile.vy = rounded(deltaY / length * speed);
        projectile.glyph = '1 0\n0 1';
    } else {
        const speed = 25 + difficulty * 34;
        projectile.vx = rounded(deltaX / length * speed);
        projectile.vy = rounded(deltaY / length * speed);
        projectile.glyph = ['p', 'q', 'r'][(projectile.id - 1) % 3];
    }
    state.projectiles.push(projectile);
}

function splitModernProjectile(state, source) {
    const length = Math.max(1, Math.sqrt(source.vx * source.vx + source.vy * source.vy));
    const directionX = source.vx / length;
    const directionY = source.vy / length;
    const speed = length * 1.15;
    return [-0.18, 0, 0.18].map((angle, variant) => {
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        return {
            ...source,
            id: state.nextProjectileId++,
            x: source.x,
            y: source.y,
            baseX: source.x,
            baseY: source.y,
            vx: rounded((directionX * cosine - directionY * sine) * speed),
            vy: rounded((directionX * sine + directionY * cosine) * speed),
            age: 0,
            reflectionsRemaining: 1,
            variant,
            trail: [],
            hit: false,
            splitAfter: 0,
            mirrorX: 0,
            mirrorY: 0,
        };
    });
}

function updateMonsters(state, difficulty) {
    if (state.tick >= state.nextMonsterTick && state.monsters.length === 0) {
        spawnMonster(state, difficulty);
        const spawned = state.monsters[0];
        const pause = Math.round((1.8 - difficulty * 0.5) * TICK_RATE);
        state.nextMonsterTick = state.tick + spawned.lifetime + pause;
    }

    for (const monster of state.monsters) {
        monster.age += 1;
        const progress = Math.min(1, monster.age / monster.lifetime);
        const entranceEnd = 0.18;
        const orbitEnd = 0.82;
        const centerX = (100 - MONSTER_WIDTH) / 2;
        const orbitStartX = centerX - monster.vx * 12;
        if (progress < entranceEnd) {
            const entranceProgress = progress / entranceEnd;
            const startX = monster.vx > 0 ? -MONSTER_WIDTH : 100;
            monster.x = rounded(startX + (orbitStartX - startX) * entranceProgress);
            monster.y = monster.baseY;
        } else if (progress < orbitEnd) {
            const orbitProgress = (progress - entranceEnd) / (orbitEnd - entranceEnd);
            const startAngle = monster.vx > 0 ? Math.PI : 0;
            const angle = startAngle + monster.vx * orbitProgress * Math.PI * 8;
            monster.x = rounded(centerX + Math.cos(angle) * 12);
            monster.y = rounded(monster.baseY + Math.sin(angle) * 5);
        } else {
            const exitProgress = (progress - orbitEnd) / (1 - orbitEnd);
            const endX = monster.vx > 0 ? 100 : -MONSTER_WIDTH;
            monster.x = rounded(orbitStartX + (endX - orbitStartX) * exitProgress);
            monster.y = monster.baseY;
        }

        const visible = monster.x > -MONSTER_WIDTH && monster.x < 100;
        if (visible) monster.shotCooldown -= 1;
        if (visible && monster.shotCooldown <= 0) {
            spawnProjectile(state, monster, difficulty);
            monster.shotCooldown = Math.max(42, Math.round(180 - difficulty * 95 + nextRandom(state) * 35));
        }
    }
    state.monsters = state.monsters.filter((monster) => monster.age < monster.lifetime);
}

function updateProjectiles(state) {
    const hitsPlayer = (x, y, size = 2.5) => (
        x + size > state.player.x + PLAYER_HITBOX_INSET
        && x < state.player.x + PLAYER_WIDTH - PLAYER_HITBOX_INSET
        && y + size > state.player.y + PLAYER_HITBOX_INSET
        && y < state.player.y + PLAYER_WIDTH - PLAYER_HITBOX_INSET
    );

    const spawnedProjectiles = [];
    for (const projectile of state.projectiles) {
        if (projectile.kind === 'intro_calculus' || projectile.kind === 'differential') {
            const nextWave = Math.sin((projectile.age + 1) * projectile.waveStep + projectile.phase)
                * projectile.waveAmplitude;
            projectile.baseX = rounded(projectile.baseX + projectile.vx * FIXED_DT);
            projectile.baseY = rounded(projectile.baseY + projectile.vy * FIXED_DT);
            projectile.x = rounded(projectile.baseX + projectile.normalX * nextWave);
            projectile.y = rounded(projectile.baseY + projectile.normalY * nextWave);
            if (projectile.kind === 'differential' && projectile.age % 2 === 0) {
                projectile.trail.push({
                    x: projectile.x,
                    y: projectile.y,
                    baseX: projectile.baseX,
                    baseY: projectile.baseY,
                });
                if (projectile.trail.length > 30) projectile.trail.shift();
            }
        } else if (projectile.kind === 'classical_physics') {
            projectile.vy = rounded(projectile.vy + projectile.gravity * FIXED_DT);
            projectile.x = rounded(projectile.x + projectile.vx * FIXED_DT);
            projectile.y = rounded(projectile.y + projectile.vy * FIXED_DT);
            projectile.baseX = projectile.x;
            projectile.baseY = projectile.y;
        } else {
            projectile.x = rounded(projectile.x + projectile.vx * FIXED_DT);
            projectile.y = rounded(projectile.y + projectile.vy * FIXED_DT);
            projectile.baseX = projectile.x;
            projectile.baseY = projectile.y;
            if (projectile.kind === 'modern_physics') {
                if (projectile.x < 0 || projectile.x > 97) {
                    projectile.x = Math.max(0, Math.min(97, projectile.x));
                    projectile.baseX = projectile.x;
                    if (projectile.reflectionsRemaining > 0) {
                        projectile.vx = rounded(-projectile.vx);
                        projectile.reflectionsRemaining -= 1;
                    } else {
                        projectile.hit = true;
                    }
                }
            }
        }
        projectile.age += 1;
        if (
            projectile.kind === 'modern_physics'
            && projectile.variant === -1
            && projectile.age >= projectile.splitAfter
        ) {
            projectile.hit = true;
            spawnedProjectiles.push(...splitModernProjectile(state, projectile));
            continue;
        }

        let collision = hitsPlayer(projectile.x, projectile.y, projectile.kind === 'linear_algebra' ? 5 : 2.5);
        if (!collision && projectile.kind === 'differential') {
            collision = projectile.trail.some((point) => [0, 0.33, 0.66, 1].some((ratio) => (
                hitsPlayer(
                    point.baseX + (point.x - point.baseX) * ratio,
                    point.baseY + (point.y - point.baseY) * ratio,
                    2.2,
                )
            )));
        }
        if (collision && state.invulnerabilityTicks <= 0) {
            state.hits += 1;
            state.lives -= 1;
            state.invulnerabilityTicks = 60;
            projectile.hit = true;
            if (state.lives <= 0) {
                state.finished = true;
                state.deathReason = 'projectile';
            }
        }
    }
    state.projectiles.push(...spawnedProjectiles);
    state.projectiles = state.projectiles.filter((projectile) => (
        !projectile.hit
        && projectile.x > -5
        && projectile.x < 105
        && projectile.y > -8
        && projectile.y < GAME_HEIGHT + 5
    ));
}

function updatePickups(state) {
    state.pickups = state.pickups.filter((pickup) => {
        const collision = (
            pickup.x + 5 > state.player.x
            && pickup.x < state.player.x + PLAYER_WIDTH
            && pickup.y + 5 > state.player.y
            && pickup.y < state.player.y + PLAYER_WIDTH
        );
        if (!collision) return true;
        if (pickup.kind === 'life') state.lives += 1;
        else state.invulnerabilityTicks = Math.max(state.invulnerabilityTicks, TICK_RATE * 10);
        return false;
    });
}

function stepNikitaState(state, direction) {
    if (state.finished) return state;
    if (state.invulnerabilityTicks > 0) state.invulnerabilityTicks -= 1;
    const safeDirection = direction === -1 || direction === 1 ? direction : 0;
    const difficulty = difficultyFor(state);

    const previous = state.player;
    let x = previous.x + safeDirection * (56 + difficulty * 8) * FIXED_DT;
    if (x < -PLAYER_WIDTH) x = 100;
    if (x > 100) x = -PLAYER_WIDTH;

    let vy = previous.vy + 96 * FIXED_DT;
    let y = previous.y + vy * FIXED_DT;
    const previousBottom = previous.y + PLAYER_WIDTH;
    const nextBottom = y + PLAYER_WIDTH;

    if (vy > 0) {
        const landing = state.platforms.find((platform) => (
            previousBottom <= platform.y + 1
            && nextBottom >= platform.y
            && x + PLAYER_WIDTH > platform.x
            && x < platform.x + platform.width
        ));
        if (landing) {
            y = landing.y - PLAYER_WIDTH;
            vy = -78;
            landing.remainingBounces -= 1;
            if (landing.remainingBounces <= 0) {
                state.platforms = state.platforms.filter((platform) => platform.id !== landing.id);
                state.lastLandedPlatformId = null;
            } else {
                state.lastLandedPlatformId = landing.id;
            }
        }
    }

    if (y < CAMERA_ANCHOR_Y && vy < 0) {
        let shift = CAMERA_ANCHOR_Y - y;
        const lastLanded = state.platforms.find((platform) => platform.id === state.lastLandedPlatformId);
        if (lastLanded) shift = Math.min(shift, Math.max(0, GAME_HEIGHT - 7 - lastLanded.y));
        y += shift;
        shiftWorld(state, shift);
    }

    state.player = { x: rounded(x), y: rounded(y), vy: rounded(vy) };
    fillPlatforms(state, difficultyFor(state));
    updateMonsters(state, combatDifficultyFor(state));
    updatePickups(state);
    updateProjectiles(state);
    state.score = Math.max(state.score, Math.floor(state.distance * 10));
    state.tick += 1;

    if (!state.finished && y > GAME_HEIGHT + 4) {
        state.finished = true;
        state.deathReason = 'fall';
    }
    if (!state.finished && state.tick >= MAX_TICKS) {
        state.finished = true;
        state.deathReason = 'timeout';
    }
    return state;
}

function sanitizeReplay(replay, ticks) {
    const safeTicks = Number(ticks);
    if (!Number.isInteger(safeTicks) || safeTicks < 1 || safeTicks > MAX_TICKS) return null;
    if (!Array.isArray(replay) || replay.length > MAX_REPLAY_EVENTS) return null;

    let previousTick = -1;
    const clean = [];
    for (const event of replay) {
        if (!event || !Number.isInteger(event.t) || event.t < 0 || event.t >= safeTicks) return null;
        if (event.t <= previousTick) return null;
        if (event.d !== -1 && event.d !== 0 && event.d !== 1) return null;
        clean.push({ t: event.t, d: event.d });
        previousTick = event.t;
    }
    return { ticks: safeTicks, replay: clean };
}

function simulateNikitaReplay(seed, ticks, replay) {
    const clean = sanitizeReplay(replay, ticks);
    if (!clean) return null;
    const state = createNikitaState(seed);
    let direction = 0;
    let eventIndex = 0;
    while (state.tick < clean.ticks && !state.finished) {
        if (eventIndex < clean.replay.length && clean.replay[eventIndex].t === state.tick) {
            direction = clean.replay[eventIndex].d;
            eventIndex += 1;
        }
        stepNikitaState(state, direction);
    }
    return state;
}

module.exports = {
    TICK_RATE,
    MAX_TICKS,
    MAX_REPLAY_EVENTS,
    GAME_HEIGHT,
    PLAYER_WIDTH,
    CAMERA_ANCHOR_Y,
    initialPlatforms,
    createNikitaState,
    stepNikitaState,
    sanitizeReplay,
    simulateNikitaReplay,
};
