import { useCallback, useEffect, useRef, useState } from 'react';
import { BoardOverlays } from './components/BoardOverlays';
import { GameHud } from './components/GameHud';
import { GuideModal } from './components/GuideModal';
import { MobileControls } from './components/MobileControls';
import {
  AI_RESPAWN_DELAY_MS,
  BOOST_BURN_INTERVAL_MS,
  CHRONO_EFFECT_DURATION_MS,
  COMBO_WINDOW_MS,
  createInitialPlayerSnake,
  getLevelForScore,
  getLevelObstacles,
  getTickMsForLevel,
  GHOST_EFFECT_DURATION_MS,
  GLITCH_EFFECT_DURATION_MS,
  GLITCH_ITEM_DURATION_MS,
  GOLDEN_APPLE_DURATION_MS,
  GRID_SIZE,
  HIGH_SCORE_STORAGE_KEY,
  MAX_COMBO_MULTIPLIER,
  MAX_INPUT_QUEUE,
  MAX_SHRINK_RING_DEPTH,
  MIN_SNAKE_LENGTH,
  MUTE_STORAGE_KEY,
  NEAR_MISS_COOLDOWN_MS,
  OBSTACLE_TELEGRAPH_MS,
  POINTS_BONUS_PELLET,
  POINTS_GOLDEN_APPLE,
  POINTS_NEAR_MISS,
  POINTS_PER_FOOD,
  PORTAL_RELOCATE_INTERVAL_MS,
  SHRINK_INTERVAL_MS,
  SHRINK_TELEGRAPH_MS,
  THEME_STORAGE_KEY,
} from './constants/levels';
import { isThemeUnlocked, THEME_MAP, THEMES } from './constants/themes';
import type {
  ActiveEffects,
  ActiveEffectsSnapshot,
  AiSnakeState,
  BonusPellet,
  Direction,
  FloatingText,
  GameMode,
  GameStatus,
  ObstacleState,
  Particle,
  Point,
  PortalPair,
  ShrinkState,
  SpecialItem,
  SpecialItemType,
  ThemeId,
  ToastNotice,
} from './types/game';
import { computeAiDirection, findAiSpawnState } from './utils/ai';
import { audioEngine } from './utils/audio';
import { createBurstParticles, renderGameFrame } from './utils/renderer';
import {
  findSafeEmptyTile,
  findSafePortalPair,
  getDirectionDelta,
  invertDirection,
  isHazardTile,
  isInsidePlayableBounds,
  isOppositeDirection,
  pointKey,
  type SafeSpawnContext,
} from './utils/spawning';

function loadStoredHighScore(): number {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveStoredHighScore(score: number): void {
  try {
    window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(score));
  } catch {
    // Ignore storage errors
  }
}

function loadStoredMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveStoredMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
  } catch {
    // Ignore storage errors
  }
}

function loadStoredTheme(highScore: number): ThemeId {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (raw && raw in THEME_MAP && isThemeUnlocked(raw, highScore)) {
      return raw;
    }
  } catch {
    // Ignore storage errors
  }
  return 'midnight';
}

function saveStoredTheme(themeId: ThemeId): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // Ignore storage errors
  }
}

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function App() {
  // Persisted & selection state
  const [highScore, setHighScore] = useState<number>(() => loadStoredHighScore());
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const initial = loadStoredTheme(loadStoredHighScore());
    audioEngine.setStyle(THEME_MAP[initial].audioStyle);
    return initial;
  });
  const [mode, setMode] = useState<GameMode>('arcade');
  const [startingLevel, setStartingLevel] = useState<number>(1);
  const [muted, setMuted] = useState<boolean>(() => {
    const initial = loadStoredMuted();
    audioEngine.setMuted(initial);
    return initial;
  });

  // Live HUD & overlay UI state
  const [status, setStatus] = useState<GameStatus>('START');
  const [score, setScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [highestLevel, setHighestLevel] = useState<number>(1);
  const [bestCombo, setBestCombo] = useState<number>(1);
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);
  const [comboMultiplier, setComboMultiplier] = useState<number>(1);
  const [comboRatio, setComboRatio] = useState<number>(0);
  const [activeEffects, setActiveEffects] = useState<ActiveEffectsSnapshot>({
    ghostRemainingMs: 0,
    chronoRemainingMs: 0,
    glitchRemainingMs: 0,
  });
  const [isBoosting, setIsBoosting] = useState<boolean>(false);
  const [canBoost, setCanBoost] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [guideOpen, setGuideOpen] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [boardSize, setBoardSize] = useState<number>(400);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => detectTouchDevice());

  // Canvas & container refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardStageRef = useRef<HTMLDivElement | null>(null);
  const boardSizeRef = useRef<number>(400);

  // Real-time game engine refs (pause-safe monotonic gameTimeMsRef)
  const statusRef = useRef<GameStatus>('START');
  const modeRef = useRef<GameMode>('arcade');
  const themeIdRef = useRef<ThemeId>(themeId);
  const startingLevelRef = useRef<number>(1);
  const gameTimeMsRef = useRef<number>(0);

  const snakeRef = useRef<Point[]>(createInitialPlayerSnake(1, 'arcade'));
  const directionRef = useRef<Direction>('RIGHT');
  const inputQueueRef = useRef<Direction[]>([]);
  const smoothHeadRef = useRef<Point>({ x: 200, y: 200 });

  const aiRef = useRef<AiSnakeState>({
    segments: [],
    direction: 'LEFT',
    alive: false,
    respawnAtMs: 0,
    spawnPreview: null,
  });

  const foodRef = useRef<Point | null>(null);
  const specialItemsRef = useRef<SpecialItem[]>([]);
  const bonusPelletsRef = useRef<BonusPellet[]>([]);
  const nextItemIdRef = useRef<number>(1);
  const foodsUntilSpecialRef = useRef<number>(randomInt(3, 5));

  const portalsRef = useRef<PortalPair | null>(null);
  const obstaclesRef = useRef<ObstacleState>({
    active: [],
    telegraphing: [],
    telegraphEndsAtMs: 0,
  });
  const shrinkRef = useRef<ShrinkState>({
    ringDepth: 0,
    telegraphing: false,
    telegraphEndsAtMs: 0,
    nextShrinkAtMs: 0,
  });
  const effectsRef = useRef<ActiveEffects>({
    ghostEndsAtMs: 0,
    chronoEndsAtMs: 0,
    glitchEndsAtMs: 0,
  });

  const scoreRef = useRef<number>(0);
  const highScoreRef = useRef<number>(highScore);
  const levelRef = useRef<number>(1);
  const highestLevelRef = useRef<number>(1);
  const comboMultiplierRef = useRef<number>(1);
  const comboEndsAtMsRef = useRef<number>(0);
  const bestComboRef = useRef<number>(1);
  const lastNearMissAtMsRef = useRef<number>(-10000);

  const boostHeldRef = useRef<boolean>(false);
  const boostBurnAccMsRef = useRef<number>(0);

  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const collisionFlashRef = useRef<number>(0);
  const reducedMotionRef = useRef<boolean>(false);
  const toastTimeoutRef = useRef<number | null>(null);
  const shakeTimeoutRef = useRef<number | null>(null);

  // Initialize initial start-screen preview food once
  useEffect(() => {
    if (!foodRef.current) {
      foodRef.current = findSafeEmptyTile({
        playerSnake: snakeRef.current,
        playerDir: directionRef.current,
        obstacles: [],
        telegraphingObstacles: [],
        hazardDepth: 0,
        food: null,
        specialItems: [],
        bonusPellets: [],
        portals: null,
      });
    }
  }, []);

  useEffect(() => {
    boardSizeRef.current = boardSize;
  }, [boardSize]);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = motionQuery.matches;
    const onMotion = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    motionQuery.addEventListener('change', onMotion);

    const pointerQuery = window.matchMedia('(pointer: coarse)');
    const onPointer = () => setIsTouchDevice(detectTouchDevice());
    pointerQuery.addEventListener('change', onPointer);

    return () => {
      motionQuery.removeEventListener('change', onMotion);
      pointerQuery.removeEventListener('change', onPointer);
    };
  }, []);

  // Measure available canvas stage and snap to integer multiples of GRID_SIZE (20px)
  useEffect(() => {
    const stage = boardStageRef.current;
    if (!stage) return;

    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      const availableWidth = Math.max(200, rect.width - 4);
      const availableHeight = Math.max(200, rect.height - 4);
      const maxCap = window.innerWidth >= 768 ? 560 : 520;
      const raw = Math.min(availableWidth, availableHeight, maxCap);
      const snapped = Math.max(220, Math.floor(raw / GRID_SIZE) * GRID_SIZE);
      setBoardSize((prev) => (prev === snapped ? prev : snapped));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const showToast = useCallback(
    (title: string, subtitle: string | undefined, tone: ToastNotice['tone']) => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      setToast({ id: Date.now() + Math.random(), title, subtitle, tone });
      toastTimeoutRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 1750);
    },
    []
  );

  const triggerShake = useCallback(() => {
    if (reducedMotionRef.current) return;
    if (shakeTimeoutRef.current !== null) {
      window.clearTimeout(shakeTimeoutRef.current);
    }
    setIsShaking(false);
    window.requestAnimationFrame(() => {
      setIsShaking(true);
      shakeTimeoutRef.current = window.setTimeout(() => {
        setIsShaking(false);
        shakeTimeoutRef.current = null;
      }, 260);
    });
  }, []);

  const spawnFloatingText = useCallback((cell: Point, text: string, color: string) => {
    const cellSize = boardSizeRef.current / GRID_SIZE;
    floatingTextsRef.current.push({
      x: (cell.x + 0.5) * cellSize,
      y: (cell.y + 0.25) * cellSize,
      text,
      color,
      life: 0,
      maxLife: 0.85,
    });
  }, []);

  const buildSpawnContext = useCallback((): SafeSpawnContext => {
    return {
      playerSnake: snakeRef.current,
      playerDir: directionRef.current,
      aiSnake: aiRef.current.alive ? aiRef.current.segments : undefined,
      aiDir: aiRef.current.alive ? aiRef.current.direction : undefined,
      obstacles: obstaclesRef.current.active,
      telegraphingObstacles: obstaclesRef.current.telegraphing,
      hazardDepth: shrinkRef.current.ringDepth,
      food: foodRef.current,
      specialItems: specialItemsRef.current,
      bonusPellets: bonusPelletsRef.current,
      portals: portalsRef.current,
    };
  }, []);

  const awardScore = useCallback(
    (points: number) => {
      if (points <= 0) return;
      const prevHigh = highScoreRef.current;
      const nextScore = scoreRef.current + points;
      scoreRef.current = nextScore;
      setScore(nextScore);

      if (nextScore > prevHigh) {
        highScoreRef.current = nextScore;
        setHighScore(nextScore);
        setIsNewHighScore(true);
        saveStoredHighScore(nextScore);

        // Check if player just crossed any Theme Unlock threshold!
        for (const t of THEMES) {
          if (t.unlockScore > 0 && prevHigh < t.unlockScore && nextScore >= t.unlockScore) {
            audioEngine.playThemeUnlock();
            showToast('THEME UNLOCKED', t.name.toUpperCase(), 'cyan');
            break;
          }
        }
      }
    },
    [showToast]
  );

  const scheduleLevelObstacles = useCallback((targetLevel: number, activeMode: GameMode, nowGameMs: number) => {
    const layout = getLevelObstacles(targetLevel, activeMode);
    if (layout.length === 0) {
      obstaclesRef.current = { active: [], telegraphing: [], telegraphEndsAtMs: 0 };
      return;
    }

    // Filter out any obstacles already buried under electrified hazard rings
    const filtered = layout.filter((p) => !isHazardTile(p, shrinkRef.current.ringDepth));
    obstaclesRef.current = {
      active: [],
      telegraphing: filtered,
      telegraphEndsAtMs: nowGameMs + OBSTACLE_TELEGRAPH_MS,
    };
  }, []);

  const handleSelectMode = useCallback((nextMode: GameMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
    audioEngine.playToggle();
  }, []);

  const handleSelectTheme = useCallback((nextTheme: ThemeId) => {
    themeIdRef.current = nextTheme;
    setThemeId(nextTheme);
    audioEngine.setStyle(THEME_MAP[nextTheme].audioStyle);
    saveStoredTheme(nextTheme);
    audioEngine.playToggle();
  }, []);

  const handleSelectStartingLevel = useCallback((nextStartLevel: number) => {
    startingLevelRef.current = nextStartLevel;
    levelRef.current = nextStartLevel;
    setStartingLevel(nextStartLevel);
    setLevel(nextStartLevel);
    audioEngine.playToggle();
  }, []);

  const setBoostHeld = useCallback((held: boolean) => {
    boostHeldRef.current = held;
    if (!held) {
      boostBurnAccMsRef.current = 0;
      setIsBoosting(false);
    }
  }, []);

  const startNewGame = useCallback(() => {
    audioEngine.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }

    const activeMode = modeRef.current;
    const startLvl = startingLevelRef.current;
    const freshSnake = createInitialPlayerSnake(startLvl, activeMode);
    const cellSize = boardSizeRef.current / GRID_SIZE;

    gameTimeMsRef.current = 0;
    snakeRef.current = freshSnake;
    directionRef.current = 'RIGHT';
    inputQueueRef.current = [];
    smoothHeadRef.current = {
      x: (freshSnake[0].x + 0.5) * cellSize,
      y: (freshSnake[0].y + 0.5) * cellSize,
    };

    specialItemsRef.current = [];
    bonusPelletsRef.current = [];
    foodsUntilSpecialRef.current = randomInt(3, 5);
    particlesRef.current = [];
    floatingTextsRef.current = [];
    collisionFlashRef.current = 0;

    effectsRef.current = { ghostEndsAtMs: 0, chronoEndsAtMs: 0, glitchEndsAtMs: 0 };
    shrinkRef.current = {
      ringDepth: 0,
      telegraphing: false,
      telegraphEndsAtMs: 0,
      nextShrinkAtMs: activeMode === 'arcade' && startLvl >= 5 ? SHRINK_INTERVAL_MS : 0,
    };

    scheduleLevelObstacles(startLvl, activeMode, 0);

    // Duel Mode Rival AI setup
    if (activeMode === 'duel') {
      const aiSpawn = findAiSpawnState(freshSnake, obstaclesRef.current.telegraphing, 0);
      aiRef.current = aiSpawn
        ? {
            segments: aiSpawn.segments,
            direction: aiSpawn.direction,
            alive: true,
            respawnAtMs: 0,
            spawnPreview: null,
          }
        : { segments: [], direction: 'LEFT', alive: false, respawnAtMs: AI_RESPAWN_DELAY_MS, spawnPreview: null };
    } else {
      aiRef.current = { segments: [], direction: 'LEFT', alive: false, respawnAtMs: 0, spawnPreview: null };
    }

    // Linked Portals (Level 2+ in Arcade Mode)
    portalsRef.current = null;
    if (activeMode === 'arcade' && startLvl >= 2) {
      portalsRef.current = findSafePortalPair(
        {
          playerSnake: freshSnake,
          playerDir: 'RIGHT',
          obstacles: [],
          telegraphingObstacles: obstaclesRef.current.telegraphing,
          hazardDepth: 0,
          food: null,
          specialItems: [],
          bonusPellets: [],
          portals: null,
        },
        0
      );
    }

    // Safe Food Spawn
    foodRef.current = findSafeEmptyTile({
      playerSnake: freshSnake,
      playerDir: 'RIGHT',
      aiSnake: aiRef.current.alive ? aiRef.current.segments : undefined,
      aiDir: aiRef.current.alive ? aiRef.current.direction : undefined,
      obstacles: [],
      telegraphingObstacles: obstaclesRef.current.telegraphing,
      hazardDepth: 0,
      food: null,
      specialItems: [],
      bonusPellets: [],
      portals: portalsRef.current,
    });

    scoreRef.current = 0;
    levelRef.current = startLvl;
    highestLevelRef.current = startLvl;
    comboMultiplierRef.current = 1;
    comboEndsAtMsRef.current = 0;
    bestComboRef.current = 1;
    lastNearMissAtMsRef.current = -10000;
    boostHeldRef.current = false;
    boostBurnAccMsRef.current = 0;
    statusRef.current = 'PLAYING';

    setScore(0);
    setLevel(startLvl);
    setHighestLevel(startLvl);
    setBestCombo(1);
    setComboMultiplier(1);
    setComboRatio(0);
    setIsNewHighScore(false);
    setActiveEffects({ ghostRemainingMs: 0, chronoRemainingMs: 0, glitchRemainingMs: 0 });
    setIsBoosting(false);
    setCanBoost(freshSnake.length > MIN_SNAKE_LENGTH);
    setToast(null);
    setGuideOpen(false);
    setStatus('PLAYING');
  }, [scheduleLevelObstacles]);

  const togglePause = useCallback(() => {
    if (statusRef.current === 'PLAYING') {
      boostHeldRef.current = false;
      setIsBoosting(false);
      statusRef.current = 'PAUSED';
      setStatus('PAUSED');
      audioEngine.playToggle();
    } else if (statusRef.current === 'PAUSED') {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      statusRef.current = 'PLAYING';
      setStatus('PLAYING');
      audioEngine.playToggle();
    }
  }, []);

  const returnToMenu = useCallback(() => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    const freshSnake = createInitialPlayerSnake(startingLevelRef.current, modeRef.current);
    snakeRef.current = freshSnake;
    directionRef.current = 'RIGHT';
    inputQueueRef.current = [];
    obstaclesRef.current = { active: [], telegraphing: [], telegraphEndsAtMs: 0 };
    portalsRef.current = null;
    specialItemsRef.current = [];
    bonusPelletsRef.current = [];
    shrinkRef.current = { ringDepth: 0, telegraphing: false, telegraphEndsAtMs: 0, nextShrinkAtMs: 0 };
    effectsRef.current = { ghostEndsAtMs: 0, chronoEndsAtMs: 0, glitchEndsAtMs: 0 };
    aiRef.current = { segments: [], direction: 'LEFT', alive: false, respawnAtMs: 0, spawnPreview: null };
    foodRef.current = findSafeEmptyTile({
      playerSnake: freshSnake,
      playerDir: 'RIGHT',
      obstacles: [],
      telegraphingObstacles: [],
      hazardDepth: 0,
      food: null,
      specialItems: [],
      bonusPellets: [],
      portals: null,
    });
    particlesRef.current = [];
    floatingTextsRef.current = [];
    collisionFlashRef.current = 0;
    scoreRef.current = 0;
    levelRef.current = startingLevelRef.current;
    boostHeldRef.current = false;
    statusRef.current = 'START';

    setScore(0);
    setLevel(startingLevelRef.current);
    setComboMultiplier(1);
    setComboRatio(0);
    setActiveEffects({ ghostRemainingMs: 0, chronoRemainingMs: 0, glitchRemainingMs: 0 });
    setIsBoosting(false);
    setToast(null);
    setStatus('START');
    audioEngine.playToggle();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      audioEngine.setMuted(next);
      saveStoredMuted(next);
      if (!next) {
        audioEngine.unlock();
        audioEngine.playToggle();
      }
      return next;
    });
  }, []);

  // Shared direction input queue (keyboard + mobile D-pad), automatically applying Glitch inversion
  const enqueueDirection = useCallback((rawDirection: Direction) => {
    if (statusRef.current !== 'PLAYING') return;
    audioEngine.unlock();

    const isInverted = effectsRef.current.glitchEndsAtMs > gameTimeMsRef.current;
    const nextDirection = isInverted ? invertDirection(rawDirection) : rawDirection;

    const queue = inputQueueRef.current;
    const refDir = queue.length > 0 ? queue[queue.length - 1] : directionRef.current;

    if (nextDirection === refDir || isOppositeDirection(nextDirection, refDir)) {
      return;
    }

    if (queue.length < MAX_INPUT_QUEUE) {
      queue.push(nextDirection);
    }
  }, []);

  // Keyboard listeners: Arrows/WASD, Shift boost, Space/P pause, Escape guide close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (guideOpen) {
        if (e.key === 'Escape') {
          setGuideOpen(false);
        }
        return;
      }

      const key = e.key;
      const code = e.code;

      if (
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        code === 'Space' ||
        key === ' '
      ) {
        e.preventDefault();
      }

      if (key === 'Shift') {
        if (statusRef.current === 'PLAYING') {
          boostHeldRef.current = true;
        }
        return;
      }

      if (key === 'ArrowUp' || key === 'w' || key === 'W') {
        enqueueDirection('UP');
        return;
      }
      if (key === 'ArrowDown' || key === 's' || key === 'S') {
        enqueueDirection('DOWN');
        return;
      }
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        enqueueDirection('LEFT');
        return;
      }
      if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        enqueueDirection('RIGHT');
        return;
      }

      if ((code === 'Space' || key === 'p' || key === 'P') && !e.repeat) {
        if (statusRef.current === 'PLAYING' || statusRef.current === 'PAUSED') {
          togglePause();
          return;
        }
        if (
          code === 'Space' &&
          (statusRef.current === 'START' ||
            statusRef.current === 'GAME_OVER' ||
            statusRef.current === 'VICTORY')
        ) {
          const activeRole = document.activeElement?.getAttribute('role');
          if (activeRole !== 'radio') {
            startNewGame();
          }
        }
        return;
      }

      if (key === 'Enter' && !e.repeat) {
        if (statusRef.current === 'GAME_OVER' || statusRef.current === 'VICTORY') {
          startNewGame();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        boostHeldRef.current = false;
        boostBurnAccMsRef.current = 0;
        setIsBoosting(false);
      }
    };

    const handleBlur = () => {
      boostHeldRef.current = false;
      boostBurnAccMsRef.current = 0;
      setIsBoosting(false);
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enqueueDirection, guideOpen, startNewGame, togglePause]);

  // Auto-pause if browser tab becomes hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && statusRef.current === 'PLAYING') {
        boostHeldRef.current = false;
        setIsBoosting(false);
        statusRef.current = 'PAUSED';
        setStatus('PAUSED');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      if (shakeTimeoutRef.current !== null) {
        window.clearTimeout(shakeTimeoutRef.current);
      }
    };
  }, []);

  // Main 60fps loop: fixed-timestep Player & AI ticks, timers, power-ups, particles, and canvas render
  useEffect(() => {
    let rafId = 0;
    let lastTimestamp = performance.now();
    let playerTickAcc = 0;
    let aiTickAcc = 0;
    let hudSyncAcc = 0;
    let lavaEmberAcc = 0;

    const triggerGameOver = () => {
      statusRef.current = 'GAME_OVER';
      boostHeldRef.current = false;
      collisionFlashRef.current = 0.3;
      setIsBoosting(false);
      setStatus('GAME_OVER');
      triggerShake();
      audioEngine.playGameOver();
    };

    const checkAndAdvanceLevel = (nowGameMs: number) => {
      const nextLevel = getLevelForScore(scoreRef.current, startingLevelRef.current);
      if (nextLevel <= levelRef.current) return false;

      levelRef.current = nextLevel;
      setLevel(nextLevel);
      if (nextLevel > highestLevelRef.current) {
        highestLevelRef.current = nextLevel;
        setHighestLevel(nextLevel);
      }

      // Dynamic Arena Obstacles (2s flashing amber warning before solidifying)
      scheduleLevelObstacles(nextLevel, modeRef.current, nowGameMs);

      // Spawn Linked Portals starting Level 2 in Arcade Mode
      if (modeRef.current === 'arcade' && nextLevel >= 2 && !portalsRef.current) {
        portalsRef.current = findSafePortalPair(buildSpawnContext(), nowGameMs);
      }

      // Initialize Level 5+ Sudden Death Shrinking Arena schedule in Arcade Mode
      if (
        modeRef.current === 'arcade' &&
        nextLevel >= 5 &&
        shrinkRef.current.nextShrinkAtMs === 0 &&
        !shrinkRef.current.telegraphing
      ) {
        shrinkRef.current.nextShrinkAtMs = nowGameMs + SHRINK_INTERVAL_MS;
      }

      showToast('LEVEL UP!', `Level ${nextLevel}`, 'amber');
      if (snakeRef.current.length > 0) {
        spawnFloatingText(snakeRef.current[0], `LEVEL ${nextLevel}!`, '#FBBF24');
      }
      audioEngine.playLevelUp();
      return true;
    };

    const advanceCombo = (nowGameMs: number): number => {
      if (nowGameMs < comboEndsAtMsRef.current) {
        comboMultiplierRef.current = Math.min(
          MAX_COMBO_MULTIPLIER,
          comboMultiplierRef.current + 1
        );
      } else {
        comboMultiplierRef.current = 1;
      }
      comboEndsAtMsRef.current = nowGameMs + COMBO_WINDOW_MS;

      if (comboMultiplierRef.current > bestComboRef.current) {
        bestComboRef.current = comboMultiplierRef.current;
        setBestCombo(comboMultiplierRef.current);
      }
      setComboMultiplier(comboMultiplierRef.current);
      return comboMultiplierRef.current;
    };

    const maybeSpawnSpecialItems = (nowGameMs: number) => {
      foodsUntilSpecialRef.current -= 1;
      const ctx = buildSpawnContext();

      if (foodsUntilSpecialRef.current <= 0) {
        foodsUntilSpecialRef.current = randomInt(3, 5);
        // Avoid cluttering with more than 1 beneficial special item at a time
        const hasBeneficial = specialItemsRef.current.some((it) => it.type !== 'glitch');
        if (!hasBeneficial) {
          const pool: SpecialItemType[] = ['shrink', 'golden', 'ghost', 'chrono'];
          const chosen = pool[Math.floor(Math.random() * pool.length)];
          const pos = findSafeEmptyTile(ctx);
          if (pos) {
            const durationMs = chosen === 'golden' ? GOLDEN_APPLE_DURATION_MS : null;
            specialItemsRef.current.push({
              id: nextItemIdRef.current++,
              type: chosen,
              pos,
              spawnedAtMs: nowGameMs,
              durationMs,
              expiresAtMs: durationMs !== null ? nowGameMs + durationMs : null,
            });
          }
        }
      }

      // Occasionally spawn a Glitch / Poison Fruit alongside normal food as a decoy hazard
      const hasGlitch = specialItemsRef.current.some((it) => it.type === 'glitch');
      if (!hasGlitch && scoreRef.current >= 20 && Math.random() < 0.28) {
        const pos = findSafeEmptyTile(buildSpawnContext());
        if (pos) {
          specialItemsRef.current.push({
            id: nextItemIdRef.current++,
            type: 'glitch',
            pos,
            spawnedAtMs: nowGameMs,
            durationMs: GLITCH_ITEM_DURATION_MS,
            expiresAtMs: nowGameMs + GLITCH_ITEM_DURATION_MS,
          });
        }
      }
    };

    const shatterAiSnake = (nowGameMs: number) => {
      const ai = aiRef.current;
      if (!ai.alive) return;

      const cellSize = boardSizeRef.current / GRID_SIZE;
      const burstCount = THEME_MAP[themeIdRef.current].bloom ? 16 : 12;
      const head = ai.segments[0];

      // Explode particles along the AI body
      for (let i = 0; i < Math.min(ai.segments.length, 5); i++) {
        particlesRef.current.push(
          ...createBurstParticles(
            ai.segments[i],
            cellSize,
            ['#FB7185', '#F43F5E', '#FBBF24', '#FDA4AF'],
            i === 0 ? burstCount : 6
          )
        );
      }

      // Convert 4-6 valid former AI positions into +15 bonus mini-pellets
      const occupied = new Set<string>([
        ...snakeRef.current.map(pointKey),
        ...obstaclesRef.current.active.map(pointKey),
        ...bonusPelletsRef.current.map((p) => pointKey(p.pos)),
      ]);
      if (foodRef.current) occupied.add(pointKey(foodRef.current));

      const targetPellets = randomInt(4, 6);
      const added: BonusPellet[] = [];

      for (const seg of ai.segments) {
        if (added.length >= targetPellets) break;
        if (isHazardTile(seg, shrinkRef.current.ringDepth)) continue;
        const k = pointKey(seg);
        if (occupied.has(k)) continue;
        occupied.add(k);
        added.push({ pos: { x: seg.x, y: seg.y }, points: POINTS_BONUS_PELLET });
      }

      // If AI was short (< 4 segments), scatter remaining pellets adjacent to its shatter point
      if (added.length < 4 && head) {
        const offsets = [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
          { x: 1, y: 1 },
          { x: -1, y: -1 },
        ];
        for (const off of offsets) {
          if (added.length >= 4) break;
          const pt = { x: head.x + off.x, y: head.y + off.y };
          if (!isInsidePlayableBounds(pt, shrinkRef.current.ringDepth)) continue;
          const k = pointKey(pt);
          if (occupied.has(k)) continue;
          occupied.add(k);
          added.push({ pos: pt, points: POINTS_BONUS_PELLET });
        }
      }

      bonusPelletsRef.current.push(...added);

      if (head) {
        spawnFloatingText(head, 'AI SHATTERED!', '#FB7185');
      }
      triggerShake();
      audioEngine.playAiShatter();

      aiRef.current = {
        segments: [],
        direction: 'LEFT',
        alive: false,
        respawnAtMs: nowGameMs + AI_RESPAWN_DELAY_MS,
        spawnPreview: null,
      };
    };

    const isTileLethalForNearMiss = (pt: Point): boolean => {
      if (!isInsidePlayableBounds(pt, shrinkRef.current.ringDepth)) return true;
      const k = pointKey(pt);
      if (obstaclesRef.current.active.some((o) => pointKey(o) === k)) return true;
      // Check against player's current body (excluding tail tip which vacates)
      const body = snakeRef.current;
      for (let i = 0; i < body.length - 1; i++) {
        if (body[i].x === pt.x && body[i].y === pt.y) return true;
      }
      if (aiRef.current.alive) {
        if (aiRef.current.segments.some((s) => s.x === pt.x && s.y === pt.y)) return true;
      }
      return false;
    };

    const stepPlayer = (nowGameMs: number) => {
      const prevDir = directionRef.current;
      const queue = inputQueueRef.current;
      if (queue.length > 0) {
        const queued = queue.shift()!;
        if (!isOppositeDirection(queued, prevDir)) {
          directionRef.current = queued;
        }
      }

      const turned = directionRef.current !== prevDir;
      const snake = snakeRef.current;
      const head = snake[0];
      const delta = getDirectionDelta(directionRef.current);
      const isGhost = effectsRef.current.ghostEndsAtMs > nowGameMs;
      const hazardDepth = shrinkRef.current.ringDepth;
      const minBound = hazardDepth;
      const maxBound = GRID_SIZE - hazardDepth - 1;
      const cellSize = boardSizeRef.current / GRID_SIZE;
      const theme = THEME_MAP[themeIdRef.current];
      const burstCount = theme.bloom ? 16 : 12;

      let nextHead: Point = {
        x: head.x + delta.x,
        y: head.y + delta.y,
      };

      // Boundary / Electrified Ring check (Ghost Mode wraps cleanly around playable bounds!)
      if (!isInsidePlayableBounds(nextHead, hazardDepth)) {
        if (isGhost) {
          if (nextHead.x < minBound) nextHead.x = maxBound;
          else if (nextHead.x > maxBound) nextHead.x = minBound;
          if (nextHead.y < minBound) nextHead.y = maxBound;
          else if (nextHead.y > maxBound) nextHead.y = minBound;
        } else {
          triggerGameOver();
          return;
        }
      }

      // Linked Portals teleportation check
      const portals = portalsRef.current;
      if (portals) {
        if (nextHead.x === portals.a.x && nextHead.y === portals.a.y) {
          particlesRef.current.push(
            ...createBurstParticles(portals.a, cellSize, ['#38BDF8', '#E0F2FE'], 10),
            ...createBurstParticles(portals.b, cellSize, ['#FB923C', '#FFEDD5'], 10)
          );
          nextHead = { x: portals.b.x, y: portals.b.y };
          audioEngine.playPortal();
          spawnFloatingText(nextHead, 'WARP!', '#38BDF8');
        } else if (nextHead.x === portals.b.x && nextHead.y === portals.b.y) {
          particlesRef.current.push(
            ...createBurstParticles(portals.b, cellSize, ['#FB923C', '#FFEDD5'], 10),
            ...createBurstParticles(portals.a, cellSize, ['#38BDF8', '#E0F2FE'], 10)
          );
          nextHead = { x: portals.a.x, y: portals.a.y };
          audioEngine.playPortal();
          spawnFloatingText(nextHead, 'WARP!', '#FB923C');
        }
      }

      // Active Obstacle collision check (ignored in Ghost Mode)
      if (!isGhost) {
        const hitObstacle = obstaclesRef.current.active.some(
          (obs) => obs.x === nextHead.x && obs.y === nextHead.y
        );
        if (hitObstacle) {
          triggerGameOver();
          return;
        }
      }

      // Rival AI Body collision check (ignored in Ghost Mode)
      if (!isGhost && modeRef.current === 'duel' && aiRef.current.alive) {
        const hitAi = aiRef.current.segments.some(
          (seg) => seg.x === nextHead.x && seg.y === nextHead.y
        );
        if (hitAi) {
          triggerGameOver();
          return;
        }
      }

      const food = foodRef.current;
      const willEatFood = food !== null && nextHead.x === food.x && nextHead.y === food.y;

      // Self-collision check (tail tip vacates unless eating food; ignored in Ghost Mode)
      if (!isGhost) {
        const bodyToCheck = willEatFood ? snake : snake.slice(0, -1);
        const hitSelf = bodyToCheck.some(
          (seg) => seg.x === nextHead.x && seg.y === nextHead.y
        );
        if (hitSelf) {
          triggerGameOver();
          return;
        }
      }

      // Near-Miss Bonus Detection: turned safely away on the final tick before a lethal tile!
      if (
        turned &&
        !isGhost &&
        nowGameMs - lastNearMissAtMsRef.current >= NEAR_MISS_COOLDOWN_MS
      ) {
        const prevDelta = getDirectionDelta(prevDir);
        const avoidedTile: Point = { x: head.x + prevDelta.x, y: head.y + prevDelta.y };
        if (isTileLethalForNearMiss(avoidedTile)) {
          lastNearMissAtMsRef.current = nowGameMs;
          awardScore(POINTS_NEAR_MISS);
          checkAndAdvanceLevel(nowGameMs);
          spawnFloatingText(nextHead, '+5 CLOSE CALL!', '#38BDF8');
          audioEngine.playNearMiss();
        }
      }

      // Advance Player Snake
      const nextSnake = [nextHead, ...snake];
      if (!willEatFood) {
        nextSnake.pop();
      }
      snakeRef.current = nextSnake;

      // 1. Standard Food Eaten
      if (willEatFood && food) {
        const mult = advanceCombo(nowGameMs);
        const earned = POINTS_PER_FOOD * mult;

        particlesRef.current.push(
          ...createBurstParticles(
            food,
            cellSize,
            [theme.board.foodCore, theme.board.foodHighlight, theme.board.snakeHead, '#FBBF24'],
            burstCount
          )
        );
        spawnFloatingText(
          food,
          mult > 1 ? `+${earned} (x${mult})` : `+${earned}`,
          mult >= 3 ? '#FBBF24' : '#4ADE80'
        );

        awardScore(earned);
        const leveledUp = checkAndAdvanceLevel(nowGameMs);
        if (!leveledUp) {
          audioEngine.playEat(mult);
        }

        foodRef.current = findSafeEmptyTile(buildSpawnContext());
        if (!foodRef.current) {
          statusRef.current = 'VICTORY';
          setStatus('VICTORY');
          audioEngine.playLevelUp();
          return;
        }
        maybeSpawnSpecialItems(nowGameMs);
      }

      // 2. Bonus Mini-Pellets (from Shattered Rival AI)
      const pelletIdx = bonusPelletsRef.current.findIndex(
        (p) => p.pos.x === nextHead.x && p.pos.y === nextHead.y
      );
      if (pelletIdx !== -1) {
        const pellet = bonusPelletsRef.current[pelletIdx];
        bonusPelletsRef.current.splice(pelletIdx, 1);

        const mult = advanceCombo(nowGameMs);
        const earned = pellet.points * mult;

        particlesRef.current.push(
          ...createBurstParticles(
            pellet.pos,
            cellSize,
            ['#FB7185', '#FBBF24', '#FFE4E6'],
            burstCount
          )
        );
        spawnFloatingText(pellet.pos, `+${earned} BONUS!`, '#FB7185');
        awardScore(earned);
        const leveledUp = checkAndAdvanceLevel(nowGameMs);
        if (!leveledUp) {
          audioEngine.playEat(mult);
        }
      }

      // 3. Special Power-Ups & Glitch Hazard
      const specialIdx = specialItemsRef.current.findIndex(
        (it) => it.pos.x === nextHead.x && it.pos.y === nextHead.y
      );
      if (specialIdx !== -1) {
        const item = specialItemsRef.current[specialIdx];
        specialItemsRef.current.splice(specialIdx, 1);

        switch (item.type) {
          case 'shrink': {
            const currentLen = snakeRef.current.length;
            const removable = Math.min(4, Math.max(0, currentLen - MIN_SNAKE_LENGTH));
            if (removable > 0) {
              const removedSegs = snakeRef.current.slice(currentLen - removable);
              snakeRef.current = snakeRef.current.slice(0, currentLen - removable);
              for (const seg of removedSegs) {
                particlesRef.current.push(
                  ...createBurstParticles(seg, cellSize, ['#2DD4BF', '#99F6E4'], 6)
                );
              }
            }
            particlesRef.current.push(
              ...createBurstParticles(item.pos, cellSize, ['#14B8A6', '#5EEAD4', '#CCFBF1'], burstCount)
            );
            spawnFloatingText(item.pos, '-4 LENGTH', '#5EEAD4');
            audioEngine.playShrink();
            break;
          }

          case 'golden': {
            const mult = advanceCombo(nowGameMs);
            const earned = POINTS_GOLDEN_APPLE * mult;
            particlesRef.current.push(
              ...createBurstParticles(item.pos, cellSize, ['#FACC15', '#FEF08A', '#F97316'], burstCount + 4)
            );
            spawnFloatingText(item.pos, `+${earned} GOLDEN!`, '#FDE047');
            awardScore(earned);
            checkAndAdvanceLevel(nowGameMs);
            audioEngine.playGolden();
            break;
          }

          case 'ghost': {
            effectsRef.current.ghostEndsAtMs = nowGameMs + GHOST_EFFECT_DURATION_MS;
            particlesRef.current.push(
              ...createBurstParticles(item.pos, cellSize, ['#E0F2FE', '#38BDF8', '#FFFFFF'], burstCount)
            );
            spawnFloatingText(item.pos, 'GHOST MODE!', '#BAE6FD');
            audioEngine.playGhost();
            break;
          }

          case 'chrono': {
            effectsRef.current.chronoEndsAtMs = nowGameMs + CHRONO_EFFECT_DURATION_MS;
            particlesRef.current.push(
              ...createBurstParticles(item.pos, cellSize, ['#60A5FA', '#BFDBFE', '#EFF6FF'], burstCount)
            );
            spawnFloatingText(item.pos, 'CHRONO FREEZE!', '#93C5FD');
            audioEngine.playChrono();
            break;
          }

          case 'glitch': {
            effectsRef.current.glitchEndsAtMs = nowGameMs + GLITCH_EFFECT_DURATION_MS;
            inputQueueRef.current = [];
            particlesRef.current.push(
              ...createBurstParticles(item.pos, cellSize, ['#C084FC', '#E879F9', '#581C87'], burstCount)
            );
            spawnFloatingText(item.pos, 'INVERTED!', '#E879F9');
            triggerShake();
            audioEngine.playGlitch();
            break;
          }
        }
      }

      // Keep Boost eligibility synced
      const eligible = snakeRef.current.length > MIN_SNAKE_LENGTH;
      if (!eligible && boostHeldRef.current) {
        boostBurnAccMsRef.current = 0;
        setIsBoosting(false);
      }
      setCanBoost(eligible);
    };

    const stepAi = (nowGameMs: number) => {
      if (modeRef.current !== 'duel') return;
      const ai = aiRef.current;
      if (!ai.alive || ai.segments.length === 0) return;

      const nextDir = computeAiDirection({
        aiSegments: ai.segments,
        aiDirection: ai.direction,
        playerSegments: snakeRef.current,
        obstacles: obstaclesRef.current.active,
        hazardDepth: shrinkRef.current.ringDepth,
        food: foodRef.current,
        specialItems: specialItemsRef.current,
        bonusPellets: bonusPelletsRef.current,
      });
      ai.direction = nextDir;

      const head = ai.segments[0];
      const delta = getDirectionDelta(nextDir);
      const nextHead: Point = { x: head.x + delta.x, y: head.y + delta.y };

      // Check AI crash into walls, hazard ring, obstacles, own body, or player snake -> SHATTER!
      const hitWallOrHazard = !isInsidePlayableBounds(nextHead, shrinkRef.current.ringDepth);
      const hitObstacle = obstaclesRef.current.active.some(
        (o) => o.x === nextHead.x && o.y === nextHead.y
      );
      const hitPlayer = snakeRef.current.some(
        (s) => s.x === nextHead.x && s.y === nextHead.y
      );
      const hitSelf = ai.segments
        .slice(0, -1)
        .some((s) => s.x === nextHead.x && s.y === nextHead.y);

      if (hitWallOrHazard || hitObstacle || hitPlayer || hitSelf) {
        shatterAiSnake(nowGameMs);
        return;
      }

      const food = foodRef.current;
      const ateFood = food !== null && nextHead.x === food.x && nextHead.y === food.y;

      const nextSegments = [nextHead, ...ai.segments];
      if (!ateFood) {
        nextSegments.pop();
      }
      ai.segments = nextSegments;

      if (ateFood && food) {
        const cellSize = boardSizeRef.current / GRID_SIZE;
        particlesRef.current.push(
          ...createBurstParticles(food, cellSize, ['#FB7185', '#F43F5E'], 8)
        );
        foodRef.current = findSafeEmptyTile(buildSpawnContext());
      }

      // AI can also snatch bonus pellets or golden apples
      const pelletIdx = bonusPelletsRef.current.findIndex(
        (p) => p.pos.x === nextHead.x && p.pos.y === nextHead.y
      );
      if (pelletIdx !== -1) {
        bonusPelletsRef.current.splice(pelletIdx, 1);
      }
    };

    const updateArenaTimers = (nowGameMs: number) => {
      // 1. Solidify telegraphed obstacles after 2 full seconds
      if (
        obstaclesRef.current.telegraphing.length > 0 &&
        nowGameMs >= obstaclesRef.current.telegraphEndsAtMs
      ) {
        const solidified = obstaclesRef.current.telegraphing.filter(
          (p) => !isHazardTile(p, shrinkRef.current.ringDepth)
        );
        obstaclesRef.current = {
          active: solidified,
          telegraphing: [],
          telegraphEndsAtMs: 0,
        };

        // Ensure food, special items, or portals aren't trapped inside newly solidified obstacles
        const obsKeys = new Set(solidified.map(pointKey));
        if (foodRef.current && obsKeys.has(pointKey(foodRef.current))) {
          foodRef.current = findSafeEmptyTile(buildSpawnContext());
        }
        specialItemsRef.current = specialItemsRef.current.filter(
          (it) => !obsKeys.has(pointKey(it.pos))
        );
        if (
          portalsRef.current &&
          (obsKeys.has(pointKey(portalsRef.current.a)) ||
            obsKeys.has(pointKey(portalsRef.current.b)))
        ) {
          portalsRef.current = findSafePortalPair(buildSpawnContext(), nowGameMs);
        }
      }

      // 2. Expire timed special items (Golden Apple 5s, Glitch Fruit 10s)
      if (specialItemsRef.current.length > 0) {
        specialItemsRef.current = specialItemsRef.current.filter(
          (item) => item.expiresAtMs === null || nowGameMs < item.expiresAtMs
        );
      }

      // 3. Relocate linked portals every 25s (only when neither snake occupies a portal tile)
      if (
        modeRef.current === 'arcade' &&
        levelRef.current >= 2 &&
        portalsRef.current &&
        nowGameMs - portalsRef.current.relocatedAtMs >= PORTAL_RELOCATE_INTERVAL_MS
      ) {
        const pA = pointKey(portalsRef.current.a);
        const pB = pointKey(portalsRef.current.b);
        const occupied =
          snakeRef.current.some((s) => {
            const k = pointKey(s);
            return k === pA || k === pB;
          }) ||
          (aiRef.current.alive &&
            aiRef.current.segments.some((s) => {
              const k = pointKey(s);
              return k === pA || k === pB;
            }));

        if (!occupied) {
          const nextPair = findSafePortalPair(buildSpawnContext(), nowGameMs);
          if (nextPair) {
            portalsRef.current = nextPair;
          }
        }
      }

      // 4. Sudden Death Shrinking Arena (Level 5+ in Arcade Mode)
      if (modeRef.current === 'arcade' && levelRef.current >= 5) {
        const shrink = shrinkRef.current;
        if (
          !shrink.telegraphing &&
          shrink.ringDepth < MAX_SHRINK_RING_DEPTH &&
          shrink.nextShrinkAtMs > 0 &&
          nowGameMs >= shrink.nextShrinkAtMs
        ) {
          shrink.telegraphing = true;
          shrink.telegraphEndsAtMs = nowGameMs + SHRINK_TELEGRAPH_MS;
          showToast('SUDDEN DEATH', 'OUTER RING CLOSING!', 'rose');
          audioEngine.playShrinkWarning();
        } else if (shrink.telegraphing && nowGameMs >= shrink.telegraphEndsAtMs) {
          shrink.ringDepth = Math.min(MAX_SHRINK_RING_DEPTH, shrink.ringDepth + 1);
          shrink.telegraphing = false;
          shrink.nextShrinkAtMs =
            shrink.ringDepth < MAX_SHRINK_RING_DEPTH ? nowGameMs + SHRINK_INTERVAL_MS : 0;

          triggerShake();

          // Relocate trapped entities inward
          const depth = shrink.ringDepth;
          obstaclesRef.current.active = obstaclesRef.current.active.filter(
            (o) => !isHazardTile(o, depth)
          );
          if (foodRef.current && isHazardTile(foodRef.current, depth)) {
            foodRef.current = findSafeEmptyTile(buildSpawnContext());
          }
          specialItemsRef.current = specialItemsRef.current.filter(
            (it) => !isHazardTile(it.pos, depth)
          );
          bonusPelletsRef.current = bonusPelletsRef.current.filter(
            (p) => !isHazardTile(p.pos, depth)
          );
          if (
            portalsRef.current &&
            (isHazardTile(portalsRef.current.a, depth) ||
              isHazardTile(portalsRef.current.b, depth))
          ) {
            portalsRef.current = findSafePortalPair(buildSpawnContext(), nowGameMs);
          }

          // Check if player head got caught in newly electrified ring
          const head = snakeRef.current[0];
          const isGhost = effectsRef.current.ghostEndsAtMs > nowGameMs;
          if (head && isHazardTile(head, depth) && !isGhost) {
            triggerGameOver();
          }
        }
      }

      // 5. Rival AI 6-second telegraphed respawn in Duel Mode
      if (modeRef.current === 'duel' && !aiRef.current.alive && aiRef.current.respawnAtMs > 0) {
        const remaining = aiRef.current.respawnAtMs - nowGameMs;
        if (remaining <= 1800 && remaining > 0 && !aiRef.current.spawnPreview) {
          const preview = findAiSpawnState(
            snakeRef.current,
            obstaclesRef.current.active,
            shrinkRef.current.ringDepth
          );
          if (preview) {
            aiRef.current.spawnPreview = preview.segments;
            aiRef.current.direction = preview.direction;
          }
        } else if (remaining <= 0) {
          const spawn = aiRef.current.spawnPreview
            ? { segments: aiRef.current.spawnPreview, direction: aiRef.current.direction }
            : findAiSpawnState(
                snakeRef.current,
                obstaclesRef.current.active,
                shrinkRef.current.ringDepth
              );

          if (spawn) {
            // Confirm preview tiles weren't occupied by player right as it spawned
            const playerKeys = new Set(snakeRef.current.map(pointKey));
            const safe = spawn.segments.every((s) => !playerKeys.has(pointKey(s)));
            if (safe) {
              aiRef.current = {
                segments: spawn.segments,
                direction: spawn.direction,
                alive: true,
                respawnAtMs: 0,
                spawnPreview: null,
              };
            } else {
              // Retry briefly 500ms later
              aiRef.current.respawnAtMs = nowGameMs + 500;
              aiRef.current.spawnPreview = null;
            }
          }
        }
      }
    };

    const frame = (now: number) => {
      const dtMs = Math.min(100, Math.max(0, now - lastTimestamp));
      lastTimestamp = now;
      const dtSec = dtMs / 1000;
      const cellSize = boardSizeRef.current / GRID_SIZE;

      if (statusRef.current === 'PLAYING') {
        gameTimeMsRef.current += dtMs;
        const gNow = gameTimeMsRef.current;

        updateArenaTimers(gNow);

        // Tail-Burn Boost logic (2x speed, sheds 1 tail segment every 1.0s, stops at length 3)
        const activeBoost =
          boostHeldRef.current &&
          snakeRef.current.length > MIN_SNAKE_LENGTH &&
          statusRef.current === 'PLAYING';

        if (activeBoost) {
          boostBurnAccMsRef.current += dtMs;
          // Emit fiery tail exhaust sparks
          if (!reducedMotionRef.current && Math.random() < 0.35 && snakeRef.current.length > 1) {
            const tail = snakeRef.current[snakeRef.current.length - 1];
            particlesRef.current.push({
              x: (tail.x + 0.5) * cellSize + (Math.random() - 0.5) * 6,
              y: (tail.y + 0.5) * cellSize + (Math.random() - 0.5) * 6,
              vx: (Math.random() - 0.5) * cellSize * 1.4,
              vy: (Math.random() - 0.5) * cellSize * 1.4,
              life: 0,
              maxLife: 0.22,
              color: Math.random() > 0.5 ? '#F97316' : '#FDE047',
              size: Math.max(2, cellSize * 0.13),
            });
          }

          if (boostBurnAccMsRef.current >= BOOST_BURN_INTERVAL_MS) {
            boostBurnAccMsRef.current -= BOOST_BURN_INTERVAL_MS;
            if (snakeRef.current.length > MIN_SNAKE_LENGTH) {
              const shed = snakeRef.current.pop()!;
              particlesRef.current.push(
                ...createBurstParticles(shed, cellSize, ['#F97316', '#FDE047', '#EF4444'], 10)
              );
              audioEngine.playBoostBurn();
              setCanBoost(snakeRef.current.length > MIN_SNAKE_LENGTH);
            }
          }
        } else {
          boostBurnAccMsRef.current = 0;
        }

        // Compute effective player tick interval (Base * Chrono 2x / Boost 2x)
        const baseTickMs = getTickMsForLevel(levelRef.current);
        const chronoActive = effectsRef.current.chronoEndsAtMs > gNow;
        let playerTickMs = baseTickMs;
        if (chronoActive) playerTickMs *= 2;
        if (activeBoost) playerTickMs *= 0.5;

        playerTickAcc += dtMs;
        let playerSteps = 0;
        while (playerTickAcc >= playerTickMs && statusRef.current === 'PLAYING' && playerSteps < 2) {
          playerTickAcc -= playerTickMs;
          stepPlayer(gNow);
          playerSteps++;
        }
        if (playerSteps >= 2 && playerTickAcc > playerTickMs) {
          playerTickAcc = 0;
        }

        // Duel Mode AI tick (unaffected by player boost so player can outpace & cut off AI)
        if (modeRef.current === 'duel' && statusRef.current === 'PLAYING') {
          const aiTickMs = chronoActive ? baseTickMs * 1.65 : baseTickMs * 1.05;
          aiTickAcc += dtMs;
          let aiSteps = 0;
          while (aiTickAcc >= aiTickMs && statusRef.current === 'PLAYING' && aiSteps < 2) {
            aiTickAcc -= aiTickMs;
            stepAi(gNow);
            aiSteps++;
          }
        }

        // Reset expired combo multiplier
        if (comboMultiplierRef.current > 1 && gNow >= comboEndsAtMsRef.current) {
          comboMultiplierRef.current = 1;
          setComboMultiplier(1);
        }

        // Sync smooth HUD bars/timers at ~20Hz to keep React renders light
        hudSyncAcc += dtMs;
        if (hudSyncAcc >= 50) {
          hudSyncAcc = 0;
          const remainingCombo = Math.max(0, comboEndsAtMsRef.current - gNow);
          setComboRatio(remainingCombo / COMBO_WINDOW_MS);
          setIsBoosting(activeBoost);
          setActiveEffects({
            ghostRemainingMs: Math.max(0, effectsRef.current.ghostEndsAtMs - gNow),
            chronoRemainingMs: Math.max(0, effectsRef.current.chronoEndsAtMs - gNow),
            glitchRemainingMs: Math.max(0, effectsRef.current.glitchEndsAtMs - gNow),
          });
        }
      } else {
        playerTickAcc = 0;
        aiTickAcc = 0;
      }

      // Smoothly lerp head position for Flashlight Mode beam
      if (snakeRef.current.length > 0) {
        const targetX = (snakeRef.current[0].x + 0.5) * cellSize;
        const targetY = (snakeRef.current[0].y + 0.5) * cellSize;
        const dx = targetX - smoothHeadRef.current.x;
        const dy = targetY - smoothHeadRef.current.y;
        // Snap immediately if warped via portal/edge wrap
        if (Math.hypot(dx, dy) > cellSize * 3.5) {
          smoothHeadRef.current = { x: targetX, y: targetY };
        } else {
          const lerpFactor = Math.min(1, dtSec * 16);
          smoothHeadRef.current = {
            x: smoothHeadRef.current.x + dx * lerpFactor,
            y: smoothHeadRef.current.y + dy * lerpFactor,
          };
        }
      }

      // Ambient rising ember particles in Lava Magma theme
      if (themeIdRef.current === 'lava' && !reducedMotionRef.current) {
        lavaEmberAcc += dtMs;
        if (lavaEmberAcc >= 170) {
          lavaEmberAcc = 0;
          particlesRef.current.push({
            x: Math.random() * boardSizeRef.current,
            y: boardSizeRef.current + 4,
            vx: (Math.random() - 0.5) * 18,
            vy: -(24 + Math.random() * 34),
            life: 0,
            maxLife: 1.8 + Math.random() * 1.1,
            color: Math.random() > 0.4 ? '#F97316' : '#FDE047',
            size: 1.8 + Math.random() * 1.6,
            ambient: true,
          });
        }
      }

      // Update Particles
      if (particlesRef.current.length > 0) {
        const alive: Particle[] = [];
        for (const p of particlesRef.current) {
          p.life += dtSec;
          if (p.life < p.maxLife) {
            p.x += p.vx * dtSec;
            p.y += p.vy * dtSec;
            if (!p.ambient) {
              p.vx *= 0.94;
              p.vy *= 0.94;
            }
            alive.push(p);
          }
        }
        particlesRef.current = alive;
      }

      // Update Floating Texts
      if (floatingTextsRef.current.length > 0) {
        floatingTextsRef.current = floatingTextsRef.current.filter((ft) => {
          ft.life += dtSec;
          return ft.life < ft.maxLife;
        });
      }

      // Decay Collision Flash
      if (collisionFlashRef.current > 0) {
        collisionFlashRef.current = Math.max(0, collisionFlashRef.current - dtSec * 1.2);
      }

      // Render crisp HiDPI Canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const size = boardSizeRef.current;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pixelSize = Math.round(size * dpr);

        if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
          canvas.width = pixelSize;
          canvas.height = pixelSize;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          renderGameFrame({
            ctx,
            canvasSize: size,
            theme: THEME_MAP[themeIdRef.current],
            mode: modeRef.current,
            snake: snakeRef.current,
            direction: directionRef.current,
            smoothHeadPos: smoothHeadRef.current,
            ai: aiRef.current,
            food: foodRef.current,
            specialItems: specialItemsRef.current,
            bonusPellets: bonusPelletsRef.current,
            portals: portalsRef.current,
            obstacles: obstaclesRef.current,
            shrink: shrinkRef.current,
            effects: effectsRef.current,
            isBoosting:
              boostHeldRef.current &&
              snakeRef.current.length > MIN_SNAKE_LENGTH &&
              statusRef.current === 'PLAYING',
            particles: particlesRef.current,
            floatingTexts: floatingTextsRef.current,
            nowMs: gameTimeMsRef.current > 0 ? gameTimeMsRef.current : now,
            reducedMotion: reducedMotionRef.current,
            collisionFlashAlpha: collisionFlashRef.current,
          });
        }
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    awardScore,
    buildSpawnContext,
    scheduleLevelObstacles,
    showToast,
    spawnFloatingText,
    triggerShake,
  ]);

  // Dynamic canvas frame border glow matching active power-up effects
  const mobileHudMaxWidth = Math.max(boardSize + 4, 340);
  let boardBorderClasses = 'border-slate-800 shadow-[0_16px_48px_rgba(0,0,0,0.55)]';
  if (activeEffects.glitchRemainingMs > 0) {
    boardBorderClasses = 'border-purple-500 shadow-[0_0_28px_rgba(168,85,247,0.45)]';
  } else if (activeEffects.chronoRemainingMs > 0) {
    boardBorderClasses = 'border-blue-400 shadow-[0_0_28px_rgba(96,165,250,0.42)]';
  } else if (activeEffects.ghostRemainingMs > 0) {
    boardBorderClasses = 'border-sky-300 shadow-[0_0_28px_rgba(186,230,253,0.4)]';
  } else if (themeId === 'nokia') {
    boardBorderClasses = 'border-[#306230] shadow-[0_16px_44px_rgba(0,0,0,0.55)]';
  } else if (themeId === 'cyberpunk') {
    boardBorderClasses = 'border-fuchsia-500/60 shadow-[0_0_32px_rgba(192,38,211,0.3)]';
  } else if (themeId === 'lava') {
    boardBorderClasses = 'border-orange-600/70 shadow-[0_0_32px_rgba(234,88,12,0.3)]';
  }

  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-[#090D16] flex flex-col items-center justify-between px-3 py-2 sm:px-6 sm:py-4">
      <div className="w-full h-full md:max-w-[600px] flex flex-col items-center justify-between gap-2 sm:gap-3 min-h-0">
        {/* Top Game HUD + Combo Bar + Active Effect Countdown Strip */}
        <div
          className="w-full max-w-[var(--mobile-hud-max)] md:max-w-[600px] shrink-0"
          style={{ ['--mobile-hud-max' as string]: `${mobileHudMaxWidth}px` }}
        >
          <GameHud
            score={score}
            highScore={highScore}
            level={level}
            status={status}
            mode={mode}
            muted={muted}
            comboMultiplier={comboMultiplier}
            comboRatio={comboRatio}
            activeEffects={activeEffects}
            isBoosting={isBoosting}
            canBoost={canBoost}
            onTogglePause={togglePause}
            onToggleMute={toggleMute}
          />
        </div>

        {/* Center Responsive Square Canvas Stage */}
        <div
          ref={boardStageRef}
          className="flex-1 min-h-0 w-full flex items-center justify-center"
        >
          <div
            className={`relative rounded-xl overflow-hidden border-2 bg-[#0D1321] transition-[border-color,box-shadow] duration-200 ${boardBorderClasses} ${
              isShaking ? 'animate-board-shake' : ''
            }`}
            style={{
              width: `${boardSize + 4}px`,
              height: `${boardSize + 4}px`,
            }}
          >
            <canvas
              ref={canvasRef}
              aria-label="Snake game board"
              className="block"
              style={{
                width: `${boardSize}px`,
                height: `${boardSize}px`,
              }}
            />

            <BoardOverlays
              status={status}
              mode={mode}
              themeId={themeId}
              score={score}
              highScore={highScore}
              highestLevel={highestLevel}
              bestCombo={bestCombo}
              isNewHighScore={isNewHighScore}
              startingLevel={startingLevel}
              toast={toast}
              onSelectMode={handleSelectMode}
              onSelectTheme={handleSelectTheme}
              onSelectStartingLevel={handleSelectStartingLevel}
              onOpenGuide={() => setGuideOpen(true)}
              onStartNewGame={startNewGame}
              onResumeGame={togglePause}
              onReturnToMenu={returnToMenu}
            />
          </div>
        </div>

        {/* Bottom Controls: D-pad + BOOST on mobile/touch, concise keyboard legend on desktop */}
        <MobileControls
          onDirection={enqueueDirection}
          onBoostChange={setBoostHeld}
          isBoosting={isBoosting}
          canBoost={canBoost}
          disabled={status !== 'PLAYING'}
          forceShow={isTouchDevice}
        />

        {!isTouchDevice && (
          <footer className="hidden md:flex items-center justify-center gap-3 text-xs text-slate-400 shrink-0 pb-0.5 whitespace-nowrap">
            <span>Arrows/WASD: Move</span>
            <span className="text-slate-700" aria-hidden="true">
              •
            </span>
            <span>Shift: Boost</span>
            <span className="text-slate-700" aria-hidden="true">
              •
            </span>
            <span>Space/P: Pause</span>
          </footer>
        )}
      </div>

      {/* Power-Ups & Controls Guide Modal */}
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </main>
  );
}
