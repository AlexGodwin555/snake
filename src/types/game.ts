export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type GameMode = 'arcade' | 'flashlight' | 'duel';

export type ThemeId = 'midnight' | 'nokia' | 'cyberpunk' | 'lava';

export type GameStatus = 'START' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'VICTORY';

export type SpecialItemType = 'shrink' | 'golden' | 'ghost' | 'chrono' | 'glitch';

export interface Point {
  x: number;
  y: number;
}

export interface SpecialItem {
  id: number;
  type: SpecialItemType;
  pos: Point;
  spawnedAtMs: number;
  durationMs: number | null; // null if no expiry timer
  expiresAtMs: number | null;
}

export interface BonusPellet {
  pos: Point;
  points: number;
}

export interface PortalPair {
  a: Point;
  b: Point;
  relocatedAtMs: number;
}

export interface ActiveEffects {
  ghostEndsAtMs: number;
  chronoEndsAtMs: number;
  glitchEndsAtMs: number;
}

export interface ObstacleState {
  active: Point[];
  telegraphing: Point[];
  telegraphEndsAtMs: number;
}

export interface ShrinkState {
  ringDepth: number; // Number of outermost rings converted to electrified hazards
  telegraphing: boolean;
  telegraphEndsAtMs: number;
  nextShrinkAtMs: number;
}

export interface AiSnakeState {
  segments: Point[];
  direction: Direction;
  alive: boolean;
  respawnAtMs: number;
  spawnPreview: Point[] | null;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  ambient?: boolean;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface LevelPreset {
  level: number;
  label: string;
  speedLabel: string;
  tickMs: number;
}

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  shortName: string;
  unlockScore: number;
  pixelated?: boolean;
  bloom?: boolean;
  lavaCracks?: boolean;
  audioStyle: 'modern' | 'chiptune';
  swatchBg: string;
  swatchSnake: string;
  swatchFood: string;
  board: {
    tileDark: string;
    tileLight: string;
    gridLine?: string;
    snakeHead: string;
    snakeHeadHighlight: string;
    snakeHeadBorder: string;
    snakeEye: string;
    snakeBodyStart: [number, number, number];
    snakeBodyEnd: [number, number, number];
    foodCore: string;
    foodHighlight: string;
    foodGlow: string;
    foodStem: string;
    obstacleFill: string;
    obstacleBorder: string;
    obstacleHighlight: string;
    aiHead: string;
    aiBodyStart: [number, number, number];
    aiBodyEnd: [number, number, number];
  };
}

export interface ActiveEffectsSnapshot {
  ghostRemainingMs: number;
  chronoRemainingMs: number;
  glitchRemainingMs: number;
}

export interface ToastNotice {
  id: number;
  title: string;
  subtitle?: string;
  tone: 'amber' | 'emerald' | 'rose' | 'purple' | 'cyan';
}
