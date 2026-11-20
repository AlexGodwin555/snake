import { GRID_SIZE } from '../constants/levels';
import type { BonusPellet, Direction, Point, PortalPair, SpecialItem } from '../types/game';

export interface SafeSpawnContext {
  playerSnake: Point[];
  playerDir: Direction;
  aiSnake?: Point[];
  aiDir?: Direction;
  obstacles: Point[];
  telegraphingObstacles: Point[];
  hazardDepth: number;
  food: Point | null;
  specialItems: SpecialItem[];
  bonusPellets: BonusPellet[];
  portals: PortalPair | null;
  extraExcluded?: Point[];
  minEdgeMargin?: number;
}

export function isOppositeDirection(a: Direction, b: Direction): boolean {
  return (
    (a === 'UP' && b === 'DOWN') ||
    (a === 'DOWN' && b === 'UP') ||
    (a === 'LEFT' && b === 'RIGHT') ||
    (a === 'RIGHT' && b === 'LEFT')
  );
}

export function invertDirection(dir: Direction): Direction {
  switch (dir) {
    case 'UP':
      return 'DOWN';
    case 'DOWN':
      return 'UP';
    case 'LEFT':
      return 'RIGHT';
    case 'RIGHT':
      return 'LEFT';
  }
}

export function getDirectionDelta(direction: Direction): Point {
  switch (direction) {
    case 'UP':
      return { x: 0, y: -1 };
    case 'DOWN':
      return { x: 0, y: 1 };
    case 'LEFT':
      return { x: -1, y: 0 };
    case 'RIGHT':
      return { x: 1, y: 0 };
  }
}

export function pointKey(p: Point): string {
  return `${p.x},${p.y}`;
}

export function isHazardTile(p: Point, hazardDepth: number): boolean {
  if (hazardDepth <= 0) return false;
  return (
    p.x < hazardDepth ||
    p.x >= GRID_SIZE - hazardDepth ||
    p.y < hazardDepth ||
    p.y >= GRID_SIZE - hazardDepth
  );
}

export function isInsidePlayableBounds(p: Point, hazardDepth: number): boolean {
  return (
    p.x >= hazardDepth &&
    p.x < GRID_SIZE - hazardDepth &&
    p.y >= hazardDepth &&
    p.y < GRID_SIZE - hazardDepth
  );
}

/**
 * Single safe-spawning utility guaranteeing new entities never spawn on:
 * - Player snake or Rival AI snake
 * - Active or telegraphing obstacles
 * - Electrified hazard borders
 * - Existing food, special items, bonus pellets, or portals
 * - Within 3 tiles directly in front of either snake's head
 */
export function findSafeEmptyTile(ctx: SafeSpawnContext): Point | null {
  const hardBlocked = new Set<string>();
  const frontBlocked = new Set<string>();

  for (const seg of ctx.playerSnake) hardBlocked.add(pointKey(seg));
  if (ctx.aiSnake) {
    for (const seg of ctx.aiSnake) hardBlocked.add(pointKey(seg));
  }
  for (const obs of ctx.obstacles) hardBlocked.add(pointKey(obs));
  for (const obs of ctx.telegraphingObstacles) hardBlocked.add(pointKey(obs));
  if (ctx.food) hardBlocked.add(pointKey(ctx.food));
  for (const item of ctx.specialItems) hardBlocked.add(pointKey(item.pos));
  for (const pellet of ctx.bonusPellets) hardBlocked.add(pointKey(pellet.pos));
  if (ctx.portals) {
    hardBlocked.add(pointKey(ctx.portals.a));
    hardBlocked.add(pointKey(ctx.portals.b));
  }
  if (ctx.extraExcluded) {
    for (const p of ctx.extraExcluded) hardBlocked.add(pointKey(p));
  }

  // Mark 3 tiles directly ahead of player head
  if (ctx.playerSnake.length > 0) {
    const head = ctx.playerSnake[0];
    const delta = getDirectionDelta(ctx.playerDir);
    for (let step = 1; step <= 3; step++) {
      frontBlocked.add(`${head.x + delta.x * step},${head.y + delta.y * step}`);
    }
  }

  // Mark 3 tiles directly ahead of AI head
  if (ctx.aiSnake && ctx.aiSnake.length > 0 && ctx.aiDir) {
    const head = ctx.aiSnake[0];
    const delta = getDirectionDelta(ctx.aiDir);
    for (let step = 1; step <= 3; step++) {
      frontBlocked.add(`${head.x + delta.x * step},${head.y + delta.y * step}`);
    }
  }

  const margin = Math.max(ctx.hazardDepth, ctx.minEdgeMargin ?? 0);
  const preferredCandidates: Point[] = [];
  const fallbackCandidates: Point[] = [];

  for (let y = margin; y < GRID_SIZE - margin; y++) {
    for (let x = margin; x < GRID_SIZE - margin; x++) {
      const key = `${x},${y}`;
      if (hardBlocked.has(key)) continue;
      if (!frontBlocked.has(key)) {
        preferredCandidates.push({ x, y });
      } else {
        fallbackCandidates.push({ x, y });
      }
    }
  }

  if (preferredCandidates.length > 0) {
    return preferredCandidates[Math.floor(Math.random() * preferredCandidates.length)];
  }

  // If margin excluded everything, try full playable area without front-buffer restriction
  if (fallbackCandidates.length > 0) {
    return fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)];
  }

  if (margin > ctx.hazardDepth) {
    for (let y = ctx.hazardDepth; y < GRID_SIZE - ctx.hazardDepth; y++) {
      for (let x = ctx.hazardDepth; x < GRID_SIZE - ctx.hazardDepth; x++) {
        if (!hardBlocked.has(`${x},${y}`)) {
          fallbackCandidates.push({ x, y });
        }
      }
    }
    if (fallbackCandidates.length > 0) {
      return fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)];
    }
  }

  return null;
}

/**
 * Safely spawns a linked portal pair on opposite quadrants of the playable arena,
 * keeping a 1-tile inset from walls/hazards so exiting in any direction is fair.
 */
export function findSafePortalPair(ctx: SafeSpawnContext, nowMs: number): PortalPair | null {
  const margin = Math.min(Math.max(ctx.hazardDepth + 1, 2), Math.floor(GRID_SIZE / 2) - 2);
  const baseCtx: SafeSpawnContext = {
    ...ctx,
    portals: null,
    minEdgeMargin: margin,
  };

  const first = findSafeEmptyTile(baseCtx);
  if (!first) return null;

  // Attempt up to 24 picks to place Portal B in the opposite quadrant with comfortable separation
  const mid = GRID_SIZE / 2;
  let bestSecond: Point | null = null;
  let bestDist = -1;

  for (let attempt = 0; attempt < 24; attempt++) {
    const candidate = findSafeEmptyTile({
      ...baseCtx,
      extraExcluded: [...(ctx.extraExcluded ?? []), first],
    });
    if (!candidate) break;

    const oppositeX = (first.x < mid && candidate.x >= mid) || (first.x >= mid && candidate.x < mid);
    const oppositeY = (first.y < mid && candidate.y >= mid) || (first.y >= mid && candidate.y < mid);
    const dist = Math.abs(first.x - candidate.x) + Math.abs(first.y - candidate.y);

    if (oppositeX && oppositeY && dist >= 7) {
      return { a: first, b: candidate, relocatedAtMs: nowMs };
    }
    if (dist > bestDist) {
      bestDist = dist;
      bestSecond = candidate;
    }
  }

  if (!bestSecond || bestDist < 4) return null;
  return { a: first, b: bestSecond, relocatedAtMs: nowMs };
}
