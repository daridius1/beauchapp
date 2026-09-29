export const NIKITA_TICK_RATE = 60;
export const NIKITA_MAX_TICKS = NIKITA_TICK_RATE * 60 * 10;
export const NIKITA_GAME_HEIGHT = 140;
export const NIKITA_PLAYER_WIDTH = 12;
export const NIKITA_PLAYER_HITBOX_INSET = 2;
export const NIKITA_MONSTER_WIDTH = 22;
const NIKITA_MONSTER_HEIGHT = 17;
export const NIKITA_CAMERA_ANCHOR_Y = 100;
const FIXED_DT = 1 / NIKITA_TICK_RATE;

// La curva n log n premia llegar más lejos sin dispararse como una cuadrática.
export const nikitaScoreForDistance = (distance: number): number => {
  const safeDistance = Math.max(0, Number(distance) || 0);
  return Math.floor(safeDistance * Math.log(safeDistance + 1) / Math.LN2);
};

export type NikitaDirection = -1 | 0 | 1;
export type NikitaReplayEvent = { t: number; d: NikitaDirection };
export type NikitaPlatform = { id: number; x: number; y: number; width: number; remainingBounces: number };
export type NikitaPlayer = { x: number; y: number; vy: number };
export type NikitaPickup = { id: number; kind: 'life' | 'immunity'; x: number; y: number };
export type NikitaMonsterKind =
  | 'intro_algebra'
  | 'linear_algebra'
  | 'intro_calculus'
  | 'differential'
  | 'classical_physics'
  | 'modern_physics';
export type NikitaMonster = {
  id: number;
  kind: NikitaMonsterKind;
  x: number;
  y: number;
  vx: number;
  baseY: number;
  age: number;
  lifetime: number;
  shotCooldown: number;
};
export type NikitaProjectile = {
  id: number;
  kind: NikitaMonsterKind;
  glyph: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  age: number;
  phase: number;
  normalX: number;
  normalY: number;
  waveAmplitude: number;
  waveStep: number;
  gravity: number;
  reflectionsRemaining: number;
  variant: number;
  trail: Array<{ x: number; y: number; baseX: number; baseY: number }>;
  hit: boolean;
  splitAfter: number;
  mirrorX: number;
  mirrorY: number;
};
export type NikitaDeathReason = 'projectile' | 'fall' | 'timeout' | null;
export interface NikitaGameState {
  player: NikitaPlayer;
  platforms: NikitaPlatform[];
  monsters: NikitaMonster[];
  projectiles: NikitaProjectile[];
  pickups: NikitaPickup[];
  lives: number;
  hits: number;
  invulnerabilityTicks: number;
  score: number;
  distance: number;
  tick: number;
  nextPlatformId: number;
  lastLandedPlatformId: number | null;
  nextMonsterId: number;
  nextProjectileId: number;
  nextPickupId: number;
  nextMonsterTick: number;
  rngState: number;
  finished: boolean;
  deathReason: NikitaDeathReason;
}

export const initialNikitaPlatforms = (): NikitaPlatform[] => [
  { id: 1, x: 34, y: 130, width: 32, remainingBounces: 3 },
  { id: 2, x: 12, y: 106, width: 24, remainingBounces: 3 },
  { id: 3, x: 57, y: 82, width: 24, remainingBounces: 3 },
  { id: 4, x: 25, y: 58, width: 23, remainingBounces: 3 },
  { id: 5, x: 64, y: 34, width: 22, remainingBounces: 3 },
  { id: 6, x: 16, y: 10, width: 22, remainingBounces: 3 },
];

export const createNikitaState = (seed: number): NikitaGameState => ({
  player: { x: 44, y: 112, vy: -78 },
  platforms: initialNikitaPlatforms(),
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
  rngState: seed >>> 0,
  finished: false,
  deathReason: null,
});

const nextRandom = (state: NikitaGameState): number => {
  state.rngState = (state.rngState + 0x6D2B79F5) >>> 0;
  let value = state.rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

const rounded = (value: number): number => Math.round(value * 1000000) / 1000000;
const difficultyFor = (state: NikitaGameState): number => Math.min(1, state.distance / 650);
const combatDifficultyFor = (state: NikitaGameState): number => Math.min(1.35, state.distance / 800);

const shiftWorld = (state: NikitaGameState, shift: number): void => {
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
};

const platformBounces = (state: NikitaGameState, difficulty: number): number => {
  const roll = nextRandom(state);
  const oneBounceChance = 0.45 * difficulty * difficulty;
  const twoBounceChance = 0.65 * difficulty;
  if (roll < oneBounceChance) return 1;
  if (roll < oneBounceChance + twoBounceChance) return 2;
  return 3;
};

const pickupRoll = (state: NikitaGameState, platformId: number): number => {
  let value = (state.rngState ^ Math.imul(platformId, 0x9E3779B1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21F0AAAD);
  value = Math.imul(value ^ (value >>> 15), 0x735A2D97);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
};

const maybeSpawnPickup = (
  state: NikitaGameState,
  platform: NikitaPlatform,
  difficulty: number,
): void => {
  const roll = pickupRoll(state, platform.id);
  const appearanceChance = 0.22 - difficulty * 0.16;
  if (roll >= appearanceChance) return;
  state.pickups.push({
    id: state.nextPickupId++,
    kind: roll / appearanceChance < 0.55 ? 'life' : 'immunity',
    x: rounded(platform.x + platform.width / 2 - 2.5),
    y: rounded(platform.y - 7),
  });
};

const fillPlatforms = (state: NikitaGameState, difficulty: number): void => {
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
  state.platforms = state.platforms.filter((platform) => (
    platform.y >= 0 && platform.y < NIKITA_GAME_HEIGHT
  ));
  state.pickups = state.pickups.filter((pickup) => pickup.y >= -5 && pickup.y < NIKITA_GAME_HEIGHT);
};

const spawnMonster = (state: NikitaGameState, difficulty: number): void => {
  const id = state.nextMonsterId++;
  const direction = nextRandom(state) < 0.5 ? -1 : 1;
  const baseY = rounded(8 + nextRandom(state) * 5);
  const lifetime = Math.round((12 - difficulty * 1.5) * NIKITA_TICK_RATE);
  state.monsters.push({
    id,
    kind: evolvedMonsterKind(id, state.distance),
    x: direction > 0 ? -NIKITA_MONSTER_WIDTH : 100,
    y: baseY,
    vx: direction,
    baseY,
    age: 0,
    lifetime,
    shotCooldown: Math.round(90 - difficulty * 30 + nextRandom(state) * 45),
  });
};

const evolvedMonsterKind = (id: number, distance: number): NikitaMonsterKind => {
  const slot = (id - 1) % 3;
  if (slot === 0) return distance >= 450 ? 'linear_algebra' : 'intro_algebra';
  if (slot === 1) return distance >= 600 ? 'differential' : 'intro_calculus';
  return distance >= 750 ? 'modern_physics' : 'classical_physics';
};

const spawnProjectile = (
  state: NikitaGameState,
  monster: NikitaMonster,
  difficulty: number,
): void => {
  const originX = monster.x + NIKITA_MONSTER_WIDTH / 2;
  const originY = monster.y + NIKITA_MONSTER_HEIGHT / 2;
  const targetX = state.player.x + NIKITA_PLAYER_WIDTH / 2;
  const targetY = state.player.y + NIKITA_PLAYER_WIDTH / 2;
  const deltaX = targetX - originX;
  const deltaY = targetY - originY;
  const length = Math.max(1, Math.sqrt(deltaX * deltaX + deltaY * deltaY));
  const makeProjectile = (): NikitaProjectile => ({
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
};

const splitModernProjectile = (
  state: NikitaGameState,
  source: NikitaProjectile,
): NikitaProjectile[] => {
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
};

const updateMonsters = (state: NikitaGameState, difficulty: number): void => {
  if (state.tick >= state.nextMonsterTick && state.monsters.length === 0) {
    spawnMonster(state, difficulty);
    const spawned = state.monsters[0];
    const pause = Math.round((1.8 - difficulty * 0.5) * NIKITA_TICK_RATE);
    state.nextMonsterTick = state.tick + spawned.lifetime + pause;
  }

  for (const monster of state.monsters) {
    monster.age += 1;
    const progress = Math.min(1, monster.age / monster.lifetime);
    const entranceEnd = 0.18;
    const orbitEnd = 0.82;
    const centerX = (100 - NIKITA_MONSTER_WIDTH) / 2;
    const orbitStartX = centerX - monster.vx * 12;
    if (progress < entranceEnd) {
      const entranceProgress = progress / entranceEnd;
      const startX = monster.vx > 0 ? -NIKITA_MONSTER_WIDTH : 100;
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
      const endX = monster.vx > 0 ? 100 : -NIKITA_MONSTER_WIDTH;
      monster.x = rounded(orbitStartX + (endX - orbitStartX) * exitProgress);
      monster.y = monster.baseY;
    }

    const visible = monster.x > -NIKITA_MONSTER_WIDTH && monster.x < 100;
    if (visible) monster.shotCooldown -= 1;
    if (visible && monster.shotCooldown <= 0) {
      spawnProjectile(state, monster, difficulty);
      monster.shotCooldown = Math.max(42, Math.round(180 - difficulty * 95 + nextRandom(state) * 35));
    }
  }
  state.monsters = state.monsters.filter((monster) => monster.age < monster.lifetime);
};

const updateProjectiles = (state: NikitaGameState): void => {
  const hitsPlayer = (x: number, y: number, size = 2.5): boolean => (
    x + size > state.player.x + NIKITA_PLAYER_HITBOX_INSET
    && x < state.player.x + NIKITA_PLAYER_WIDTH - NIKITA_PLAYER_HITBOX_INSET
    && y + size > state.player.y + NIKITA_PLAYER_HITBOX_INSET
    && y < state.player.y + NIKITA_PLAYER_WIDTH - NIKITA_PLAYER_HITBOX_INSET
  );

  const spawnedProjectiles: NikitaProjectile[] = [];
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
      if (projectile.kind === 'modern_physics' && (projectile.x < 0 || projectile.x > 97)) {
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

    let collision = hitsPlayer(
      projectile.x,
      projectile.y,
      projectile.kind === 'linear_algebra' ? 5 : 2.5,
    );
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
    && projectile.y < NIKITA_GAME_HEIGHT + 5
  ));
};

const updatePickups = (state: NikitaGameState): void => {
  state.pickups = state.pickups.filter((pickup) => {
    const collision = (
      pickup.x + 5 > state.player.x
      && pickup.x < state.player.x + NIKITA_PLAYER_WIDTH
      && pickup.y + 5 > state.player.y
      && pickup.y < state.player.y + NIKITA_PLAYER_WIDTH
    );
    if (!collision) return true;
    if (pickup.kind === 'life') state.lives += 1;
    else state.invulnerabilityTicks = Math.max(state.invulnerabilityTicks, NIKITA_TICK_RATE * 10);
    return false;
  });
};

export const stepNikitaState = (state: NikitaGameState, direction: NikitaDirection): NikitaGameState => {
  if (state.finished) return state;
  if (state.invulnerabilityTicks > 0) state.invulnerabilityTicks -= 1;
  const difficulty = difficultyFor(state);

  const previous = state.player;
  let x = previous.x + direction * (56 + difficulty * 8) * FIXED_DT;
  if (x < -NIKITA_PLAYER_WIDTH) x = 100;
  if (x > 100) x = -NIKITA_PLAYER_WIDTH;

  let vy = previous.vy + 96 * FIXED_DT;
  let y = previous.y + vy * FIXED_DT;
  const previousBottom = previous.y + NIKITA_PLAYER_WIDTH;
  const nextBottom = y + NIKITA_PLAYER_WIDTH;

  if (vy > 0) {
    const landing = state.platforms.find((platform) => (
      previousBottom <= platform.y + 1
      && nextBottom >= platform.y
      && x + NIKITA_PLAYER_WIDTH > platform.x
      && x < platform.x + platform.width
    ));
    if (landing) {
      y = landing.y - NIKITA_PLAYER_WIDTH;
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

  if (y < NIKITA_CAMERA_ANCHOR_Y && vy < 0) {
    let shift = NIKITA_CAMERA_ANCHOR_Y - y;
    const lastLanded = state.platforms.find((platform) => platform.id === state.lastLandedPlatformId);
    if (lastLanded) {
      shift = Math.min(shift, Math.max(0, NIKITA_GAME_HEIGHT - 7 - lastLanded.y));
    }
    y += shift;
    shiftWorld(state, shift);
  }

  state.player = { x: rounded(x), y: rounded(y), vy: rounded(vy) };
  fillPlatforms(state, difficultyFor(state));
  updateMonsters(state, combatDifficultyFor(state));
  updatePickups(state);
  updateProjectiles(state);
  state.score = Math.max(state.score, nikitaScoreForDistance(state.distance));
  state.tick += 1;

  if (!state.finished && y > NIKITA_GAME_HEIGHT + 4) {
    state.finished = true;
    state.deathReason = 'fall';
  }
  if (!state.finished && state.tick >= NIKITA_MAX_TICKS) {
    state.finished = true;
    state.deathReason = 'timeout';
  }
  return state;
};
