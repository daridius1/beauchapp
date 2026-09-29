import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, Polygon, Polyline } from 'react-native-svg';
import { AllianceId } from '../constants/alliances';
import { AllianceNameText } from '../components/AllianceNameText';
import {
  NIKITA_SKINS,
  NIKITA_SKIN_PRICE,
  NIKITA_VANILLA_SKIN,
  nikitaSkinById,
} from '../constants/nikitaSkins';
import { AllianceScoreRow, allianceService, NikitaRunToken } from '../services/allianceService';
import { theme } from '../theme/theme';
import { withMinimumDelay } from '../utils/refresh';
import {
  createNikitaState,
  NikitaDirection,
  NikitaGameState,
  NikitaMonster,
  NikitaMonsterKind,
  NikitaPickup,
  NikitaPlatform,
  NikitaPlayer,
  NikitaProjectile,
  NikitaReplayEvent,
  NIKITA_GAME_HEIGHT,
  NIKITA_MONSTER_WIDTH,
  NIKITA_PLAYER_WIDTH,
  NIKITA_TICK_RATE,
  stepNikitaState,
} from '../utils/nikitaJump';

const NIKITA_MUSIC = require('../../assets/audio/nikita-music.mp3');
const NIKITA_JUMP_SOUND = require('../../assets/audio/nikita-jump.wav');
const NIKITA_SHOT_SOUND = require('../../assets/audio/nikita-shot.wav');
const NIKITA_BACKGROUND = require('../../assets/nikita-jump/beauchef-background.jpg');

const ALLIANCE_COLORS: Record<AllianceId, string> = {
  urbana: '#f59e0b',
  pop: '#ec4899',
  gotico: '#a78bfa',
  hiphop: '#22c55e',
  punk: '#ef4444',
  rock: '#38bdf8',
};

const errorMessage = (error: any, fallback: string) => error?.response?.error || error?.message || fallback;
const platformColor = (remainingBounces: number) => {
  if (remainingBounces >= 3) return '#4ade80';
  if (remainingBounces === 2) return '#facc15';
  return '#fb7185';
};
const MONSTER_THEME: Record<NikitaMonsterKind, {
  background: string;
  border: string;
  code: string;
  credits: string;
  name: string;
  prerequisite: string;
}> = {
  intro_algebra: {
    background: '#cfe8f7',
    border: '#17202a',
    code: 'MA1101',
    credits: '6',
    name: 'Introducción al\nÁlgebra',
    prerequisite: 'Sin requisitos',
  },
  linear_algebra: {
    background: '#cfe8f7',
    border: '#17202a',
    code: 'MA1102',
    credits: '6',
    name: 'Álgebra\nLineal',
    prerequisite: 'MA1101',
  },
  intro_calculus: {
    background: '#cfe8f7',
    border: '#17202a',
    code: 'MA1001',
    credits: '6',
    name: 'Introducción al\nCálculo',
    prerequisite: 'Sin requisitos',
  },
  differential: {
    background: '#cfe8f7',
    border: '#17202a',
    code: 'MA1002',
    credits: '6',
    name: 'Cálculo Diferencial\ne Integral',
    prerequisite: 'MA1001',
  },
  classical_physics: {
    background: '#ffb4ad',
    border: '#17202a',
    code: 'FI1000',
    credits: '6',
    name: 'Introducción a la\nFísica Clásica',
    prerequisite: 'Sin requisitos',
  },
  modern_physics: {
    background: '#ffb4ad',
    border: '#17202a',
    code: 'FI1100',
    credits: '6',
    name: 'Introducción a la\nFísica Moderna',
    prerequisite: 'FI1000, MA1101, MA1001',
  },
};
const projectileColor = (projectile: NikitaProjectile) => {
  if (projectile.kind === 'modern_physics') {
    if (projectile.variant < 0) return '#ffffff';
    return ['#f472b6', '#fde047', '#38bdf8'][projectile.variant];
  }
  if (projectile.kind === 'intro_calculus' || projectile.kind === 'differential') return '#22d3ee';
  if (projectile.kind === 'classical_physics') return '#fb923c';
  if (projectile.kind === 'linear_algebra') return '#a78bfa';
  return '#c4b5fd';
};
const projectileSize = (kind: NikitaMonsterKind) => {
  if (kind === 'linear_algebra') return '13%';
  if (kind === 'intro_algebra') return '5%';
  return '4%';
};

const OpticalLens: React.FC<{ projectile: NikitaProjectile }> = ({ projectile }) => {
  const angle = Math.atan2(projectile.vy, projectile.vx) * 180 / Math.PI;
  return (
    <Svg
      pointerEvents="none"
      style={[
        styles.opticalLens,
        {
          left: `${projectile.mirrorX - 3.5}%`,
          top: `${(projectile.mirrorY / NIKITA_GAME_HEIGHT) * 100 - 5}%`,
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
      viewBox="0 0 20 34"
    >
      <Path
        d="M 5 2 Q 16 17 5 32"
        fill="none"
        stroke="#e0f2fe"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
};

const CalculusAreaTrail: React.FC<{ projectile: NikitaProjectile }> = ({ projectile }) => {
  const samples = [
    ...projectile.trail,
    { x: projectile.x, y: projectile.y, baseX: projectile.baseX, baseY: projectile.baseY },
  ];
  if (samples.length < 3) return null;
  const curve = samples.map((point) => `${point.x},${point.y}`);
  const baseline = samples.map((point) => `${point.baseX},${point.baseY}`);
  const area = [...curve, ...baseline.slice().reverse()].join(' ');

  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFillObject}
      width="100%"
      height="100%"
      viewBox={`0 0 100 ${NIKITA_GAME_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <Polygon points={area} fill="#22d3ee" fillOpacity={0.22} />
      <Polyline points={baseline.join(' ')} fill="none" stroke="#67e8f9" strokeOpacity={0.65} strokeWidth={0.45} />
      <Polyline points={curve.join(' ')} fill="none" stroke="#22d3ee" strokeOpacity={0.95} strokeWidth={0.8} />
    </Svg>
  );
};

export const NikitaJumpScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [myAlliance, setMyAlliance] = useState<AllianceId | null>(null);
  const [highScore, setHighScore] = useState(0);
  const [beautokens, setBeautokens] = useState(0);
  const [ownedSkins, setOwnedSkins] = useState<string[]>([]);
  const [selectedSkin, setSelectedSkin] = useState('');
  const [skinBusy, setSkinBusy] = useState<string | null>(null);
  const [lastReward, setLastReward] = useState<number | null>(null);
  const [scoreboard, setScoreboard] = useState<AllianceScoreRow[]>([]);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [effectsMuted, setEffectsMuted] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const initialGameState = useRef(createNikitaState(0));
  const [lives, setLives] = useState(initialGameState.current.lives);
  const [invulnerabilityTicks, setInvulnerabilityTicks] = useState(0);
  const [player, setPlayer] = useState<NikitaPlayer>(initialGameState.current.player);
  const [platforms, setPlatforms] = useState<NikitaPlatform[]>(initialGameState.current.platforms);
  const [monsters, setMonsters] = useState<NikitaMonster[]>(initialGameState.current.monsters);
  const [projectiles, setProjectiles] = useState<NikitaProjectile[]>(initialGameState.current.projectiles);
  const [pickups, setPickups] = useState<NikitaPickup[]>(initialGameState.current.pickups);

  const musicPlayer = useAudioPlayer(NIKITA_MUSIC);
  const jumpPlayer = useAudioPlayer(NIKITA_JUMP_SOUND);
  const shotPlayer = useAudioPlayer(NIKITA_SHOT_SOUND);

  const directionRef = useRef<NikitaDirection>(0);
  const gameStateRef = useRef<NikitaGameState>(initialGameState.current);
  const replayRef = useRef<NikitaReplayEvent[]>([]);
  const runTokenRef = useRef<NikitaRunToken | null>(null);
  const scoreRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);
  const runningRef = useRef(false);
  const highScoreRef = useRef(0);
  const gameBoardWidthRef = useRef(0);

  useEffect(() => {
    musicPlayer.loop = true;
    musicPlayer.volume = 0.3;
    jumpPlayer.volume = 0.5;
    shotPlayer.volume = 0.38;

    return () => {
      // En web los reproductores pueden seguir vivos un instante al cambiar de pantalla.
      musicPlayer.pause();
      jumpPlayer.pause();
      shotPlayer.pause();
    };
  }, [jumpPlayer, musicPlayer, shotPlayer]);

  useEffect(() => {
    musicPlayer.muted = musicMuted;
  }, [musicMuted, musicPlayer]);

  useEffect(() => {
    jumpPlayer.muted = effectsMuted;
    shotPlayer.muted = effectsMuted;
  }, [effectsMuted, jumpPlayer, shotPlayer]);

  useEffect(() => { highScoreRef.current = highScore; }, [highScore]);

  const loadState = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const state = await withMinimumDelay(() => allianceService.getNikitaJump(), showLoader ? 400 : 0);
      setMyAlliance(state.myAlliance);
      setHighScore(state.myHighScore);
      setBeautokens(state.beautokens);
      setOwnedSkins(state.ownedSkins);
      setSelectedSkin(state.selectedSkin);
      setScoreboard(state.scoreboard);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo cargar Nikita Jump.'));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
    const subscription = DeviceEventEmitter.addListener('onGlobalRefresh', () => loadState(true));
    return () => subscription.remove();
  }, [loadState]);

  const changeDirection = useCallback((direction: NikitaDirection) => {
    if (directionRef.current === direction) return;
    directionRef.current = direction;
    if (!runningRef.current) return;
    const tick = gameStateRef.current.tick;
    const replay = replayRef.current;
    const last = replay[replay.length - 1];
    if (last?.t === tick) last.d = direction;
    else replay.push({ t: tick, d: direction });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (runningRef.current && ['ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') changeDirection(-1);
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') changeDirection(1);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (['arrowleft', 'arrowright', 'a', 'd'].includes(event.key.toLowerCase())) changeDirection(0);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [changeDirection]);

  const finishGame = useCallback(async () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    musicPlayer.pause();
    setRunning(false);
    setPaused(false);
    setGameOver(true);
    // La partida ya terminó: no registrar un cambio en tick === ticks, porque quedaría
    // fuera del rango del replay. Solo dejamos el control listo para la próxima.
    directionRef.current = 0;
    const finalScore = scoreRef.current;
    const gameState = gameStateRef.current;
    const runToken = runTokenRef.current;
    if (!runToken) return;
    try {
      const result = await allianceService.submitNikitaRun(
        runToken,
        gameState.tick,
        replayRef.current,
        finalScore,
      );
      setHighScore(result.highScore);
      highScoreRef.current = result.highScore;
      setBeautokens(result.beautokens);
      setLastReward(result.reward);
      const state = await allianceService.getNikitaJump();
      setScoreboard(state.scoreboard);
    } catch (err) {
      setError(errorMessage(err, 'Tu partida terminó, pero no pudimos guardar el puntaje.'));
    }
  }, [musicPlayer]);

  useEffect(() => {
    if (!running || paused) return;
    runningRef.current = true;
    lastFrameRef.current = null;

    const frame = (timestamp: number) => {
      if (!runningRef.current) return;
      const previousTime = lastFrameRef.current ?? timestamp;
      const elapsed = Math.min((timestamp - previousTime) / 1000, 0.1);
      lastFrameRef.current = timestamp;
      accumulatorRef.current += elapsed;
      const fixedDt = 1 / NIKITA_TICK_RATE;
      const gameState = gameStateRef.current;
      let jumpedThisFrame = false;
      let firedThisFrame = false;
      while (accumulatorRef.current >= fixedDt && !gameState.finished) {
        const previousVerticalVelocity = gameState.player.vy;
        const previousProjectileId = gameState.nextProjectileId;
        stepNikitaState(gameState, directionRef.current);
        if (previousVerticalVelocity > 0 && gameState.player.vy < 0) jumpedThisFrame = true;
        if (gameState.nextProjectileId > previousProjectileId) firedThisFrame = true;
        accumulatorRef.current -= fixedDt;
      }

      if (jumpedThisFrame) {
        void jumpPlayer.seekTo(0).catch(() => undefined);
        jumpPlayer.play();
      }
      if (firedThisFrame) {
        void shotPlayer.seekTo(0).catch(() => undefined);
        shotPlayer.play();
      }

      scoreRef.current = gameState.score;
      setPlayer({ ...gameState.player });
      setPlatforms(gameState.platforms.map((platform) => ({ ...platform })));
      setMonsters(gameState.monsters.map((monster) => ({ ...monster })));
      setProjectiles(gameState.projectiles.map((projectile) => ({ ...projectile })));
      setPickups(gameState.pickups.map((pickup) => ({ ...pickup })));
      setScore(gameState.score);
      setLives(gameState.lives);
      setInvulnerabilityTicks(gameState.invulnerabilityTicks);

      if (gameState.finished) {
        finishGame();
        return;
      }
      animationRef.current = requestAnimationFrame(frame);
    };

    animationRef.current = requestAnimationFrame(frame);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [finishGame, jumpPlayer, paused, running, shotPlayer]);

  const startGame = async () => {
    if (!myAlliance || startingGame) return;
    // Se inicia dentro del gesto del botón para que los navegadores permitan el audio.
    void musicPlayer.seekTo(0).catch(() => undefined);
    if (!musicMuted) musicPlayer.play();
    setStartingGame(true);
    setError('');
    try {
      const token = await allianceService.startNikitaRun();
      const gameState = createNikitaState(token.seed);
      runTokenRef.current = token;
      replayRef.current = [];
      gameStateRef.current = gameState;
      scoreRef.current = 0;
      directionRef.current = 0;
      accumulatorRef.current = 0;
      setPlayer({ ...gameState.player });
      setPlatforms(gameState.platforms.map((platform) => ({ ...platform })));
      setMonsters([]);
      setProjectiles([]);
      setPickups([]);
      setScore(0);
      setLastReward(null);
      setLives(gameState.lives);
      setInvulnerabilityTicks(0);
      setGameOver(false);
      setPaused(false);
      setRunning(true);
    } catch (err) {
      musicPlayer.pause();
      setError(errorMessage(err, 'No se pudo iniciar la partida.'));
    } finally {
      setStartingGame(false);
    }
  };

  const togglePause = () => {
    if (!runningRef.current) return;
    if (paused) {
      if (!musicMuted) musicPlayer.play();
      setPaused(false);
      return;
    }
    changeDirection(0);
    musicPlayer.pause();
    setPaused(true);
  };

  const toggleMusic = () => {
    const nextMuted = !musicMuted;
    musicPlayer.muted = nextMuted;
    setMusicMuted(nextMuted);
    if (!nextMuted && runningRef.current && !paused) musicPlayer.play();
  };

  const toggleEffects = () => {
    const nextMuted = !effectsMuted;
    jumpPlayer.muted = nextMuted;
    shotPlayer.muted = nextMuted;
    setEffectsMuted(nextMuted);
  };

  const selectSkin = async (skinId: string) => {
    if (skinBusy !== null) return;
    setSkinBusy(skinId);
    setError('');
    try {
      if (!skinId || ownedSkins.includes(skinId)) {
        const result = await allianceService.equipNikitaSkin(skinId);
        setSelectedSkin(result.selectedSkin);
      } else {
        const result = await allianceService.purchaseNikitaSkin(skinId);
        setBeautokens(result.beautokens);
        setOwnedSkins((current) => current.includes(skinId) ? current : [...current, skinId]);
        setSelectedSkin(result.selectedSkin);
      }
    } catch (err) {
      setError(errorMessage(err, 'No se pudo actualizar la skin.'));
    } finally {
      setSkinBusy(null);
    }
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  const equippedSkin = nikitaSkinById(selectedSkin) || NIKITA_VANILLA_SKIN;
  const invulnerable = invulnerabilityTicks > 0;
  const shieldVisible = invulnerable && (
    invulnerabilityTicks > NIKITA_TICK_RATE * 3
    || Math.floor(invulnerabilityTicks / 12) % 2 === 0
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      scrollEnabled={!running}
      keyboardShouldPersistTaps="handled"
    >
      {!!error && <Text style={styles.error}>{error}</Text>}

      {!myAlliance ? (
        <View style={styles.selectionSection}>
          <Text style={styles.sectionTitle}>Primero elige tu alianza</Text>
          <Text style={styles.helpText}>
            La elección se hace en la pantalla principal de Alianzas y se usa en todos sus juegos.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.myScoreRow}>
            <View>
              <Text style={styles.metricLabel}>Aportas a</Text>
              <AllianceNameText alliance={myAlliance} style={[styles.metricValue, { color: ALLIANCE_COLORS[myAlliance] }]} />
            </View>
            <View style={styles.metricRight}>
              <Text style={styles.metricLabel}>Tu récord</Text>
              <Text style={styles.metricValue}>{highScore.toLocaleString('es-CL')}</Text>
            </View>
          </View>

          <View style={styles.gameShell}>
            <Pressable
              style={styles.gameBoard}
              onLayout={(event) => {
                gameBoardWidthRef.current = event.nativeEvent.layout.width;
              }}
              onPressIn={(event) => {
                if (!runningRef.current || gameBoardWidthRef.current <= 0) return;
                changeDirection(event.nativeEvent.locationX < gameBoardWidthRef.current / 2 ? -1 : 1);
              }}
              onPressOut={() => {
                if (runningRef.current) changeDirection(0);
              }}
            >
              <Image
                source={NIKITA_BACKGROUND}
                style={styles.gameBackground}
                resizeMode="cover"
                blurRadius={5}
              />
              <View pointerEvents="none" style={styles.gameBackgroundShade} />
              <View style={styles.arcadeHud} pointerEvents="none">
                <View>
                  <Text style={styles.arcadeLabel}>PUNTAJE</Text>
                  <Text style={styles.arcadeScore}>{score.toLocaleString('es-CL')}</Text>
                </View>
                <View style={styles.arcadeLivesBlock}>
                  <Text style={styles.arcadeLabel}>VIDAS</Text>
                  <Text style={styles.arcadeLives}>{lives > 0 ? '♥'.repeat(lives) : '—'}</Text>
                  {invulnerable && <Text style={styles.arcadePowerUp}>INMUNE</Text>}
                </View>
              </View>
              <View style={styles.gameControls}>
                <TouchableOpacity
                  accessibilityLabel={musicMuted ? 'Activar música' : 'Silenciar música'}
                  style={styles.gameControlButton}
                  onPressIn={(event) => event.stopPropagation()}
                  onPress={toggleMusic}
                  activeOpacity={0.75}
                >
                  <Feather name={musicMuted ? 'volume-x' : 'music'} size={16} color="#e0f2fe" />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel={effectsMuted ? 'Activar efectos' : 'Silenciar efectos'}
                  style={styles.gameControlButton}
                  onPressIn={(event) => event.stopPropagation()}
                  onPress={toggleEffects}
                  activeOpacity={0.75}
                >
                  <Feather name={effectsMuted ? 'volume-x' : 'volume-2'} size={16} color="#e0f2fe" />
                </TouchableOpacity>
                {running && (
                  <TouchableOpacity
                    accessibilityLabel={paused ? 'Continuar partida' : 'Pausar partida'}
                    style={styles.gameControlButton}
                    onPressIn={(event) => event.stopPropagation()}
                    onPress={togglePause}
                    activeOpacity={0.75}
                  >
                    <Feather name={paused ? 'play' : 'pause'} size={16} color="#e0f2fe" />
                  </TouchableOpacity>
                )}
              </View>
              {platforms.map((platform) => (
                <View
                  key={platform.id}
                  style={[
                    styles.platform,
                    {
                      left: `${platform.x}%`,
                      top: `${(platform.y / NIKITA_GAME_HEIGHT) * 100}%`,
                      width: `${platform.width}%`,
                      backgroundColor: platformColor(platform.remainingBounces),
                    },
                  ]}
                />
              ))}
              {pickups.map((pickup) => (
                <View
                  key={pickup.id}
                  style={[
                    styles.pickup,
                    pickup.kind === 'life' ? styles.lifePickup : styles.immunityPickup,
                    {
                      left: `${pickup.x}%`,
                      top: `${(pickup.y / NIKITA_GAME_HEIGHT) * 100}%`,
                    },
                  ]}
                >
                  {pickup.kind === 'life' ? (
                    <Text style={styles.lifePickupGlyph}>♥</Text>
                  ) : (
                    <Svg width="76%" height="76%" viewBox="0 0 24 24">
                      <Path
                        d="M12 2 L20 5 V11 C20 16.2 16.7 20.4 12 22 C7.3 20.4 4 16.2 4 11 V5 Z"
                        fill="rgba(34, 211, 238, 0.28)"
                        stroke="#ecfeff"
                        strokeWidth={2}
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}
                </View>
              ))}
              {monsters.map((monster) => (
                <View
                  key={monster.id}
                  style={[
                    styles.monster,
                    {
                      left: `${monster.x}%`,
                      top: `${(monster.y / NIKITA_GAME_HEIGHT) * 100}%`,
                      backgroundColor: MONSTER_THEME[monster.kind].background,
                      borderColor: MONSTER_THEME[monster.kind].border,
                    },
                  ]}
                >
                  <View style={styles.monsterHeader}>
                    <Text style={styles.monsterCode}>{MONSTER_THEME[monster.kind].code}</Text>
                    <Text style={styles.monsterCredits}>{MONSTER_THEME[monster.kind].credits}</Text>
                  </View>
                  <View style={styles.monsterNameArea}>
                    <Text style={styles.monsterName}>{MONSTER_THEME[monster.kind].name}</Text>
                  </View>
                  <View style={styles.monsterPrerequisiteArea}>
                    <Text style={styles.monsterPrerequisite}>{MONSTER_THEME[monster.kind].prerequisite}</Text>
                  </View>
                </View>
              ))}
              {projectiles.map((projectile) => (
                <React.Fragment key={projectile.id}>
                  {projectile.kind === 'differential' && <CalculusAreaTrail projectile={projectile} />}
                  {projectile.kind === 'modern_physics' && projectile.variant === -1 && (
                    <OpticalLens projectile={projectile} />
                  )}
                  <View
                    style={[
                      styles.projectile,
                      {
                        left: `${projectile.x}%`,
                        top: `${(projectile.y / NIKITA_GAME_HEIGHT) * 100}%`,
                        width: projectileSize(projectile.kind),
                        shadowColor: projectileColor(projectile),
                      },
                    ]}
                  >
                    {projectile.kind === 'linear_algebra' ? (
                      <View style={styles.matrixExpression}>
                        <Text style={[styles.matrixParenthesis, {
                          color: projectileColor(projectile),
                          textShadowColor: projectileColor(projectile),
                        }]}>(</Text>
                        <Text style={[styles.matrixValues, {
                          color: projectileColor(projectile),
                          textShadowColor: projectileColor(projectile),
                        }]}>{projectile.glyph}</Text>
                        <Text style={[styles.matrixParenthesis, {
                          color: projectileColor(projectile),
                          textShadowColor: projectileColor(projectile),
                        }]}>)</Text>
                      </View>
                    ) : (
                      <Text style={[
                        styles.projectileGlyph,
                        {
                          color: projectileColor(projectile),
                          textShadowColor: projectileColor(projectile),
                        },
                      ]}>
                        {projectile.glyph}
                      </Text>
                    )}
                  </View>
                </React.Fragment>
              ))}
              <View
                style={[
                  styles.player,
                  {
                    left: `${player.x}%`,
                    top: `${(player.y / NIKITA_GAME_HEIGHT) * 100}%`,
                    borderColor: 'transparent',
                    backgroundColor: 'transparent',
                  },
                ]}
              >
                {shieldVisible && (
                  <View pointerEvents="none" style={styles.playerShield} />
                )}
                <View style={[styles.playerHitboxGuide, { borderColor: ALLIANCE_COLORS[myAlliance] }]} />
                <Image source={equippedSkin.source} style={styles.playerSkin} resizeMode="contain" />
              </View>

              {running && paused && (
                <View style={styles.gameOverlay}>
                  <Text style={styles.overlayTitle}>Pausa</Text>
                  <TouchableOpacity style={styles.startButton} onPress={togglePause} activeOpacity={0.8}>
                    <Text style={styles.startButtonText}>Continuar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!running && (
                <View style={styles.gameOverlay}>
                  <Text style={styles.overlayTitle}>{gameOver ? 'Fin de la partida' : 'Nikita Jump'}</Text>
                  {gameOver && <Text style={styles.overlayScore}>{score.toLocaleString('es-CL')} puntos</Text>}
                  {gameOver && lastReward !== null && (
                    <Text style={styles.overlayReward}>
                      {lastReward > 0 ? `+${lastReward} ℬ` : 'Las recompensas comienzan en 500 puntos'}
                    </Text>
                  )}
                  <TouchableOpacity style={styles.startButton} onPress={startGame} activeOpacity={0.8} disabled={startingGame}>
                    {startingGame
                      ? <ActivityIndicator size="small" color="#000000" />
                      : <Text style={styles.startButtonText}>{gameOver ? 'Jugar otra vez' : 'Jugar'}</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.skinShop}>
            <View style={styles.skinShopHeader}>
              <View>
                <Text style={styles.sectionTitle}>Skins de Nikita</Text>
              </View>
              <Text style={styles.skinBalance}>{beautokens.toLocaleString('es-CL')} ℬ</Text>
            </View>
            <View style={styles.skinCategory}>
              <Text style={styles.skinCategoryTitle}>Base</Text>
              <View style={styles.skinGrid}>
                <View style={[styles.skinCard, !selectedSkin && styles.skinCardSelected]}>
                  <Image source={NIKITA_VANILLA_SKIN.source} style={styles.skinPreview} resizeMode="contain" />
                  <Text style={styles.skinName}>{NIKITA_VANILLA_SKIN.name}</Text>
                  <TouchableOpacity
                    style={[styles.skinButton, !selectedSkin && styles.skinButtonSelected]}
                    disabled={!selectedSkin || skinBusy !== null}
                    onPress={() => selectSkin('')}
                    activeOpacity={0.75}
                  >
                    {skinBusy === ''
                      ? <ActivityIndicator size="small" color="#07111f" />
                      : <Text style={styles.skinButtonText}>{!selectedSkin ? 'Equipada' : 'Usar'}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            {(['Grupos organizados', 'Especialidades'] as const).map((category) => (
              <View key={category} style={styles.skinCategory}>
                <Text style={styles.skinCategoryTitle}>{category}</Text>
                <View style={styles.skinGrid}>
                  {NIKITA_SKINS.filter((skin) => skin.category === category).map((skin) => {
                    const owned = ownedSkins.includes(skin.id);
                    const selected = selectedSkin === skin.id;
                    const cannotAfford = !owned && beautokens < NIKITA_SKIN_PRICE;
                    return (
                      <View key={skin.id} style={[styles.skinCard, selected && styles.skinCardSelected]}>
                        <Image source={skin.source} style={styles.skinPreview} resizeMode="contain" />
                        <Text style={styles.skinName} numberOfLines={1}>{skin.name}</Text>
                        <TouchableOpacity
                          style={[
                            styles.skinButton,
                            selected && styles.skinButtonSelected,
                            cannotAfford && styles.skinButtonDisabled,
                          ]}
                          disabled={selected || skinBusy !== null || cannotAfford}
                          onPress={() => selectSkin(skin.id)}
                          activeOpacity={0.75}
                        >
                          {skinBusy === skin.id
                            ? <ActivityIndicator size="small" color="#07111f" />
                            : <Text style={styles.skinButtonText}>
                              {selected ? 'Equipada' : owned ? 'Usar' : `Comprar · ${NIKITA_SKIN_PRICE} ℬ`}
                            </Text>}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={styles.scoreboardSection}>
        <Text style={styles.sectionTitle}>Marcador de alianzas</Text>
        {scoreboard.map((row, index) => (
          <View key={row.alliance} style={styles.scoreRow}>
            <Text style={styles.position}>{index + 1}</Text>
            <View style={[styles.colorMark, { backgroundColor: ALLIANCE_COLORS[row.alliance] }]} />
            <View style={styles.scoreCopy}>
              <AllianceNameText alliance={row.alliance} style={styles.scoreAlliance} />
              <Text style={styles.scorePlayers}>{row.players} {row.players === 1 ? 'jugador' : 'jugadores'}</Text>
            </View>
            <Text style={styles.scorePoints}>{row.points.toLocaleString('es-CL')}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 48, alignItems: 'center' },
  error: { width: '100%', maxWidth: 680, color: theme.colors.error, fontSize: 13, marginBottom: theme.spacing.md },
  selectionSection: { width: '100%', maxWidth: 680, marginBottom: theme.spacing.xl },
  sectionTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '700', marginBottom: theme.spacing.sm },
  helpText: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: theme.spacing.md },
  myScoreRow: {
    width: '100%',
    maxWidth: 680,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  metricRight: { alignItems: 'flex-end' },
  metricLabel: { color: theme.colors.textMuted, fontSize: 12, marginBottom: 3 },
  metricValue: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  gameShell: { width: '100%', maxWidth: 420, marginBottom: theme.spacing.xl },
  gameBoard: {
    width: '100%',
    aspectRatio: 0.72,
    maxHeight: 580,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#07111f',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
  },
  gameBackground: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.04 }],
  },
  gameBackgroundShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 12, 24, 0.62)',
  },
  arcadeHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    paddingHorizontal: 14,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  gameControls: {
    position: 'absolute',
    top: 9,
    left: 0,
    right: 0,
    zIndex: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
  },
  gameControlButton: {
    width: 31,
    height: 31,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.5)',
    backgroundColor: 'rgba(7, 17, 31, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcadeLabel: {
    color: '#67e8f9',
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  arcadeScore: {
    color: '#f8fafc',
    fontFamily: 'monospace',
    fontSize: 23,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  arcadeLivesBlock: { alignItems: 'flex-end' },
  arcadeLives: {
    color: '#fb7185',
    fontFamily: 'monospace',
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },
  arcadePowerUp: {
    position: 'absolute',
    right: 0,
    bottom: -10,
    color: '#67e8f9',
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  platform: {
    position: 'absolute',
    height: 7,
    borderRadius: 2,
    backgroundColor: '#4ade80',
  },
  pickup: {
    position: 'absolute',
    zIndex: 3,
    width: '5%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.95,
    shadowRadius: 9,
  },
  lifePickup: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowColor: '#fb7185',
  },
  immunityPickup: {
    backgroundColor: '#06b6d4',
    borderColor: '#cffafe',
    shadowColor: '#22d3ee',
  },
  lifePickupGlyph: {
    color: '#fb7185',
    fontSize: 22,
    lineHeight: 23,
    fontWeight: '900',
    textShadowColor: '#fecdd3',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 7,
  },
  monster: {
    position: 'absolute',
    zIndex: 2,
    width: `${NIKITA_MONSTER_WIDTH}%`,
    aspectRatio: 1.35,
    borderRadius: 2,
    borderWidth: 1.2,
    overflow: 'hidden',
  },
  monsterHeader: {
    height: '23%',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#17202a',
    alignItems: 'center',
  },
  monsterCode: { flex: 1, color: '#111827', fontSize: 7, fontWeight: '900', textAlign: 'center' },
  monsterCredits: {
    width: '24%',
    height: '100%',
    color: '#111827',
    fontSize: 7,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#17202a',
  },
  monsterNameArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  monsterName: {
    color: '#111827',
    fontSize: 7,
    lineHeight: 8,
    fontWeight: '800',
    textAlign: 'center',
  },
  monsterPrerequisiteArea: {
    height: '20%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#17202a',
  },
  monsterPrerequisite: {
    color: '#111827',
    fontSize: 5.5,
    lineHeight: 7,
    textAlign: 'center',
  },
  projectile: {
    position: 'absolute',
    zIndex: 2,
    width: '4%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.9,
    shadowRadius: 7,
  },
  projectileGlyph: {
    fontSize: 16,
    lineHeight: 17,
    fontWeight: '900',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  matrixExpression: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixParenthesis: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '300',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  matrixValues: {
    fontSize: 12,
    lineHeight: 13,
    fontWeight: '900',
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  opticalLens: {
    position: 'absolute',
    zIndex: 2,
    width: '7%',
    aspectRatio: 0.58,
    shadowColor: '#bae6fd',
    shadowOpacity: 0.9,
    shadowRadius: 7,
    overflow: 'visible',
  },
  player: {
    position: 'absolute',
    width: `${NIKITA_PLAYER_WIDTH}%`,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 3,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerShield: {
    position: 'absolute',
    zIndex: 0,
    width: '172%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: '#67e8f9',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    shadowColor: '#22d3ee',
    shadowOpacity: 0.95,
    shadowRadius: 10,
  },
  playerLetter: { color: '#0f172a', fontSize: 17, fontWeight: '900' },
  playerHitboxGuide: {
    position: 'absolute',
    width: '67%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.7,
  },
  playerSkin: { zIndex: 1, width: '140%', height: '140%' },
  gameOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  overlayTitle: { color: '#ffffff', fontSize: 24, fontWeight: '800', marginBottom: 6 },
  overlayScore: { color: '#cbd5e1', fontSize: 15, marginBottom: theme.spacing.md },
  overlayReward: { color: '#facc15', fontSize: 14, fontWeight: '800', marginBottom: theme.spacing.md },
  startButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  startButtonText: { color: '#000000', fontWeight: '800', fontSize: 15 },
  skinShop: {
    width: '100%',
    maxWidth: 680,
    marginBottom: theme.spacing.xl,
  },
  skinShopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  skinBalance: {
    color: '#facc15',
    fontSize: 18,
    fontWeight: '900',
  },
  skinCategory: { marginBottom: theme.spacing.lg },
  skinCategoryTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: theme.spacing.sm,
  },
  skinGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skinCard: {
    width: '31%',
    minWidth: 138,
    flexGrow: 1,
    maxWidth: 215,
    padding: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardBg,
  },
  skinCardSelected: { borderColor: '#facc15', borderWidth: 2 },
  skinPreview: { width: '100%', height: 112, marginBottom: 6 },
  skinName: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  skinButton: {
    minHeight: 34,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#facc15',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  skinButtonSelected: { backgroundColor: '#a3e635' },
  skinButtonDisabled: { backgroundColor: '#475569', opacity: 0.65 },
  skinButtonText: { color: '#07111f', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  scoreboardSection: { width: '100%', maxWidth: 680 },
  scoreRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  position: { width: 26, color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  colorMark: { width: 4, height: 30, borderRadius: 2, marginRight: 12 },
  scoreCopy: { flex: 1 },
  scoreAlliance: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  scorePlayers: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  scorePoints: { color: theme.colors.text, fontSize: 16, fontWeight: '800' },
});
