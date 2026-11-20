import { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import type { Direction } from '../game/types';

interface MobileDPadProps {
  onDirection: (direction: Direction) => void;
  disabled?: boolean;
  forceShow?: boolean;
}

interface PadButtonProps {
  direction: Direction;
  label: string;
  active: boolean;
  disabled: boolean;
  onPressStart: (direction: Direction) => void;
  onPressEnd: (direction: Direction) => void;
  children: React.ReactNode;
}

function PadButton({
  direction,
  label,
  active,
  disabled,
  onPressStart,
  onPressEnd,
  children,
}: PadButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        onPressStart(direction);
      }}
      onPointerUp={() => onPressEnd(direction)}
      onPointerCancel={() => onPressEnd(direction)}
      onPointerLeave={() => onPressEnd(direction)}
      onContextMenu={(e) => e.preventDefault()}
      className={`dpad-button flex items-center justify-center w-[60px] h-[48px] min-[400px]:w-[68px] min-[400px]:h-[54px] rounded-xl border transition-[transform,background-color,border-color,color] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
        disabled
          ? 'bg-[#111827]/60 border-slate-800/70 text-slate-600'
          : active
            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 scale-95'
            : 'bg-[#151F32] border-slate-700/80 text-slate-100 active:bg-emerald-500/25 active:border-emerald-400 active:scale-95'
      }`}
    >
      {children}
    </button>
  );
}

export function MobileDPad({ onDirection, disabled = false, forceShow = false }: MobileDPadProps) {
  const [pressedDir, setPressedDir] = useState<Direction | null>(null);

  const handlePressStart = (direction: Direction) => {
    setPressedDir(direction);
    onDirection(direction);
  };

  const handlePressEnd = (direction: Direction) => {
    setPressedDir((current) => (current === direction ? null : current));
  };

  return (
    <nav
      aria-label="Directional controls"
      className={`${forceShow ? 'flex' : 'flex md:hidden'} items-center justify-center shrink-0 pt-1 pb-0.5`}
    >
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5 items-center justify-items-center">
        {/* Row 1: Up */}
        <div className="col-start-2 row-start-1">
          <PadButton
            direction="UP"
            label="Move Up"
            active={pressedDir === 'UP'}
            disabled={disabled}
            onPressStart={handlePressStart}
            onPressEnd={handlePressEnd}
          >
            <ArrowUp className="w-6 h-6 stroke-[2.4]" aria-hidden="true" />
          </PadButton>
        </div>

        {/* Row 2: Left, Hub, Right */}
        <div className="col-start-1 row-start-2">
          <PadButton
            direction="LEFT"
            label="Move Left"
            active={pressedDir === 'LEFT'}
            disabled={disabled}
            onPressStart={handlePressStart}
            onPressEnd={handlePressEnd}
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.4]" aria-hidden="true" />
          </PadButton>
        </div>

        <div
          className="col-start-2 row-start-2 w-10 h-10 rounded-full bg-[#0D1424] border border-slate-800/80 flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-slate-700/80" />
        </div>

        <div className="col-start-3 row-start-2">
          <PadButton
            direction="RIGHT"
            label="Move Right"
            active={pressedDir === 'RIGHT'}
            disabled={disabled}
            onPressStart={handlePressStart}
            onPressEnd={handlePressEnd}
          >
            <ArrowRight className="w-6 h-6 stroke-[2.4]" aria-hidden="true" />
          </PadButton>
        </div>

        {/* Row 3: Down */}
        <div className="col-start-2 row-start-3">
          <PadButton
            direction="DOWN"
            label="Move Down"
            active={pressedDir === 'DOWN'}
            disabled={disabled}
            onPressStart={handlePressStart}
            onPressEnd={handlePressEnd}
          >
            <ArrowDown className="w-6 h-6 stroke-[2.4]" aria-hidden="true" />
          </PadButton>
        </div>
      </div>
    </nav>
  );
}
