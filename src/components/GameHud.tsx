import { Flame, Ghost, Pause, Play, Shuffle, Snowflake, Volume2, VolumeX } from 'lucide-react';
import type { ActiveEffectsSnapshot, GameMode, GameStatus } from '../types/game';

interface GameHudProps {
  score: number;
  highScore: number;
  level: number;
  status: GameStatus;
  mode: GameMode;
  muted: boolean;
  comboMultiplier: number;
  comboRatio: number; // 0..1 remaining time in 4-second combo window
  activeEffects: ActiveEffectsSnapshot;
  isBoosting: boolean;
  canBoost: boolean;
  onTogglePause: () => void;
  onToggleMute: () => void;
}

function formatSeconds(ms: number): string {
  return `${Math.max(0.1, ms / 1000).toFixed(1)}s`;
}

export function GameHud({
  score,
  highScore,
  level,
  status,
  mode,
  muted,
  comboMultiplier,
  comboRatio,
  activeEffects,
  isBoosting,
  canBoost,
  onTogglePause,
  onToggleMute,
}: GameHudProps) {
  const canPause = status === 'PLAYING' || status === 'PAUSED';
  const isPaused = status === 'PAUSED';

  const hasGhost = activeEffects.ghostRemainingMs > 0;
  const hasChrono = activeEffects.chronoRemainingMs > 0;
  const hasGlitch = activeEffects.glitchRemainingMs > 0;
  const hasActiveEffect = hasGhost || hasChrono || hasGlitch;

  const modeLabel =
    mode === 'flashlight' ? 'Flashlight' : mode === 'duel' ? 'Duel AI' : 'Arcade';

  return (
    <div className="w-full flex flex-col gap-1.5 shrink-0">
      <header className="w-full flex items-center justify-between gap-3 md:gap-6 px-3.5 py-2 md:px-5 md:py-3 rounded-xl bg-[#111827] border border-slate-800/90 shrink-0">
        {/* Left: Core Metrics + Slim 4s Combo Timer Bar under Score */}
        <div className="flex items-center gap-3.5 sm:gap-4 md:gap-5 shrink-0">
          <div className="flex flex-col shrink-0 whitespace-nowrap min-w-[66px] sm:min-w-[82px]">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] sm:text-xs font-medium text-slate-400 leading-none">
                Score
              </span>
              {comboMultiplier > 1 && comboRatio > 0 && (
                <span className="animate-combo-pulse font-mono text-[10px] font-bold text-amber-300 leading-none">
                  x{comboMultiplier} COMBO
                </span>
              )}
            </div>
            <span
              className="mt-1 font-mono text-lg sm:text-2xl font-bold text-slate-50 tabular-nums leading-none tracking-tight"
              data-testid="hud-score"
            >
              {score}
            </span>
            {/* Slim 4-second combo timer bar directly under Score */}
            <div className="mt-1.5 h-1 w-full rounded-full bg-slate-800/90 overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-75 ${
                  comboMultiplier >= 4
                    ? 'bg-amber-400'
                    : comboMultiplier >= 2
                      ? 'bg-emerald-400'
                      : 'bg-emerald-500/70'
                }`}
                style={{ width: `${Math.round(Math.max(0, Math.min(1, comboRatio)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="h-7 w-px bg-slate-800 shrink-0" aria-hidden="true" />

          <div className="flex flex-col shrink-0 whitespace-nowrap">
            <span className="text-[11px] sm:text-xs font-medium text-slate-400 leading-none">
              High Score
            </span>
            <span
              className="mt-1 font-mono text-lg sm:text-2xl font-bold text-amber-400 tabular-nums leading-none tracking-tight"
              data-testid="hud-high-score"
            >
              {highScore}
            </span>
          </div>

          <div className="h-7 w-px bg-slate-800 shrink-0" aria-hidden="true" />

          <div className="flex flex-col shrink-0 whitespace-nowrap">
            <span className="text-[11px] sm:text-xs font-medium text-slate-400 leading-none">
              Level
            </span>
            <span
              className="mt-1 font-mono text-lg sm:text-2xl font-bold text-emerald-400 tabular-nums leading-none tracking-tight"
              data-testid="hud-level"
            >
              {level}
            </span>
          </div>
        </div>

        {/* Right: Functional Controls (Pause/Resume + Mute/Unmute) */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button
            type="button"
            onClick={onTogglePause}
            disabled={!canPause}
            aria-label={isPaused ? 'Resume game' : 'Pause game'}
            title={
              canPause
                ? isPaused
                  ? 'Resume (Space / P)'
                  : 'Pause (Space / P)'
                : 'Start a game to pause'
            }
            className={`inline-flex items-center justify-center gap-2 h-10 px-3 md:px-4 rounded-lg border text-xs md:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827] ${
              canPause
                ? isPaused
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25 cursor-pointer'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-100 hover:bg-slate-700/80 cursor-pointer'
                : 'bg-slate-900/50 border-slate-800/60 text-slate-600 cursor-not-allowed'
            }`}
          >
            {isPaused ? (
              <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
            ) : (
              <Pause className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span className="hidden md:inline whitespace-nowrap">
              {isPaused ? 'Resume' : 'Pause'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
            aria-pressed={muted}
            title={muted ? 'Unmute sound' : 'Mute sound'}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 hover:text-white transition-colors cursor-pointer shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827]"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {/* Compact fixed-height Effect Countdown & Status Strip directly beneath HUD (prevents canvas resize jumps) */}
      <div className="w-full h-6 flex items-center justify-between gap-2 px-1 overflow-hidden">
        {hasActiveEffect ? (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {hasGhost && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/50 text-sky-200 font-mono text-[11px] font-semibold whitespace-nowrap shrink-0">
                <Ghost className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>GHOST {formatSeconds(activeEffects.ghostRemainingMs)}</span>
              </span>
            )}
            {hasChrono && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/50 text-blue-200 font-mono text-[11px] font-semibold whitespace-nowrap shrink-0">
                <Snowflake className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>FREEZE {formatSeconds(activeEffects.chronoRemainingMs)}</span>
              </span>
            )}
            {hasGlitch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-600/30 border border-purple-400/70 text-purple-200 font-mono text-[11px] font-bold whitespace-nowrap shrink-0 animate-pulse">
                <Shuffle className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>INVERTED! {formatSeconds(activeEffects.glitchRemainingMs)}</span>
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-slate-400 whitespace-nowrap">
            <span>{modeLabel} Mode</span>
            {status === 'PLAYING' && (
              <>
                <span className="text-slate-700" aria-hidden="true">
                  ·
                </span>
                <span
                  className={
                    isBoosting
                      ? 'text-orange-400 font-semibold'
                      : canBoost
                        ? 'text-slate-400'
                        : 'text-slate-500'
                  }
                >
                  {isBoosting
                    ? 'Boosting (2x Speed)'
                    : canBoost
                      ? 'Boost Ready'
                      : 'Boost Empty (Len ≤ 3)'}
                </span>
              </>
            )}
          </div>
        )}

        {isBoosting && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-400/60 text-orange-300 font-mono text-[11px] font-bold whitespace-nowrap shrink-0">
            <Flame className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>2x</span>
          </span>
        )}
      </div>
    </div>
  );
}
