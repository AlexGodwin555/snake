import { GRID_SIZE } from '../constants/levels';
import type { BonusPellet, Direction, Point, SpecialItem } from '../types/game';
import { getDirectionDelta, isInsidePlayableBounds, isOppositeDirection, pointKey } from './spawning';

const ALL_DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

interface AiPathContext {
  aiSegments: Point[];
  aiDirection: Direction;
  playerSegments: Point[];
  obstacles: Point[];
  hazardDepth: number;
  food: Point | null;
  specialItems: SpecialItem[];
  bonusPellets: BonusPellet[];
}

function floodFillReachableCount(
  start: Point,
  blocked: Set<string>,
  hazardDepth: number,
  limit: number = 32
): number {
  const visited = new Set<string>([pointKey(start)]);
  const queue: Point[] = [start];
  let idx = 0;

  while (idx < queue.length && visited.size < limit) {
    const curr = queue[idx++];
    for (const dir of ALL_DIRECTIONS) {
      const d = getDirectionDelta(dir);
      const next: Point = { x: curr.x + d.x, y: curr.y + d.y };
      if (!isInsidePlayableBounds(next, hazardDepth)) continue;
      const k = pointKey(next);
      if (blocked.has(k) || visited.has(k)) continue;
      visited.add(k);
      queue.push(next);
    }
  }

  return visited.size;
}

/**
 * Computes the Rival AI's next direction using lightweight BFS toward the nearest
 * desirable target (food, golden apple, or bonus pellet) while avoiding walls,
 * obstacles, hazard borders, own body, and the player's body.
 * Includes slight non-omniscient lookahead so clever player cut-offs can trap and shatter it.
 */
export function computeAiDirection(ctx: AiPathContext): Direction {
  const { aiSegments, aiDirection, playerSegments, obstacles, hazardDepth } = ctx;
  if (aiSegments.length === 0) return aiDirection;

  const head = aiSegments[0];

  // Build blocked tile set (AI tail tip vacates unless eating)
  const blocked = new Set<string>();
  for (const obs of obstacles) blocked.add(pointKey(obs));
  for (let i = 0; i < aiSegments.length - 1; i++) blocked.add(pointKey(aiSegments[i]));
  for (const p of playerSegments) blocked.add(pointKey(p));

  const validDirs = ALL_DIRECTIONS.filter((dir) => {
    if (isOppositeDirection(dir, aiDirection)) return false;
    const d = getDirectionDelta(dir);
    const next: Point = { x: head.x + d.x, y: head.y + d.y };
    if (!isInsidePlayableBounds(next, hazardDepth)) return false;
    return !blocked.has(pointKey(next));
  });

  if (validDirs.length === 0) {
    return aiDirection;
  }
  if (validDirs.length === 1) {
    return validDirs[0];
  }

  // Pick nearest attractive target (food, golden apple, or bonus pellet)
  const targets: Point[] = [];
  if (ctx.food) targets.push(ctx.food);
  for (const item of ctx.specialItems) {
    if (item.type === 'golden') targets.push(item.pos);
  }
  for (const pellet of ctx.bonusPellets) {
    targets.push(pellet.pos);
  }

  let bestTarget: Point | null = null;
  let bestTargetDist = Infinity;
  for (const t of targets) {
    const dist = Math.abs(t.x - head.x) + Math.abs(t.y - head.y);
    if (dist < bestTargetDist) {
      bestTargetDist = dist;
      bestTarget = t;
    }
  }

  // BFS from head to target (with small 10% greedy slip so the AI feels lively and beatable)
  if (bestTarget && Math.random() > 0.1) {
    const targetKey = pointKey(bestTarget);
    const visited = new Set<string>([pointKey(head)]);
    const queue: Array<{ pos: Point; firstDir: Direction; depth: number }> = [];

    for (const dir of validDirs) {
      const d = getDirectionDelta(dir);
      const next: Point = { x: head.x + d.x, y: head.y + d.y };
      const k = pointKey(next);
      if (k === targetKey) {
        return dir;
      }
      visited.add(k);
      queue.push({ pos: next, firstDir: dir, depth: 1 });
    }

    let qi = 0;
    while (qi < queue.length) {
      const curr = queue[qi++];
      if (curr.depth >= 24) continue; // Bounded lookahead keeps it fast & outsmartable

      for (const dir of ALL_DIRECTIONS) {
        const d = getDirectionDelta(dir);
        const next: Point = { x: curr.pos.x + d.x, y: curr.pos.y + d.y };
        if (!isInsidePlayableBounds(next, hazardDepth)) continue;
        const k = pointKey(next);
        if (k === targetKey) {
          return curr.firstDir;
        }
        if (blocked.has(k) || visited.has(k)) continue;
        visited.add(k);
        queue.push({ pos: next, firstDir: curr.firstDir, depth: curr.depth + 1 });
      }
    }
  }

  // Fallback: evaluate each valid move by open space + proximity to target
  let chosenDir = validDirs[0];
  let bestScore = -Infinity;

  for (const dir of validDirs) {
    const d = getDirectionDelta(dir);
    const next: Point = { x: head.x + d.x, y: head.y + d.y };
    const space = floodFillReachableCount(next, blocked, hazardDepth, 28);
    const distPenalty = bestTarget
      ? (Math.abs(bestTarget.x - next.x) + Math.abs(bestTarget.y - next.y)) * 0.45
      : 0;
    const score = space - distPenalty;
    if (score > bestScore) {
      bestScore = score;
      chosenDir = dir;
    }
  }

  return chosenDir;
}

/**
 * Finds a safe 3-segment spawn strip on the opposite side of the board from the player.
 */
export function findAiSpawnState(
  playerSnake: Point[],
  obstacles: Point[],
  hazardDepth: number
): { segments: Point[]; direction: Direction } | null {
  const blocked = new Set<string>();
  for (const p of playerSnake) blocked.add(pointKey(p));
  for (const o of obstacles) blocked.add(pointKey(o));

  const playerHead = playerSnake[0] ?? { x: 5, y: 10 };
  const preferRightSide = playerHead.x < GRID_SIZE / 2;
  const minCoord = Math.max(hazardDepth + 1, 2);
  const maxCoord = Math.min(GRID_SIZE - hazardDepth - 2, GRID_SIZE - 3);

  const candidates: Array<{ segments: Point[]; direction: Direction; dist: number }> = [];

  for (let y = minCoord; y <= maxCoord; y++) {
    for (let x = minCoord + 2; x <= maxCoord - 2; x++) {
      // Facing LEFT (body extends right) or facing RIGHT (body extends left)
      const dir: Direction = preferRightSide ? 'LEFT' : 'RIGHT';
      const segs: Point[] =
        dir === 'LEFT'
          ? [
              { x, y },
              { x: x + 1, y },
              { x: x + 2, y },
            ]
          : [
              { x, y },
              { x: x - 1, y },
              { x: x - 2, y },
            ];

      const ahead = dir === 'LEFT' ? { x: x - 1, y } : { x: x + 1, y };
      const ahead2 = dir === 'LEFT' ? { x: x - 2, y } : { x: x + 2, y };

      const allFree = [...segs, ahead, ahead2].every(
        (p) => isInsidePlayableBounds(p, hazardDepth) && !blocked.has(pointKey(p))
      );

      if (!allFree) continue;
      const dist = Math.abs(x - playerHead.x) + Math.abs(y - playerHead.y);
      if (dist >= 7) {
        candidates.push({ segments: segs, direction: dir, dist });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.dist - a.dist);
  const topPool = candidates.slice(0, Math.min(8, candidates.length));
  const pick = topPool[Math.floor(Math.random() * topPool.length)];
  return { segments: pick.segments, direction: pick.direction };
}
