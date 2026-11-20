export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type GameStatus = 'START' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'VICTORY';

export interface Point {
  x: number;
  y: number;
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
}

export interface LevelPreset {
  level: number;
  label: string;
  speedLabel: string;
  tickMs: number;
}
