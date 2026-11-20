import type { GameMode, LevelPreset, Point } from '../types/game';

export const GRID_SIZE = 20;
export const POINTS_PER_FOOD = 10;
export const POINTS_GOLDEN_APPLE = 50;
export const POINTS_BONUS_PELLET = 15;
export const POINTS_NEAR_MISS = 5;
export const POINTS_PER_LEVEL = 60;
export const MAX_INPUT_QUEUE = 3;

export const MIN_SNAKE_LENGTH = 3;
export const COMBO_WINDOW_MS = 4000;
export const MAX_COMBO_MULTIPLIER = 5;
export const BOOST_BURN_INTERVAL_MS = 1000;
export const NEAR_MISS_COOLDOWN_MS = 1000;

export const GOLDEN_APPLE_DURATION_MS = 5000;
export const GLITCH_ITEM_DURATION_MS = 10000;
export const GHOST_EFFECT_DURATION_MS = 5000;
export const CHRONO_EFFECT_DURATION_MS = 6000;
export const GLITCH_EFFECT_DURATION_MS = 5000;

export const OBSTACLE_TELEGRAPH_MS = 2000;
export const PORTAL_RELOCATE_INTERVAL_MS = 25000;
export const SHRINK_INTERVAL_MS = 20000;
export const SHRINK_TELEGRAPH_MS = 3000;
export const MAX_SHRINK_RING_DEPTH = 6; // Leaves 8x8 playable center on 20x20 grid (20 - 12 = 8)
export const AI_RESPAWN_DELAY_MS = 6000;

export const HIGH_SCORE_STORAGE_KEY = 'snake_arcade_high_score_v1';
export const MUTE_STORAGE_KEY = 'snake_arcade_muted_v1';
export const THEME_STORAGE_KEY = 'snake_arcade_theme_v1';

export const STARTING_LEVEL_PRESETS: LevelPreset[] = [
  { level: 1, label: 'Level 1', speedLabel: 'Classic', tickMs: 160 },
  { level: 2, label: 'Level 2', speedLabel: 'Brisk', tickMs: 135 },
  { level: 3, label: 'Level 3', speedLabel: 'Fast', tickMs: 110 },
  { level: 4, label: 'Level 4', speedLabel: 'Rapid', tickMs: 90 },
  { level: 5, label: 'Level 5', speedLabel: 'Expert', tickMs: 75 },
];

export function getTickMsForLevel(level: number): number {
  if (level <= 1) return 160;
  if (level === 2) return 135;
  if (level === 3) return 110;
  if (level === 4) return 90;
  if (level === 5) return 75;
  return Math.max(55, 75 - (level - 5) * 5);
}

export function getLevelForScore(score: number, startingLevel: number): number {
  return startingLevel + Math.floor(score / POINTS_PER_LEVEL);
}

/**
 * Generates level-specific obstacle layouts:
 * - Level 1: Open arena
 * - Level 2: Four L-shaped corner blocks inset 2 tiles from edges
 * - Level 3: Central cross/plus barrier with wide passable corridors around it
 * - Level 4: Staggered horizontal & vertical corridor walls creating choke points
 * - Level 5+: Inset corner blocks that naturally give way as outer Sudden Death rings close in
 * Duel and Flashlight modes use lighter obstacles on Level 2+ for readability & fairness.
 */
export function getLevelObstacles(level: number, mode: GameMode): Point[] {
  if (level <= 1) return [];

  if (mode === 'flashlight' || mode === 'duel') {
    if (level === 2) {
      return [
        { x: 3, y: 3 },
        { x: 16, y: 3 },
        { x: 3, y: 16 },
        { x: 16, y: 16 },
      ];
    }
    if (level === 3) {
      return [
        { x: 9, y: 8 },
        { x: 10, y: 8 },
        { x: 9, y: 11 },
        { x: 10, y: 11 },
      ];
    }
    return [
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 14, y: 4 },
      { x: 15, y: 4 },
      { x: 4, y: 15 },
      { x: 5, y: 15 },
      { x: 14, y: 15 },
      { x: 15, y: 15 },
    ];
  }

  // Arcade mode full dynamic obstacle sets
  if (level === 2 || level >= 5) {
    // Four L-shaped corner blocks inset 2 tiles from edges
    return [
      // Top-left L
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 2, y: 3 },
      { x: 2, y: 4 },
      // Top-right L
      { x: 17, y: 2 },
      { x: 16, y: 2 },
      { x: 15, y: 2 },
      { x: 17, y: 3 },
      { x: 17, y: 4 },
      // Bottom-left L
      { x: 2, y: 17 },
      { x: 3, y: 17 },
      { x: 4, y: 17 },
      { x: 2, y: 16 },
      { x: 2, y: 15 },
      // Bottom-right L
      { x: 17, y: 17 },
      { x: 16, y: 17 },
      { x: 15, y: 17 },
      { x: 17, y: 16 },
      { x: 17, y: 15 },
    ];
  }

  if (level === 3) {
    // Central cross/plus barrier with wide 6-tile passable corridors around it
    const pts: Point[] = [];
    for (let y = 6; y <= 13; y++) {
      pts.push({ x: 9, y }, { x: 10, y });
    }
    for (let x = 6; x <= 13; x++) {
      if (x === 9 || x === 10) continue;
      pts.push({ x, y: 9 }, { x, y: 10 });
    }
    return pts;
  }

  // Level 4: Staggered horizontal and vertical corridor walls creating narrow choke points
  const pts: Point[] = [];
  // Upper-left horizontal wall
  for (let x = 3; x <= 8; x++) pts.push({ x, y: 5 });
  // Lower-right horizontal wall
  for (let x = 11; x <= 16; x++) pts.push({ x, y: 14 });
  // Upper-right vertical wall
  for (let y = 3; y <= 8; y++) pts.push({ x: 14, y });
  // Lower-left vertical wall
  for (let y = 11; y <= 16; y++) pts.push({ x: 5, y });
  return pts;
}

export function createInitialPlayerSnake(startingLevel: number, mode: GameMode): Point[] {
  if (mode === 'duel') {
    // Start cleanly on the left side facing right, opposite the Rival AI on the right
    return [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 },
    ];
  }

  // When starting directly on Level 3 (central cross) or Level 4 (corridors), spawn in an open upper lane
  if (startingLevel === 3 || startingLevel === 4) {
    return [
      { x: 6, y: 2 },
      { x: 5, y: 2 },
      { x: 4, y: 2 },
    ];
  }

  const centerY = Math.floor(GRID_SIZE / 2);
  const startX = Math.floor(GRID_SIZE / 2) - 1;
  return [
    { x: startX, y: centerY },
    { x: startX - 1, y: centerY },
    { x: startX - 2, y: centerY },
  ];
}
