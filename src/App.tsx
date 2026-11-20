import { useCallback, useEffect, useRef, useState } from 'react';
import { BoardOverlays } from './components/BoardOverlays';
import { GameHud } from './components/GameHud';
import { MobileDPad } from './components/MobileDPad';
import {
  getLevelForScore,
  getTickMsForLevel,
  GRID_SIZE,
  HIGH_SCORE_STORAGE_KEY,
  MAX_INPUT_QUEUE,
  MUTE_STORAGE_KEY,
  POINTS_PER_FOOD,
} from './game/constants';
import {
  createEatParticles,
  createInitialSnake,
  getDirectionDelta,
  isOppositeDirection,
  renderBoard,
  spawnFood,
} from './game/engine';
import { soundManager } from './game/sound';
import type { Direction, GameStatus, Particle, Point } from './game/types';

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
    // Ignore storage quota or private browsing errors
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

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

export default function App() {
  // UI state
  const [status, setStatus] = useState<GameStatus>('START');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => loadStoredHighScore());
  const [startingLevel, setStartingLevel] = useState<number>(1);
  const [level, setLevel] = useState<number>(1);
  const [highestLevel, setHighestLevel] = useState<number>(1);
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => {
    const initial = loadStoredMuted();
    soundManager.setMuted(initial);
    return initial;
  });
  const [levelUpBanner, setLevelUpBanner] = useState<{ level: number; key: number } | null>(null);
  const [boardSize, setBoardSize] = useState<number>(400);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => detectTouchDevice());

  // Canvas & layout refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardStageRef = useRef<HTMLDivElement | null>(null);
  const boardSizeRef = useRef<number>(400);

  // Real-time game loop refs (avoids stale closures & keeps 60fps smooth)
  const statusRef = useRef<GameStatus>('START');
  const snakeRef = useRef<Point[]>(createInitialSnake());
  const directionRef = useRef<Direction>('RIGHT');
  const inputQueueRef = useRef<Direction[]>([]);
  const foodRef = useRef<Point | null>(spawnFood(snakeRef.current));
  const particlesRef = useRef<Particle[]>([]);
  const collisionFlashRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const highScoreRef = useRef<number>(highScore);
  const startingLevelRef = useRef<number>(1);
  const levelRef = useRef<number>(1);
  const highestLevelRef = useRef<number>(1);
  const isNewHighScoreRef = useRef<boolean>(false);
  const reducedMotionRef = useRef<boolean>(false);
  const levelUpTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    boardSizeRef.current = boardSize;
  }, [boardSize]);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = motionQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    motionQuery.addEventListener('change', handleMotionChange);

    const pointerQuery = window.matchMedia('(pointer: coarse)');
    const handlePointerChange = () => {
      setIsTouchDevice(detectTouchDevice());
    };
    pointerQuery.addEventListener('change', handlePointerChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      pointerQuery.removeEventListener('change', handlePointerChange);
    };
  }, []);

  // Measure available board stage and snap square canvas cleanly to a multiple of GRID_SIZE
  useEffect(() => {
    const stage = boardStageRef.current;
    if (!stage) return;

    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      // Leave room for the 2px border on each side
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

  const triggerLevelUpNotice = useCallback((newLevel: number) => {
    if (levelUpTimeoutRef.current !== null) {
      window.clearTimeout(levelUpTimeoutRef.current);
    }
    setLevelUpBanner({ level: newLevel, key: Date.now() });
    levelUpTimeoutRef.current = window.setTimeout(() => {
      setLevelUpBanner(null);
      levelUpTimeoutRef.current = null;
    }, 1500);
  }, []);

  const handleSelectStartingLevel = useCallback((nextStartLevel: number) => {
    startingLevelRef.current = nextStartLevel;
    levelRef.current = nextStartLevel;
    setStartingLevel(nextStartLevel);
    setLevel(nextStartLevel);
    soundManager.playToggle();
  }, []);

  const startNewGame = useCallback(() => {
    soundManager.unlock();

    // Release focus from buttons so Spacebar only pauses/resumes during gameplay
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (levelUpTimeoutRef.current !== null) {
      window.clearTimeout(levelUpTimeoutRef.current);
      levelUpTimeoutRef.current = null;
    }

    const freshSnake = createInitialSnake();
    const startLvl = startingLevelRef.current;

    snakeRef.current = freshSnake;
    directionRef.current = 'RIGHT';
    inputQueueRef.current = [];
    foodRef.current = spawnFood(freshSnake);
    particlesRef.current = [];
    collisionFlashRef.current = 0;

    scoreRef.current = 0;
    levelRef.current = startLvl;
    highestLevelRef.current = startLvl;
    isNewHighScoreRef.current = false;
    statusRef.current = 'PLAYING';

    setScore(0);
    setLevel(startLvl);
    setHighestLevel(startLvl);
    setIsNewHighScore(false);
    setLevelUpBanner(null);
    setStatus('PLAYING');
  }, []);

  const togglePause = useCallback(() => {
    if (statusRef.current === 'PLAYING') {
      statusRef.current = 'PAUSED';
      setStatus('PAUSED');
      soundManager.playToggle();
    } else if (statusRef.current === 'PAUSED') {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      statusRef.current = 'PLAYING';
      setStatus('PLAYING');
      soundManager.playToggle();
    }
  }, []);

  const returnToMenu = useCallback(() => {
    if (levelUpTimeoutRef.current !== null) {
      window.clearTimeout(levelUpTimeoutRef.current);
      levelUpTimeoutRef.current = null;
    }
    const freshSnake = createInitialSnake();
    snakeRef.current = freshSnake;
    directionRef.current = 'RIGHT';
    inputQueueRef.current = [];
    foodRef.current = spawnFood(freshSnake);
    particlesRef.current = [];
    collisionFlashRef.current = 0;
    scoreRef.current = 0;
    levelRef.current = startingLevelRef.current;
    statusRef.current = 'START';

    setScore(0);
    setLevel(startingLevelRef.current);
    setLevelUpBanner(null);
    setStatus('START');
    soundManager.playToggle();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundManager.setMuted(next);
      saveStoredMuted(next);
      if (!next) {
        soundManager.unlock();
        soundManager.playToggle();
      }
      return next;
    });
  }, []);

  // Shared direction input queue used by both keyboard & mobile D-pad
  const enqueueDirection = useCallback((nextDirection: Direction) => {
    if (statusRef.current !== 'PLAYING') return;

    soundManager.unlock();

    const queue = inputQueueRef.current;
    const referenceDirection =
      queue.length > 0 ? queue[queue.length - 1] : directionRef.current;

    if (nextDirection === referenceDirection || isOppositeDirection(nextDirection, referenceDirection)) {
      return;
    }

    if (queue.length < MAX_INPUT_QUEUE) {
      queue.push(nextDirection);
    }
  }, []);

  // Keyboard controls & scroll prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const code = e.code;

      // Prevent browser scrolling for arrow keys and spacebar
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

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enqueueDirection, startNewGame, togglePause]);

  // Auto-pause if browser tab becomes hidden during active gameplay
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && statusRef.current === 'PLAYING') {
        statusRef.current = 'PAUSED';
        setStatus('PAUSED');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Cleanup level-up banner timer on unmount
  useEffect(() => {
    return () => {
      if (levelUpTimeoutRef.current !== null) {
        window.clearTimeout(levelUpTimeoutRef.current);
      }
    };
  }, []);

  // Main 60fps render & fixed-timestep gameplay loop
  useEffect(() => {
    let rafId = 0;
    let lastTimestamp = performance.now();
    let tickAccumulator = 0;

    const stepGame = () => {
      const queue = inputQueueRef.current;
      if (queue.length > 0) {
        const nextDir = queue.shift()!;
        if (!isOppositeDirection(nextDir, directionRef.current)) {
          directionRef.current = nextDir;
        }
      }

      const snake = snakeRef.current;
      const head = snake[0];
      const delta = getDirectionDelta(directionRef.current);
      const nextHead: Point = {
        x: head.x + delta.x,
        y: head.y + delta.y,
      };

      // Wall collision check
      if (
        nextHead.x < 0 ||
        nextHead.x >= GRID_SIZE ||
        nextHead.y < 0 ||
        nextHead.y >= GRID_SIZE
      ) {
        statusRef.current = 'GAME_OVER';
        collisionFlashRef.current = 0.28;
        setStatus('GAME_OVER');
        soundManager.playGameOver();
        return;
      }

      const food = foodRef.current;
      const willEat = food !== null && nextHead.x === food.x && nextHead.y === food.y;

      // Self-collision check (tail tip vacates its cell unless growing on this tick)
      const bodyToCheck = willEat ? snake : snake.slice(0, -1);
      const hitSelf = bodyToCheck.some(
        (segment) => segment.x === nextHead.x && segment.y === nextHead.y
      );

      if (hitSelf) {
        statusRef.current = 'GAME_OVER';
        collisionFlashRef.current = 0.28;
        setStatus('GAME_OVER');
        soundManager.playGameOver();
        return;
      }

      const nextSnake = [nextHead, ...snake];
      if (!willEat) {
        nextSnake.pop();
      }

      snakeRef.current = nextSnake;

      if (willEat && food) {
        const cellSize = boardSizeRef.current / GRID_SIZE;
        particlesRef.current = [
          ...particlesRef.current,
          ...createEatParticles(food, cellSize),
        ];

        const nextScore = scoreRef.current + POINTS_PER_FOOD;
        scoreRef.current = nextScore;
        setScore(nextScore);

        if (nextScore > highScoreRef.current) {
          highScoreRef.current = nextScore;
          isNewHighScoreRef.current = true;
          setHighScore(nextScore);
          setIsNewHighScore(true);
          saveStoredHighScore(nextScore);
        }

        const nextLevel = getLevelForScore(nextScore, startingLevelRef.current);
        const leveledUp = nextLevel > levelRef.current;
        if (leveledUp) {
          levelRef.current = nextLevel;
          setLevel(nextLevel);
          if (nextLevel > highestLevelRef.current) {
            highestLevelRef.current = nextLevel;
            setHighestLevel(nextLevel);
          }
          triggerLevelUpNotice(nextLevel);
          soundManager.playLevelUp();
        } else {
          soundManager.playEat();
        }

        const nextFood = spawnFood(nextSnake);
        foodRef.current = nextFood;

        if (!nextFood) {
          statusRef.current = 'VICTORY';
          setStatus('VICTORY');
          soundManager.playLevelUp();
        }
      }
    };

    const frame = (now: number) => {
      const dtMs = Math.min(100, Math.max(0, now - lastTimestamp));
      lastTimestamp = now;
      const dtSec = dtMs / 1000;

      if (statusRef.current === 'PLAYING') {
        const tickMs = getTickMsForLevel(levelRef.current);
        tickAccumulator += dtMs;

        // Advance at most 2 ticks per frame to prevent spiral-of-death on tab lag
        let steps = 0;
        while (tickAccumulator >= tickMs && statusRef.current === 'PLAYING' && steps < 2) {
          tickAccumulator -= tickMs;
          stepGame();
          steps++;
        }
        if (steps >= 2 && tickAccumulator > tickMs) {
          tickAccumulator = 0;
        }
      } else {
        tickAccumulator = 0;
      }

      // Update particles
      if (particlesRef.current.length > 0) {
        const alive: Particle[] = [];
        for (const p of particlesRef.current) {
          p.life += dtSec;
          if (p.life < p.maxLife) {
            p.x += p.vx * dtSec;
            p.y += p.vy * dtSec;
            p.vx *= 0.94;
            p.vy *= 0.94;
            alive.push(p);
          }
        }
        particlesRef.current = alive;
      }

      // Decay collision flash
      if (collisionFlashRef.current > 0) {
        collisionFlashRef.current = Math.max(0, collisionFlashRef.current - dtSec * 1.15);
      }

      // Draw crisp HiDPI canvas
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
          renderBoard({
            ctx,
            canvasSize: size,
            snake: snakeRef.current,
            direction: directionRef.current,
            food: foodRef.current,
            particles: particlesRef.current,
            nowMs: now,
            reducedMotion: reducedMotionRef.current,
            collisionFlashAlpha: collisionFlashRef.current,
          });
        }
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, [triggerLevelUpNotice]);

  // Match mobile HUD width to board while letting desktop (md+) breathe up to 560px
  const mobileHudMaxWidth = Math.max(boardSize + 4, 340);

  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-[#090D16] flex flex-col items-center justify-between px-3 py-2.5 sm:px-6 sm:py-5">
      <div className="w-full h-full md:max-w-[560px] flex flex-col items-center justify-between gap-2.5 sm:gap-3.5 min-h-0">
        {/* Top Game HUD */}
        <div
          className="w-full max-w-[var(--mobile-hud-max)] md:max-w-[560px] shrink-0"
          style={{ ['--mobile-hud-max' as string]: `${mobileHudMaxWidth}px` }}
        >
          <GameHud
            score={score}
            highScore={highScore}
            level={level}
            status={status}
            muted={muted}
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
            className="relative rounded-xl overflow-hidden border-2 border-slate-800 bg-[#0D1321] shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
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
              score={score}
              highScore={highScore}
              highestLevel={highestLevel}
              isNewHighScore={isNewHighScore}
              startingLevel={startingLevel}
              levelUpBanner={levelUpBanner}
              onSelectStartingLevel={handleSelectStartingLevel}
              onStartNewGame={startNewGame}
              onResumeGame={togglePause}
              onReturnToMenu={returnToMenu}
            />
          </div>
        </div>

        {/* Bottom Controls: D-pad on mobile/touch, quiet keyboard legend on desktop */}
        <MobileDPad
          onDirection={enqueueDirection}
          disabled={status !== 'PLAYING'}
          forceShow={isTouchDevice}
        />

        {!isTouchDevice && (
          <footer className="hidden md:flex items-center justify-center gap-3 text-xs text-slate-400 shrink-0 pb-0.5">
            <span>Move: Arrow Keys / WASD</span>
            <span className="text-slate-700" aria-hidden="true">
              ·
            </span>
            <span>Pause: Space / P</span>
            <span className="text-slate-700" aria-hidden="true">
              ·
            </span>
            <span>Speed increases every 50 pts</span>
          </footer>
        )}
      </div>
    </main>
  );
}
