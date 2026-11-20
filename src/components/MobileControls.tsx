import { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Flame } from 'lucide-react';
import type { Direction } from '../types/game';

interface MobileControlsProps {
  onDirection: (direction: Direction) => void;
  onBoostChange: (active: boolean) => void;
  isBoosting: boolean;
  canBoost: boolean;
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
      className={`dpad-button flex items-center justify-center w-[56px] h-[46px] min-[400px]:w-[62px] min-[400px]:h-[50px] rounded-xl border transition-[transform,background-color,border-color,color] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
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

export function MobileControls({
  onDirection,
  onBoostChange,
  isBoosting,
  canBoost,
  disabled = false,
  forceShow = false,
}: MobileControlsProps) {
  const [pressedDir, setPressedDir] = useState<Direction | null>(null);

  const handlePressStart = (direction: Direction) => {
    setPressedDir(direction);
    onDirection(direction);
  };

  const handlePressEnd = (direction: Direction) => {
    setPressedDir((current) => (current === direction ? null : current));
  };

  const boostDisabled = disabled || !canBoost;

  return (
    <nav
      aria-label="Mobile game controls"
      className={`${forceShow ? 'flex' : 'flex md:hidden'} w-full items-center justify-center gap-5 min-[400px]:gap-7 shrink-0 pt-0.5 pb-0.5`}
    >
      {/* Classic 4-Way Cross D-Pad */}
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5 items-center justify-items-center">
        <div className="col-start-2 row-start-1">
          <PadButton
            direction="UP"
            label="Move Up"
            active={pressedDir === 'UP'}
            disabled={disabled}
            onPressStart={handlePressStart}
            onPressEnd={handlePressEnd}
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
          </PadButton>
        </div>

        <div className="col-start-1 row-start-2">
          <PadButton
            direction="LEFT"
            label="Move Left"
            active={pressedDir === 'LEFT'}
            disabled={disabled}
            onPressStart={handlePressStart}
            onPressEnd={handlePressEnd}
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
          </PadButton>
        </div>

        <div
          className="col-start-2 row-start-2 w-9 h-9 rounded-full bg-[#0D1424] border border-slate-800/80 flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="w-2 h-2 rounded-full bg-slate-700/80" />
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
            <ArrowRight className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
          </PadButton>
        </div>

        <div className="col-start-2 row-start-3">
          <PadButton
            direction="DOWN"
            label="Move Down"
            active={pressedDir === 'DOWN'}
            disabled={disabled}
            onPressStart={handlePressStart}
            onPressEnd={handlePressEnd}
          >
            <ArrowDown className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
          </PadButton>
        </div>
      </div>

      {/* Dedicated Thumb-Friendly Circular BOOST Hold Button */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <button
          type="button"
          aria-label="Hold to boost speed"
          aria-pressed={isBoosting}
          disabled={boostDisabled}
          onPointerDown={(e) => {
            if (boostDisabled) return;
            e.preventDefault();
            onBoostChange(true);
          }}
          onPointerUp={() => onBoostChange(false)}
          onPointerCancel={() => onBoostChange(false)}
          onPointerLeave={() => onBoostChange(false)}
          onContextMenu={(e) => e.preventDefault()}
          className={`boost-button w-[78px] h-[78px] min-[400px]:w-[86px] min-[400px]:h-[86px] rounded-full border-2 flex flex-col items-center justify-center gap-0.5 transition-[transform,background-color,border-color,color,box-shadow] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
            boostDisabled
              ? 'bg-[#101624] border-slate-800 text-slate-600'
              : isBoosting
                ? 'bg-orange-500/30 border-orange-400 text-orange-200 scale-95 shadow-[0_0_24px_rgba(249,115,22,0.45)]'
                : 'bg-[#171F30] border-orange-500/50 text-orange-300 active:scale-95'
          }`}
        >
          <Flame
            className={`w-6 h-6 ${isBoosting ? 'fill-orange-400 text-orange-200' : ''}`}
            aria-hidden="true"
          />
          <span className="font-display text-[11px] font-bold tracking-wider uppercase leading-none">
            BOOST
          </span>
        </button>
        <span className="text-[10px] text-slate-500 whitespace-nowrap">
          {!disabled && !canBoost ? 'Min Len (3)' : 'Hold · 2x'}
        </span>
      </div>
    </nav>
  );
}
