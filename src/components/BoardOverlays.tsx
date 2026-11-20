import { Play, RotateCcw } from 'lucide-react';
import { STARTING_LEVEL_PRESETS } from '../game/constants';
import type { GameStatus } from '../game/types';

interface BoardOverlaysProps {
  status: GameStatus;
  score: number;
  highScore: number;
  highestLevel: number;
  isNewHighScore: boolean;
  startingLevel: number;
  levelUpBanner: { level: number; key: number } | null;
  onSelectStartingLevel: (level: number) => void;
  onStartNewGame: () => void;
  onResumeGame: () => void;
  onReturnToMenu: () => void;
}

export function BoardOverlays({
  status,
  score,
  highScore,
  highestLevel,
  isNewHighScore,
  startingLevel,
  levelUpBanner,
  onSelectStartingLevel,
  onStartNewGame,
  onResumeGame,
  onReturnToMenu,
}: BoardOverlaysProps) {
  return (
    <>
      {/* Non-intrusive Level Up Notification */}
      {levelUpBanner && status === 'PLAYING' && (
        <div
          key={levelUpBanner.key}
          role="status"
          aria-live="polite"
          className="animate-level-up pointer-events-none absolute top-4 left-1/2 z-20 px-4 py-1.5 rounded-lg bg-[#0B1220]/90 border border-amber-400/50 shadow-lg backdrop-blur-xs"
        >
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-display text-sm sm:text-base font-extrabold tracking-wide text-amber-400">
              LEVEL UP!
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-xs sm:text-sm font-semibold text-slate-100 tabular-nums">
              Level {levelUpBanner.level}
            </span>
          </div>
        </div>
      )}

      {/* Start Screen Overlay */}
      {status === 'START' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-3.5 sm:p-6 bg-[#090D16]/88 backdrop-blur-[3px] overflow-y-auto">
          <div className="w-full max-w-[360px] flex flex-col items-center text-center">
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-50 [text-wrap:balance]">
              Snake Arcade
            </h1>

            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-[310px]">
              Steer with{' '}
              <span className="text-slate-100 font-medium">Arrow Keys</span> or{' '}
              <span className="text-slate-100 font-medium">WASD</span> on desktop, or use the{' '}
              <span className="text-slate-100 font-medium">D-pad</span> below on mobile.
            </p>

            {/* Starting Level Selector */}
            <div className="mt-3.5 sm:mt-5 w-full">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 sm:mb-2 px-0.5">
                <span>Starting Level</span>
                <span className="font-mono text-slate-300 tabular-nums">
                  {STARTING_LEVEL_PRESETS.find((p) => p.level === startingLevel)?.speedLabel ?? 'Classic'}
                </span>
              </div>
              <div
                role="radiogroup"
                aria-label="Select starting level"
                className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-[#0E1525] border border-slate-800"
              >
                {STARTING_LEVEL_PRESETS.map((preset) => {
                  const selected = startingLevel === preset.level;
                  return (
                    <button
                      key={preset.level}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onSelectStartingLevel(preset.level)}
                      className={`h-9 sm:h-10 rounded-lg font-mono text-sm font-semibold tabular-nums transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                        selected
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      {preset.level}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={onStartNewGame}
              className="mt-3.5 sm:mt-5 w-full h-11 sm:h-12 px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-display font-bold text-sm sm:text-base tracking-tight transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090D16]"
            >
              <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
              <span>Start New Game</span>
            </button>

            <p className="mt-2.5 sm:mt-3 text-[11px] sm:text-xs text-slate-400">
              Press Space or P anytime to pause
            </p>
          </div>
        </div>
      )}

      {/* Paused Overlay */}
      {status === 'PAUSED' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6 bg-[#090D16]/78 backdrop-blur-[3px]">
          <div className="w-full max-w-[290px] flex flex-col items-center text-center">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-50">
              Paused
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300">
              Press Space or P to continue
            </p>

            <div className="mt-5 w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResumeGame}
                className="w-full h-11 px-5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm sm:text-base transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                <span>Resume</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onStartNewGame}
                  className="h-10 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-slate-100 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Restart</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToMenu}
                  className="h-10 px-3 inline-flex items-center justify-center rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-100 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Change Level
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over / Victory Overlay */}
      {(status === 'GAME_OVER' || status === 'VICTORY') && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6 bg-[#090D16]/88 backdrop-blur-[3px]">
          <div className="w-full max-w-[340px] flex flex-col items-center text-center">
            <h2
              className={`font-display text-3xl sm:text-4xl font-extrabold tracking-tight ${
                status === 'VICTORY' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {status === 'VICTORY' ? 'Board Cleared' : 'Game Over'}
            </h2>

            {isNewHighScore && (
              <p className="mt-1.5 text-xs sm:text-sm font-semibold text-amber-400">
                New High Score
              </p>
            )}

            {/* Clean unboxed stat summary with hairline dividers */}
            <div className="mt-5 w-full grid grid-cols-3 border-y border-slate-800 py-3.5">
              <div className="flex flex-col items-center px-1">
                <span className="text-[11px] sm:text-xs text-slate-400">Final Score</span>
                <span className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-50 tabular-nums">
                  {score}
                </span>
              </div>

              <div className="flex flex-col items-center px-1 border-x border-slate-800">
                <span className="text-[11px] sm:text-xs text-slate-400">Top Level</span>
                <span className="mt-1 font-mono text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">
                  {highestLevel}
                </span>
              </div>

              <div className="flex flex-col items-center px-1">
                <span className="text-[11px] sm:text-xs text-slate-400">High Score</span>
                <span className="mt-1 font-mono text-xl sm:text-2xl font-bold text-amber-400 tabular-nums">
                  {highScore}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onStartNewGame}
              className="mt-5 w-full h-12 px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-display font-bold text-base tracking-tight transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090D16]"
            >
              <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Play Again</span>
            </button>

            <button
              type="button"
              onClick={onReturnToMenu}
              className="mt-2.5 h-9 px-4 text-xs sm:text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg"
            >
              Change Starting Level
            </button>
          </div>
        </div>
      )}
    </>
  );
}
