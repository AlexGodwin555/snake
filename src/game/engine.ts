import { BOARD_COLORS, GRID_SIZE } from './constants';
import type { Direction, Particle, Point } from './types';

export function isOppositeDirection(a: Direction, b: Direction): boolean {
  return (
    (a === 'UP' && b === 'DOWN') ||
    (a === 'DOWN' && b === 'UP') ||
    (a === 'LEFT' && b === 'RIGHT') ||
    (a === 'RIGHT' && b === 'LEFT')
  );
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

export function createInitialSnake(): Point[] {
  const centerY = Math.floor(GRID_SIZE / 2);
  const startX = Math.floor(GRID_SIZE / 2) - 1;
  return [
    { x: startX, y: centerY },
    { x: startX - 1, y: centerY },
    { x: startX - 2, y: centerY },
  ];
}

export function spawnFood(snake: Point[]): Point | null {
  const occupied = new Set<string>(snake.map((segment) => `${segment.x},${segment.y}`));
  const emptyCells: Point[] = [];

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (!occupied.has(`${x},${y}`)) {
        emptyCells.push({ x, y });
      }
    }
  }

  if (emptyCells.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * emptyCells.length);
  return emptyCells[randomIndex];
}

export function createEatParticles(cell: Point, cellSize: number): Particle[] {
  const cx = (cell.x + 0.5) * cellSize;
  const cy = (cell.y + 0.5) * cellSize;
  const colors = ['#FB7185', '#F43F5E', '#4ADE80', '#FBBF24'];
  const particles: Particle[] = [];

  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.4;
    const speed = cellSize * (1.8 + Math.random() * 2.2);
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.28 + Math.random() * 0.14,
      color: colors[i % colors.length],
      size: Math.max(2, cellSize * (0.12 + Math.random() * 0.08)),
    });
  }

  return particles;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function getBodySegmentColor(index: number, total: number): string {
  const t = total <= 2 ? 0 : Math.min(1, (index - 1) / Math.max(1, total - 2));
  // Emerald (#22C55E -> 34, 197, 94) to deep jade (#15803D -> 21, 128, 61)
  const r = lerpChannel(34, 21, t);
  const g = lerpChannel(197, 134, t);
  const b = lerpChannel(94, 72, t);
  return `rgb(${r}, ${g}, ${b})`;
}

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  canvasSize: number;
  snake: Point[];
  direction: Direction;
  food: Point | null;
  particles: Particle[];
  nowMs: number;
  reducedMotion: boolean;
  collisionFlashAlpha: number;
}

export function renderBoard({
  ctx,
  canvasSize,
  snake,
  direction,
  food,
  particles,
  nowMs,
  reducedMotion,
  collisionFlashAlpha,
}: RenderOptions): void {
  const cellSize = canvasSize / GRID_SIZE;

  // 1. Checkerboard background grid for effortless spatial alignment
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? BOARD_COLORS.tileDark : BOARD_COLORS.tileLight;
      ctx.fillRect(x * cellSize, y * cellSize, cellSize + 0.5, cellSize + 0.5);
    }
  }

  // 2. Food orb with gentle breathing pulse and high-contrast silhouette
  if (food) {
    const cx = (food.x + 0.5) * cellSize;
    const cy = (food.y + 0.5) * cellSize;
    const pulse = reducedMotion ? 0 : Math.sin(nowMs * 0.007) * 0.07;
    const baseRadius = cellSize * (0.36 + pulse * 0.5);

    // Subtle radial halo
    const glow = ctx.createRadialGradient(cx, cy, baseRadius * 0.2, cx, cy, cellSize * 0.65);
    glow.addColorStop(0, BOARD_COLORS.foodGlow);
    glow.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // Main berry/apple orb
    ctx.fillStyle = BOARD_COLORS.foodCore;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight dot
    ctx.fillStyle = BOARD_COLORS.foodHighlight;
    ctx.beginPath();
    ctx.arc(
      cx - baseRadius * 0.3,
      cy - baseRadius * 0.3,
      Math.max(1.5, baseRadius * 0.26),
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Crisp leaf accent on top
    ctx.fillStyle = BOARD_COLORS.foodStem;
    ctx.beginPath();
    ctx.ellipse(
      cx + baseRadius * 0.18,
      cy - baseRadius * 0.92,
      Math.max(1.5, cellSize * 0.11),
      Math.max(1.2, cellSize * 0.06),
      -0.45,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // 3. Snake body segments (drawn from tail to neck so head layers cleanly on top)
  const total = snake.length;
  for (let i = total - 1; i >= 1; i--) {
    const segment = snake[i];
    const progressToTail = total > 2 ? (i - 1) / (total - 2) : 0;
    const inset = cellSize * (0.09 + progressToTail * 0.08);
    const size = cellSize - inset * 2;
    const x = segment.x * cellSize + inset;
    const y = segment.y * cellSize + inset;
    const radius = Math.max(3, size * 0.28);

    ctx.fillStyle = getBodySegmentColor(i, total);
    drawRoundedRect(ctx, x, y, size, size, radius);
    ctx.fill();

    // Subtle inner highlight along top edge of each segment
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    drawRoundedRect(
      ctx,
      x + size * 0.16,
      y + size * 0.14,
      size * 0.68,
      Math.max(1.5, size * 0.18),
      radius * 0.5
    );
    ctx.fill();
  }

  // 4. Snake head (visually distinct with brighter tone, crisp rim, and directional eyes)
  if (snake.length > 0) {
    const head = snake[0];
    const inset = cellSize * 0.05;
    const size = cellSize - inset * 2;
    const x = head.x * cellSize + inset;
    const y = head.y * cellSize + inset;
    const radius = Math.max(4, size * 0.34);

    // Subtle head glow for immediate tracking at high speed
    ctx.save();
    ctx.shadowColor = 'rgba(74, 222, 128, 0.28)';
    ctx.shadowBlur = Math.max(6, cellSize * 0.35);
    ctx.fillStyle = BOARD_COLORS.snakeHead;
    drawRoundedRect(ctx, x, y, size, size, radius);
    ctx.fill();
    ctx.restore();

    // Crisp darker outline for sharp contrast against body
    ctx.strokeStyle = BOARD_COLORS.snakeHeadBorder;
    ctx.lineWidth = Math.max(1, cellSize * 0.05);
    drawRoundedRect(ctx, x, y, size, size, radius);
    ctx.stroke();

    // Inner specular cap
    ctx.fillStyle = BOARD_COLORS.snakeHeadHighlight;
    ctx.globalAlpha = 0.35;
    drawRoundedRect(
      ctx,
      x + size * 0.18,
      y + size * 0.14,
      size * 0.64,
      Math.max(2, size * 0.2),
      radius * 0.4
    );
    ctx.fill();
    ctx.globalAlpha = 1;

    // Directional eyes
    const eyeRadius = Math.max(1.8, cellSize * 0.1);
    const cx = head.x * cellSize + cellSize * 0.5;
    const cy = head.y * cellSize + cellSize * 0.5;
    const forward = cellSize * 0.18;
    const side = cellSize * 0.18;

    let leftEye: Point;
    let rightEye: Point;

    switch (direction) {
      case 'UP':
        leftEye = { x: cx - side, y: cy - forward };
        rightEye = { x: cx + side, y: cy - forward };
        break;
      case 'DOWN':
        leftEye = { x: cx - side, y: cy + forward };
        rightEye = { x: cx + side, y: cy + forward };
        break;
      case 'LEFT':
        leftEye = { x: cx - forward, y: cy - side };
        rightEye = { x: cx - forward, y: cy + side };
        break;
      case 'RIGHT':
      default:
        leftEye = { x: cx + forward, y: cy - side };
        rightEye = { x: cx + forward, y: cy + side };
        break;
    }

    ctx.fillStyle = BOARD_COLORS.snakeEye;
    ctx.beginPath();
    ctx.arc(leftEye.x, leftEye.y, eyeRadius, 0, Math.PI * 2);
    ctx.arc(rightEye.x, rightEye.y, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Tiny white glint inside eyes
    ctx.fillStyle = '#FFFFFF';
    const glintOffset = eyeRadius * 0.32;
    const glintRadius = Math.max(0.7, eyeRadius * 0.32);
    ctx.beginPath();
    ctx.arc(leftEye.x - glintOffset, leftEye.y - glintOffset, glintRadius, 0, Math.PI * 2);
    ctx.arc(rightEye.x - glintOffset, rightEye.y - glintOffset, glintRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Eat burst particles
  if (!reducedMotion && particles.length > 0) {
    for (const p of particles) {
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * alpha), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 6. Brief collision flash overlay
  if (collisionFlashAlpha > 0.01) {
    ctx.fillStyle = `rgba(244, 63, 94, ${collisionFlashAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
  }
}
