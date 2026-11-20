import type { LevelPreset } from './types';

export const GRID_SIZE = 20;
export const POINTS_PER_FOOD = 10;
export const POINTS_PER_LEVEL = 50;
export const MAX_INPUT_QUEUE = 3;

export const HIGH_SCORE_STORAGE_KEY = 'snake_arcade_high_score_v1';
export const MUTE_STORAGE_KEY = 'snake_arcade_muted_v1';

export const STARTING_LEVEL_PRESETS: LevelPreset[] = [
  { level: 1, label: 'Level 1', speedLabel: 'Classic', tickMs: 160 },
  { level: 2, label: 'Level 2', speedLabel: 'Brisk', tickMs: 135 },
  { level: 3, label: 'Level 3', speedLabel: 'Fast', tickMs: 110 },
  { level: 4, label: 'Level 4', speedLabel: 'Rapid', tickMs: 90 },
  { level: 5, label: 'Level 5', speedLabel: 'Expert', tickMs: 75 },
];

/**
 * Progressive speed curve matching:
 * Level 1: 160ms
 * Level 2: 135ms
 * Level 3: 110ms
 * Level 4: 90ms
 * Level 5: 75ms
 * Level 6+: steps down by 5ms per level, capping at a playable 55ms minimum.
 */
export function getTickMsForLevel(level: number): number {
  if (level <= 1) return 160;
  if (level === 2) return 135;
  if (level === 3) return 110;
  if (level === 4) return 90;
  if (level === 5) return 75;
  return Math.max(55, 75 - (level - 5) * 5);
}

/**
 * Calculates current level from starting level and earned score.
 * Starting at Level 1 yields:
 * 0–40 -> Level 1
 * 50–90 -> Level 2
 * 100–140 -> Level 3
 * 150–190 -> Level 4
 * 200+ -> Level 5+
 */
export function getLevelForScore(score: number, startingLevel: number): number {
  return startingLevel + Math.floor(score / POINTS_PER_LEVEL);
}

export const BOARD_COLORS = {
  tileDark: '#0D1321',
  tileLight: '#101829',
  gridBorder: '#1E293B',
  snakeHead: '#4ADE80',
  snakeHeadHighlight: '#BBF7D0',
  snakeHeadBorder: '#15803D',
  snakeEye: '#052E16',
  snakeBodyStart: '#22C55E',
  snakeBodyEnd: '#15803D',
  foodCore: '#F43F5E',
  foodHighlight: '#FDA4AF',
  foodGlow: 'rgba(244, 63, 94, 0.32)',
  foodStem: '#34D399',
  collisionFlash: 'rgba(244, 63, 94, 0.22)',
};
