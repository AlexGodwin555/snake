import { GRID_SIZE } from '../constants/levels';
import type {
  ActiveEffects,
  AiSnakeState,
  BonusPellet,
  Direction,
  FloatingText,
  GameMode,
  ObstacleState,
  Particle,
  Point,
  PortalPair,
  ShrinkState,
  SpecialItem,
  ThemeConfig,
} from '../types/game';
import { isHazardTile } from './spawning';

// Cached offscreen mask canvas for Flashlight Mode (zero per-frame allocations)
let fogCanvas: HTMLCanvasElement | null = null;

function getFogCanvas(size: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (!fogCanvas) {
    fogCanvas = document.createElement('canvas');
  }
  if (fogCanvas.width !== size || fogCanvas.height !== size) {
    fogCanvas.width = size;
    fogCanvas.height = size;
  }
  return fogCanvas;
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

function getGradientColor(
  start: [number, number, number],
  end: [number, number, number],
  t: number
): string {
  const clamped = Math.max(0, Math.min(1, t));
  return `rgb(${lerpChannel(start[0], end[0], clamped)}, ${lerpChannel(
    start[1],
    end[1],
    clamped
  )}, ${lerpChannel(start[2], end[2], clamped)})`;
}

export function createBurstParticles(
  cell: Point,
  cellSize: number,
  colors: string[],
  count: number = 12
): Particle[] {
  const cx = (cell.x + 0.5) * cellSize;
  const cy = (cell.y + 0.5) * cellSize;
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
    const speed = cellSize * (1.8 + Math.random() * 2.8);
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.28 + Math.random() * 0.2,
      color: colors[i % colors.length],
      size: Math.max(2, cellSize * (0.11 + Math.random() * 0.09)),
    });
  }

  return particles;
}

export interface RenderFrameParams {
  ctx: CanvasRenderingContext2D;
  canvasSize: number;
  theme: ThemeConfig;
  mode: GameMode;
  snake: Point[];
  direction: Direction;
  smoothHeadPos: Point; // Lerped pixel-space head position for Flashlight beam
  ai: AiSnakeState;
  food: Point | null;
  specialItems: SpecialItem[];
  bonusPellets: BonusPellet[];
  portals: PortalPair | null;
  obstacles: ObstacleState;
  shrink: ShrinkState;
  effects: ActiveEffects;
  isBoosting: boolean;
  particles: Particle[];
  floatingTexts: FloatingText[];
  nowMs: number;
  reducedMotion: boolean;
  collisionFlashAlpha: number;
}

function drawSnakeEntity(
  ctx: CanvasRenderingContext2D,
  segments: Point[],
  direction: Direction,
  cellSize: number,
  theme: ThemeConfig,
  options: {
    isAi: boolean;
    isGhost: boolean;
    isBoosting: boolean;
    nowMs: number;
    reducedMotion: boolean;
  }
): void {
  if (segments.length === 0) return;

  const { isAi, isGhost, isBoosting, nowMs, reducedMotion } = options;
  const total = segments.length;
  const pixelated = Boolean(theme.pixelated);
  const headColor = isAi ? theme.board.aiHead : theme.board.snakeHead;
  const bodyStart = isAi ? theme.board.aiBodyStart : theme.board.snakeBodyStart;
  const bodyEnd = isAi ? theme.board.aiBodyEnd : theme.board.snakeBodyEnd;

  ctx.save();
  if (isGhost) {
    ctx.globalAlpha = 0.54 + (reducedMotion ? 0 : Math.sin(nowMs * 0.012) * 0.08);
  }

  // Tail exhaust glow when boosting
  if (isBoosting && !isAi && total > 1) {
    const tail = segments[total - 1];
    const tx = (tail.x + 0.5) * cellSize;
    const ty = (tail.y + 0.5) * cellSize;
    const glow = ctx.createRadialGradient(tx, ty, cellSize * 0.1, tx, ty, cellSize * 0.9);
    glow.addColorStop(0, 'rgba(251, 146, 60, 0.72)');
    glow.addColorStop(0.6, 'rgba(234, 88, 12, 0.25)');
    glow.addColorStop(1, 'rgba(234, 88, 12, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(tx, ty, cellSize * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Body segments (tail -> neck)
  for (let i = total - 1; i >= 1; i--) {
    const seg = segments[i];
    const progressToTail = total > 2 ? (i - 1) / (total - 2) : 0;
    const inset = pixelated ? cellSize * 0.08 : cellSize * (0.09 + progressToTail * 0.075);
    const size = cellSize - inset * 2;
    const x = seg.x * cellSize + inset;
    const y = seg.y * cellSize + inset;
    const radius = pixelated ? 1.5 : Math.max(3, size * 0.28);

    const fill = isGhost
      ? 'rgba(186, 230, 253, 0.85)'
      : getGradientColor(bodyStart, bodyEnd, progressToTail);

    if (theme.bloom || isGhost) {
      ctx.shadowColor = isGhost ? 'rgba(186, 230, 253, 0.75)' : fill;
      ctx.shadowBlur = isGhost ? cellSize * 0.55 : cellSize * 0.32;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = fill;
    if (pixelated) {
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size));
      // Retro pixel inner dot on Nokia theme
      ctx.fillStyle = theme.board.tileDark;
      ctx.fillRect(
        Math.round(x + size * 0.35),
        Math.round(y + size * 0.35),
        Math.max(1.5, Math.round(size * 0.16)),
        Math.max(1.5, Math.round(size * 0.16))
      );
    } else {
      drawRoundedRect(ctx, x, y, size, size, radius);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = isBoosting && !isAi ? 'rgba(254, 215, 170, 0.28)' : 'rgba(255, 255, 255, 0.14)';
      drawRoundedRect(
        ctx,
        x + size * 0.16,
        y + size * 0.14,
        size * 0.68,
        Math.max(1.5, size * 0.17),
        radius * 0.5
      );
      ctx.fill();
    }
  }

  // Head
  const head = segments[0];
  const inset = pixelated ? cellSize * 0.05 : cellSize * 0.05;
  const size = cellSize - inset * 2;
  const x = head.x * cellSize + inset;
  const y = head.y * cellSize + inset;
  const radius = pixelated ? 2 : Math.max(4, size * 0.34);

  ctx.save();
  if (isGhost) {
    ctx.shadowColor = 'rgba(224, 242, 254, 0.95)';
    ctx.shadowBlur = Math.max(10, cellSize * 0.65);
    ctx.fillStyle = '#E0F2FE';
  } else {
    ctx.shadowColor = isBoosting && !isAi ? 'rgba(251, 146, 60, 0.65)' : headColor;
    ctx.shadowBlur = theme.bloom ? cellSize * 0.6 : Math.max(5, cellSize * 0.3);
    ctx.fillStyle = headColor;
  }

  if (pixelated) {
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size));
  } else {
    drawRoundedRect(ctx, x, y, size, size, radius);
    ctx.fill();
  }
  ctx.restore();

  if (!pixelated) {
    ctx.strokeStyle = isGhost
      ? '#FFFFFF'
      : isAi
        ? '#9F1239'
        : isBoosting
          ? '#FB923C'
          : theme.board.snakeHeadBorder;
    ctx.lineWidth = Math.max(1, cellSize * 0.055);
    drawRoundedRect(ctx, x, y, size, size, radius);
    ctx.stroke();

    ctx.fillStyle = isGhost ? '#FFFFFF' : theme.board.snakeHeadHighlight;
    ctx.globalAlpha = isGhost ? 0.45 : 0.32;
    drawRoundedRect(
      ctx,
      x + size * 0.18,
      y + size * 0.14,
      size * 0.64,
      Math.max(2, size * 0.2),
      radius * 0.4
    );
    ctx.fill();
    ctx.globalAlpha = isGhost ? 0.6 : 1;
  }

  // Directional Eyes
  const eyeRadius = Math.max(1.8, cellSize * 0.105);
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

  ctx.fillStyle = isAi ? '#FEF08A' : isGhost ? '#0369A1' : theme.board.snakeEye;
  if (pixelated) {
    const es = Math.max(2, Math.round(eyeRadius * 1.7));
    ctx.fillRect(Math.round(leftEye.x - es / 2), Math.round(leftEye.y - es / 2), es, es);
    ctx.fillRect(Math.round(rightEye.x - es / 2), Math.round(rightEye.y - es / 2), es, es);
  } else {
    ctx.beginPath();
    ctx.arc(leftEye.x, leftEye.y, eyeRadius, 0, Math.PI * 2);
    ctx.arc(rightEye.x, rightEye.y, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    if (!isAi) {
      ctx.fillStyle = '#FFFFFF';
      const glintOffset = eyeRadius * 0.32;
      const glintRadius = Math.max(0.7, eyeRadius * 0.32);
      ctx.beginPath();
      ctx.arc(leftEye.x - glintOffset, leftEye.y - glintOffset, glintRadius, 0, Math.PI * 2);
      ctx.arc(rightEye.x - glintOffset, rightEye.y - glintOffset, glintRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawSpecialItem(
  ctx: CanvasRenderingContext2D,
  item: SpecialItem,
  cellSize: number,
  nowMs: number,
  reducedMotion: boolean
): void {
  const cx = (item.pos.x + 0.5) * cellSize;
  const cy = (item.pos.y + 0.5) * cellSize;
  const pulse = reducedMotion ? 0 : Math.sin(nowMs * 0.008 + item.id) * 0.08;

  ctx.save();

  switch (item.type) {
    case 'shrink': {
      // Cyan/Teal double berry
      const r = cellSize * (0.28 + pulse * 0.35);
      const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, cellSize * 0.65);
      glow.addColorStop(0, 'rgba(45, 212, 191, 0.42)');
      glow.addColorStop(1, 'rgba(45, 212, 191, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.65, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#14B8A6';
      ctx.beginPath();
      ctx.arc(cx - cellSize * 0.11, cy + cellSize * 0.06, r * 0.88, 0, Math.PI * 2);
      ctx.arc(cx + cellSize * 0.12, cy + cellSize * 0.02, r * 0.88, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#5EEAD4';
      ctx.beginPath();
      ctx.arc(cx, cy - cellSize * 0.07, r * 0.82, 0, Math.PI * 2);
      ctx.fill();

      // Minus glyph cue for shrink clarity
      ctx.strokeStyle = '#042F2E';
      ctx.lineWidth = Math.max(1.8, cellSize * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - cellSize * 0.14, cy);
      ctx.lineTo(cx + cellSize * 0.14, cy);
      ctx.stroke();
      break;
    }

    case 'golden': {
      // Glowing Gold Apple with shrinking circular countdown progress ring
      const r = cellSize * (0.33 + pulse * 0.4);
      const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, cellSize * 0.78);
      glow.addColorStop(0, 'rgba(250, 204, 21, 0.55)');
      glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.78, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy - r * 0.3, Math.max(1.5, r * 0.32), 0, Math.PI * 2);
      ctx.fill();

      // Shrinking circular timer progress ring around the tile
      if (item.expiresAtMs !== null && item.durationMs !== null) {
        const remainingRatio = Math.max(0, Math.min(1, (item.expiresAtMs - nowMs) / item.durationMs));
        const ringRadius = cellSize * 0.48;
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
        ctx.lineWidth = Math.max(2, cellSize * 0.09);
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = remainingRatio < 0.3 ? '#FB7185' : '#FDE047';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          ringRadius,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * remainingRatio
        );
        ctx.stroke();
      }
      break;
    }

    case 'ghost': {
      // Translucent White/Blue Phase-Shift Orb
      const r = cellSize * (0.32 + pulse * 0.45);
      const glow = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, cellSize * 0.75);
      glow.addColorStop(0, 'rgba(224, 242, 254, 0.65)');
      glow.addColorStop(0.55, 'rgba(56, 189, 248, 0.32)');
      glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.75, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
      ctx.lineWidth = Math.max(1.5, cellSize * 0.075);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(240, 249, 255, 0.82)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
      ctx.fill();

      // Tiny ghostly eyes inside orb
      ctx.fillStyle = '#0284C7';
      ctx.beginPath();
      ctx.arc(cx - r * 0.26, cy - r * 0.05, Math.max(1.2, cellSize * 0.055), 0, Math.PI * 2);
      ctx.arc(cx + r * 0.26, cy - r * 0.05, Math.max(1.2, cellSize * 0.055), 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'chrono': {
      // Icy Blue Snowflake / Crystal
      const r = cellSize * (0.37 + pulse * 0.3);
      const rot = reducedMotion ? 0 : nowMs * 0.0012;
      const glow = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, cellSize * 0.7);
      glow.addColorStop(0, 'rgba(96, 165, 250, 0.5)');
      glow.addColorStop(1, 'rgba(96, 165, 250, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = '#93C5FD';
      ctx.lineWidth = Math.max(1.8, cellSize * 0.09);
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * i) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * -r, Math.sin(a) * -r);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.fillStyle = '#EFF6FF';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, cellSize * 0.11), 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'glitch': {
      // Dark Purple Glitching Square with chromatic offset jitter + linear expiry bar
      const jitterX = reducedMotion ? 0 : (Math.sin(nowMs * 0.045) > 0.65 ? (Math.random() - 0.5) * 3 : 0);
      const jitterY = reducedMotion ? 0 : (Math.cos(nowMs * 0.037) > 0.7 ? (Math.random() - 0.5) * 2.5 : 0);
      const s = cellSize * 0.66;
      const x = cx - s / 2;
      const y = cy - s / 2;

      // Chromatic ghost layers
      ctx.fillStyle = 'rgba(236, 72, 153, 0.55)';
      ctx.fillRect(x - 1.8 + jitterX, y + jitterY, s, s);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.55)';
      ctx.fillRect(x + 1.8 - jitterX, y - jitterY, s, s);

      // Core dark purple glitch square
      ctx.fillStyle = '#581C87';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#C084FC';
      ctx.lineWidth = Math.max(1.5, cellSize * 0.075);
      ctx.strokeRect(x, y, s, s);

      // Horizontal glitch scan line
      ctx.fillStyle = '#E879F9';
      const sliceY = y + ((Math.floor(nowMs / 110) % 4) / 4) * s;
      ctx.fillRect(x + 1, sliceY, s - 2, Math.max(1.5, s * 0.16));

      // Subtle expiry bar above square
      if (item.expiresAtMs !== null && item.durationMs !== null) {
        const ratio = Math.max(0, Math.min(1, (item.expiresAtMs - nowMs) / item.durationMs));
        const barW = cellSize * 0.78;
        const barH = Math.max(2, cellSize * 0.09);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(cx - barW / 2, y - barH - 3, barW, barH);
        ctx.fillStyle = '#C084FC';
        ctx.fillRect(cx - barW / 2, y - barH - 3, barW * ratio, barH);
      }
      break;
    }
  }

  ctx.restore();
}

export function renderGameFrame(params: RenderFrameParams): void {
  const {
    ctx,
    canvasSize,
    theme,
    mode,
    snake,
    direction,
    smoothHeadPos,
    ai,
    food,
    specialItems,
    bonusPellets,
    portals,
    obstacles,
    shrink,
    effects,
    isBoosting,
    particles,
    floatingTexts,
    nowMs,
    reducedMotion,
    collisionFlashAlpha,
  } = params;

  const cellSize = canvasSize / GRID_SIZE;
  const isGhost = effects.ghostEndsAtMs > nowMs;

  // 1. Theme Background Grid
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? theme.board.tileDark : theme.board.tileLight;
      ctx.fillRect(x * cellSize, y * cellSize, cellSize + 0.5, cellSize + 0.5);
    }
  }

  if (theme.board.gridLine) {
    ctx.strokeStyle = theme.board.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < GRID_SIZE; i++) {
      const pos = Math.round(i * cellSize) + 0.5;
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, canvasSize);
      ctx.moveTo(0, pos);
      ctx.lineTo(canvasSize, pos);
    }
    ctx.stroke();
  }

  // Lava Magma ambient glowing ember cracks
  if (theme.lavaCracks) {
    const crackAlpha = 0.14 + (reducedMotion ? 0 : Math.sin(nowMs * 0.0025) * 0.06);
    ctx.save();
    ctx.strokeStyle = `rgba(249, 115, 22, ${crackAlpha.toFixed(3)})`;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    // Stylized geometric obsidian fissures
    ctx.moveTo(0, canvasSize * 0.22);
    ctx.lineTo(canvasSize * 0.18, canvasSize * 0.3);
    ctx.lineTo(canvasSize * 0.28, canvasSize * 0.52);
    ctx.lineTo(canvasSize * 0.45, canvasSize * 0.62);
    ctx.moveTo(canvasSize, canvasSize * 0.74);
    ctx.lineTo(canvasSize * 0.78, canvasSize * 0.64);
    ctx.lineTo(canvasSize * 0.68, canvasSize * 0.42);
    ctx.lineTo(canvasSize * 0.82, canvasSize * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Sudden Death Shrinking Arena: Electrified Hazard Rings + 3s Telegraphing Ring
  if (shrink.ringDepth > 0 || shrink.telegraphing) {
    const activeDepth = shrink.ringDepth;
    const warningDepth = shrink.telegraphing ? shrink.ringDepth + 1 : shrink.ringDepth;
    const flash = reducedMotion ? 0.55 : 0.35 + Math.abs(Math.sin(nowMs * 0.014)) * 0.45;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const pt = { x, y };
        const isActiveHazard = isHazardTile(pt, activeDepth);
        const isWarningTile = !isActiveHazard && shrink.telegraphing && isHazardTile(pt, warningDepth);

        if (isActiveHazard) {
          const px = x * cellSize;
          const py = y * cellSize;
          ctx.fillStyle = '#1E0A14';
          ctx.fillRect(px, py, cellSize + 0.5, cellSize + 0.5);

          // Inner electrified hazard tile pattern
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);

          // Animated crackling electric spark arcs on tiles bordering the playable zone
          const onInnerEdge =
            x === activeDepth - 1 ||
            x === GRID_SIZE - activeDepth ||
            y === activeDepth - 1 ||
            y === GRID_SIZE - activeDepth;
          if (onInnerEdge && ((x * 7 + y * 13 + Math.floor(nowMs / 90)) % 5 === 0)) {
            ctx.strokeStyle = '#FDA4AF';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(px + cellSize * 0.15, py + cellSize * 0.5);
            ctx.lineTo(px + cellSize * 0.45, py + cellSize * 0.25);
            ctx.lineTo(px + cellSize * 0.65, py + cellSize * 0.72);
            ctx.lineTo(px + cellSize * 0.88, py + cellSize * 0.4);
            ctx.stroke();
          }
        } else if (isWarningTile) {
          const px = x * cellSize;
          const py = y * cellSize;
          ctx.fillStyle = `rgba(244, 63, 94, ${(flash * 0.34).toFixed(3)})`;
          ctx.fillRect(px, py, cellSize + 0.5, cellSize + 0.5);

          // Diagonal electric warning stripe
          ctx.strokeStyle = `rgba(251, 113, 133, ${(flash * 0.85).toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px + 2, py + cellSize - 2);
          ctx.lineTo(px + cellSize - 2, py + 2);
          ctx.stroke();
        }
      }
    }

    // Glowing inner electric perimeter line
    if (activeDepth > 0) {
      const insetPx = activeDepth * cellSize;
      const innerSize = (GRID_SIZE - activeDepth * 2) * cellSize;
      ctx.save();
      ctx.strokeStyle = '#F43F5E';
      ctx.shadowColor = 'rgba(244, 63, 94, 0.8)';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.strokeRect(insetPx, insetPx, innerSize, innerSize);
      ctx.restore();
    }
  }

  // 3. Active Level Obstacles
  for (const obs of obstacles.active) {
    if (isHazardTile(obs, shrink.ringDepth)) continue;
    const inset = cellSize * 0.06;
    const x = obs.x * cellSize + inset;
    const y = obs.y * cellSize + inset;
    const s = cellSize - inset * 2;

    ctx.fillStyle = theme.board.obstacleFill;
    if (theme.pixelated) {
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(s), Math.round(s));
      ctx.strokeStyle = theme.board.obstacleBorder;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
    } else {
      drawRoundedRect(ctx, x, y, s, s, Math.max(3, s * 0.2));
      ctx.fill();
      ctx.strokeStyle = theme.board.obstacleBorder;
      ctx.lineWidth = 1.25;
      ctx.stroke();

      // Subtle bevel highlight
      ctx.fillStyle = theme.board.obstacleHighlight;
      drawRoundedRect(ctx, x + s * 0.14, y + s * 0.12, s * 0.72, Math.max(2, s * 0.18), 2);
      ctx.fill();
    }
  }

  // 4. Telegraphing Obstacles (2-second flashing amber outlines — safe to pass through)
  if (obstacles.telegraphing.length > 0) {
    const pulse = reducedMotion ? 0.75 : 0.35 + Math.abs(Math.sin(nowMs * 0.015)) * 0.65;
    ctx.save();
    for (const obs of obstacles.telegraphing) {
      const inset = cellSize * 0.08;
      const x = obs.x * cellSize + inset;
      const y = obs.y * cellSize + inset;
      const s = cellSize - inset * 2;

      ctx.fillStyle = `rgba(245, 158, 11, ${(pulse * 0.2).toFixed(3)})`;
      drawRoundedRect(ctx, x, y, s, s, 3);
      ctx.fill();

      ctx.strokeStyle = `rgba(251, 191, 36, ${pulse.toFixed(3)})`;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      drawRoundedRect(ctx, x, y, s, s, 3);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 5. Linked Portals (Electric Blue A <-> Bright Orange B)
  if (portals) {
    const drawPortal = (pos: Point, primary: string, secondary: string, phaseOffset: number) => {
      const cx = (pos.x + 0.5) * cellSize;
      const cy = (pos.y + 0.5) * cellSize;
      const rot = reducedMotion ? 0 : nowMs * 0.0045 + phaseOffset;

      ctx.save();
      const glow = ctx.createRadialGradient(cx, cy, cellSize * 0.08, cx, cy, cellSize * 0.65);
      glow.addColorStop(0, primary);
      glow.addColorStop(0.55, secondary);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Swirling dual vortex arcs
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = primary;
      ctx.lineWidth = Math.max(2, cellSize * 0.11);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, cellSize * 0.36, 0, Math.PI * 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, cellSize * 0.36, Math.PI, Math.PI * 1.8);
      ctx.stroke();

      // Inner dark singularity core
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.arc(0, 0, cellSize * 0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, cellSize * 0.19, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    drawPortal(portals.a, '#38BDF8', 'rgba(56, 189, 248, 0.32)', 0);
    drawPortal(portals.b, '#FB923C', 'rgba(251, 146, 60, 0.32)', Math.PI);
  }

  // 6. Standard Food
  if (food) {
    const cx = (food.x + 0.5) * cellSize;
    const cy = (food.y + 0.5) * cellSize;
    const pulse = reducedMotion ? 0 : Math.sin(nowMs * 0.007) * 0.07;

    if (theme.pixelated) {
      const s = cellSize * 0.68;
      ctx.fillStyle = theme.board.foodCore;
      ctx.fillRect(Math.round(cx - s / 2), Math.round(cy - s / 2), Math.round(s), Math.round(s));
      ctx.fillStyle = theme.board.tileDark;
      const hole = Math.max(2, Math.round(s * 0.25));
      ctx.fillRect(Math.round(cx - hole / 2), Math.round(cy - hole / 2), hole, hole);
    } else {
      const baseRadius = cellSize * (0.35 + pulse * 0.45);
      const glow = ctx.createRadialGradient(cx, cy, baseRadius * 0.2, cx, cy, cellSize * 0.68);
      glow.addColorStop(0, theme.board.foodGlow);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.68, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.board.foodCore;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.board.foodHighlight;
      ctx.beginPath();
      ctx.arc(
        cx - baseRadius * 0.3,
        cy - baseRadius * 0.3,
        Math.max(1.5, baseRadius * 0.27),
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.fillStyle = theme.board.foodStem;
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
  }

  // 7. Bonus Mini-Pellets (from Shattered Rival AI)
  for (const pellet of bonusPellets) {
    const cx = (pellet.pos.x + 0.5) * cellSize;
    const cy = (pellet.pos.y + 0.5) * cellSize;
    const r = cellSize * 0.25;
    ctx.save();
    ctx.fillStyle = '#FB7185';
    ctx.shadowColor = 'rgba(251, 113, 133, 0.7)';
    ctx.shadowBlur = 8;
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = '#FFE4E6';
    ctx.fillRect(-r * 0.4, -r * 0.4, r * 0.8, r * 0.8);
    ctx.restore();
  }

  // 8. Special Power-Ups & Glitch Hazard
  for (const item of specialItems) {
    drawSpecialItem(ctx, item, cellSize, nowMs, reducedMotion);
  }

  // 9. Duel Mode: Rival AI Respawn Telegraph & Rival AI Snake
  if (mode === 'duel') {
    if (!ai.alive && ai.spawnPreview) {
      const pulse = reducedMotion ? 0.7 : 0.35 + Math.abs(Math.sin(nowMs * 0.016)) * 0.65;
      ctx.save();
      ctx.strokeStyle = `rgba(251, 113, 133, ${pulse.toFixed(3)})`;
      ctx.fillStyle = `rgba(244, 63, 94, ${(pulse * 0.22).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      for (const seg of ai.spawnPreview) {
        const inset = cellSize * 0.14;
        drawRoundedRect(
          ctx,
          seg.x * cellSize + inset,
          seg.y * cellSize + inset,
          cellSize - inset * 2,
          cellSize - inset * 2,
          4
        );
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    } else if (ai.alive && ai.segments.length > 0) {
      drawSnakeEntity(ctx, ai.segments, ai.direction, cellSize, theme, {
        isAi: true,
        isGhost: false,
        isBoosting: false,
        nowMs,
        reducedMotion,
      });
    }
  }

  // 10. Player Snake
  drawSnakeEntity(ctx, snake, direction, cellSize, theme, {
    isAi: false,
    isGhost,
    isBoosting,
    nowMs,
    reducedMotion,
  });

  // 11. Particles (Burst + Ambient Lava Embers)
  if (!reducedMotion && particles.length > 0) {
    ctx.save();
    for (const p of particles) {
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.globalAlpha = p.ambient ? alpha * 0.55 : alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.45 + 0.55 * alpha), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 12. Flashlight Mode (Fog of War Compositing Mask + Pulsing Food Beacon)
  if (mode === 'flashlight') {
    const maskCanvas = getFogCanvas(Math.round(canvasSize));
    if (maskCanvas) {
      const mctx = maskCanvas.getContext('2d');
      if (mctx) {
        mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

        // Dark shadow veil
        mctx.globalCompositeOperation = 'source-over';
        mctx.fillStyle = 'rgba(4, 7, 15, 0.96)';
        mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

        // Carve smooth glowing 4.5-tile visibility cone around snake head
        const lightRadius = cellSize * 4.7;
        mctx.globalCompositeOperation = 'destination-out';
        const cutout = mctx.createRadialGradient(
          smoothHeadPos.x,
          smoothHeadPos.y,
          cellSize * 0.7,
          smoothHeadPos.x,
          smoothHeadPos.y,
          lightRadius
        );
        cutout.addColorStop(0, 'rgba(0, 0, 0, 1)');
        cutout.addColorStop(0.62, 'rgba(0, 0, 0, 0.92)');
        cutout.addColorStop(0.86, 'rgba(0, 0, 0, 0.35)');
        cutout.addColorStop(1, 'rgba(0, 0, 0, 0)');
        mctx.fillStyle = cutout;
        mctx.beginPath();
        mctx.arc(smoothHeadPos.x, smoothHeadPos.y, lightRadius, 0, Math.PI * 2);
        mctx.fill();

        // Composite darkness mask onto main board
        ctx.drawImage(maskCanvas, 0, 0, canvasSize, canvasSize);

        // Subtle warm lantern rim tint around the visibility cone
        const warmTint = ctx.createRadialGradient(
          smoothHeadPos.x,
          smoothHeadPos.y,
          cellSize * 0.6,
          smoothHeadPos.x,
          smoothHeadPos.y,
          lightRadius
        );
        warmTint.addColorStop(0, 'rgba(254, 240, 138, 0.08)');
        warmTint.addColorStop(0.7, 'rgba(251, 146, 60, 0.05)');
        warmTint.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = warmTint;
        ctx.beginPath();
        ctx.arc(smoothHeadPos.x, smoothHeadPos.y, lightRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Softly pulsing beacon ping at active food location above the fog
    if (food) {
      const fx = (food.x + 0.5) * cellSize;
      const fy = (food.y + 0.5) * cellSize;
      const cycle = reducedMotion ? 0.5 : (nowMs % 1500) / 1500;
      const pingRadius = cellSize * (0.35 + cycle * 1.15);
      const pingAlpha = (1 - cycle) * 0.58;

      ctx.save();
      ctx.strokeStyle = `rgba(251, 113, 133, ${pingAlpha.toFixed(3)})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(fx, fy, pingRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(251, 113, 133, 0.55)';
      ctx.beginPath();
      ctx.arc(fx, fy, Math.max(2.5, cellSize * 0.14), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 13. Floating Canvas Pop-ups (+10, +50 GOLDEN!, +5 CLOSE CALL!, etc.)
  if (floatingTexts.length > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.max(11, Math.round(cellSize * 0.56));
    ctx.font = `800 ${fontSize}px "Outfit", system-ui, sans-serif`;

    for (const ft of floatingTexts) {
      const progress = Math.min(1, ft.life / ft.maxLife);
      const alpha = progress < 0.2 ? progress / 0.2 : Math.max(0, 1 - (progress - 0.2) / 0.8);
      const riseY = ft.y - progress * cellSize * 1.45;
      const clampedX = Math.max(54, Math.min(canvasSize - 54, ft.x));
      const clampedY = Math.max(18, riseY);

      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(9, 13, 22, 0.9)';
      ctx.strokeText(ft.text, clampedX, clampedY);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, clampedX, clampedY);
    }
    ctx.restore();
  }

  // 14. Brief Collision Flash
  if (collisionFlashAlpha > 0.01) {
    ctx.fillStyle = `rgba(244, 63, 94, ${collisionFlashAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
  }
}
