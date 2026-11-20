import { Info, Lock, Play, RotateCcw } from 'lucide-react';
import { STARTING_LEVEL_PRESETS } from '../constants/levels';
import { isThemeUnlocked, THEMES } from '../constants/themes';
import type { GameMode, GameStatus, ThemeId, ToastNotice } from '../types/game';

interface BoardOverlaysProps {
  status: GameStatus;
  mode: GameMode;
  themeId: ThemeId;
  score: number;
  highScore: number;
  highestLevel: number;
  bestCombo: number;
  isNewHighScore: boolean;
  startingLevel: number;
  toast: ToastNotice | null;
  onSelectMode: (mode: GameMode) => void;
  onSelectTheme: (themeId: ThemeId) => void;
  onSelectStartingLevel: (level: number) => void;
  onOpenGuide: () => void;
  onStartNewGame: () => void;
  onResumeGame: () => void;
  onReturnToMenu: () => void;
}

const MODE_OPTIONS: Array<{ id: GameMode; label: string; blurb: string }> = [
  {
    id: 'arcade',
    label: 'Arcade',
    blurb: 'Dynamic obstacles, linked portals, power-ups & Level 5+ shrinking arena.',
  },
  {
    id: 'flashlight',
    label: 'Flashlight',
    blurb: 'Fog of war illuminated around your head with a pulsing food beacon.',
  },
  {
    id: 'duel',
    label: 'Duel AI',
    blurb: 'Race a rival AI snake. Cut it off to shatter it into +15 bonus pellets.',
  },
];

export function BoardOverlays({
  status,
  mode,
  themeId,
  score,
  highScore,
  highestLevel,
  bestCombo,
  isNewHighScore,
  startingLevel,
  toast,
  onSelectMode,
  onSelectTheme,
  onSelectStartingLevel,
  onOpenGuide,
  onStartNewGame,
  onResumeGame,
  onReturnToMenu,
}: BoardOverlaysProps) {
  const activeModeMeta = MODE_OPTIONS.find((m) => m.id === mode) ?? MODE_OPTIONS[0];

  const toastToneClasses: Record<ToastNotice['tone'], string> = {
    amber: 'border-amber-400/60 text-amber-300',
    emerald: 'border-emerald-400/60 text-emerald-300',
    rose: 'border-rose-400/70 text-rose-300',
    purple: 'border-purple-400/70 text-purple-300',
    cyan: 'border-cyan-400/70 text-cyan-300',
  };

  return (
    <>
      {/* Non-intrusive Top Banner Toast (Level Up / Theme Unlocked / Sudden Death) */}
      {toast && status === 'PLAYING' && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`animate-level-up pointer-events-none absolute top-3.5 left-1/2 z-20 px-4 py-1.5 rounded-lg bg-[#0B1220]/92 border shadow-lg backdrop-blur-xs ${toastToneClasses[toast.tone]}`}
        >
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-display text-xs sm:text-sm font-extrabold tracking-wide">
              {toast.title}
            </span>
            {toast.subtitle && (
              <>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-xs font-semibold text-slate-100 tabular-nums">
                  {toast.subtitle}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Start Screen Overlay */}
      {status === 'START' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-5 md:p-7 bg-[#090D16]/90 backdrop-blur-[3px] overflow-y-auto">
          <div className="w-full max-w-[380px] md:max-w-[440px] flex flex-col items-center text-center my-auto">
            {/* Header Row: Title + Guide Button */}
            <div className="w-full flex items-center justify-between gap-2">
              <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-slate-50 whitespace-nowrap">
                Snake Arcade
              </h1>
              <button
                type="button"
                onClick={onOpenGuide}
                className="inline-flex items-center gap-1.5 h-8 sm:h-9 px-3 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-slate-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>Guide</span>
              </button>
            </div>

            {/* Game Mode Selector */}
            <div className="mt-3 sm:mt-4 w-full text-left">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400 mb-1 px-0.5">
                <span>Game Mode</span>
              </div>
              <div
                role="radiogroup"
                aria-label="Select game mode"
                className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0E1525] border border-slate-800"
              >
                {MODE_OPTIONS.map((opt) => {
                  const selected = mode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onSelectMode(opt.id)}
                      className={`h-8 sm:h-9 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                        selected
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] sm:text-xs text-slate-400 leading-snug px-0.5">
                {activeModeMeta.blurb}
              </p>
            </div>

            {/* Starting Level Selector */}
            <div className="mt-2.5 sm:mt-3.5 w-full">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400 mb-1 px-0.5">
                <span>Start Level</span>
                <span className="font-mono text-slate-300 tabular-nums">
                  {STARTING_LEVEL_PRESETS.find((p) => p.level === startingLevel)?.speedLabel ??
                    'Classic'}
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
                      className={`h-8 sm:h-9 rounded-lg font-mono text-xs sm:text-sm font-semibold tabular-nums transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
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

            {/* Unlockable Theme Selector */}
            <div className="mt-2.5 sm:mt-3.5 w-full">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400 mb-1 px-0.5">
                <span>Arena Theme</span>
                <span className="text-[11px] text-slate-400">Unlocks via High Score</span>
              </div>
              <div
                role="radiogroup"
                aria-label="Select visual theme"
                className="grid grid-cols-2 gap-1.5"
              >
                {THEMES.map((t) => {
                  const unlocked = isThemeUnlocked(t.id, highScore);
                  const selected = themeId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!unlocked}
                      onClick={() => unlocked && onSelectTheme(t.id)}
                      title={
                        unlocked
                          ? t.name
                          : `Reach ${t.unlockScore} High Score to unlock ${t.name}`
                      }
                      className={`h-9 sm:h-10 px-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                        !unlocked
                          ? 'bg-[#0C1220]/70 border-slate-800/70 text-slate-500 cursor-not-allowed'
                          : selected
                            ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200 cursor-pointer'
                            : 'bg-[#0E1525] border-slate-800 text-slate-200 hover:border-slate-600 cursor-pointer'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0 truncate">
                        <span
                          className="w-3 h-3 rounded-xs border border-white/20 shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${t.swatchBg} 45%, ${t.swatchSnake} 45%)`,
                          }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{t.shortName}</span>
                      </span>
                      {!unlocked && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500 shrink-0">
                          <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                          {t.unlockScore}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={onStartNewGame}
              className="mt-3.5 sm:mt-4 w-full h-10 sm:h-12 px-6 py-2 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-display font-bold text-sm sm:text-base tracking-tight transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090D16]"
            >
              <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
              <span>Start New Game</span>
            </button>
          </div>
        </div>
      )}

      {/* Paused Overlay */}
      {status === 'PAUSED' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-[#090D16]/78 backdrop-blur-[3px] overflow-y-auto">
          <div className="w-full max-w-[320px] md:max-w-[360px] flex flex-col items-center text-center">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-50">
              Paused
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300">
              Press Space or P to continue
            </p>

            <div className="mt-5 w-full flex flex-col gap-3">
              <button
                type="button"
                onClick={onResumeGame}
                className="w-full h-11 px-5 py-2.5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm sm:text-base transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                <span>Resume</span>
              </button>

              <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-3 w-full">
                <button
                  type="button"
                  onClick={onStartNewGame}
                  className="flex-1 min-w-[120px] px-5 py-2.5 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-slate-100 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Restart</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToMenu}
                  className="flex-1 min-w-[136px] px-5 py-2.5 inline-flex items-center justify-center rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-100 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Change Setup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over / Victory Overlay */}
      {(status === 'GAME_OVER' || status === 'VICTORY') && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-[#090D16]/88 backdrop-blur-[3px] overflow-y-auto">
          <div className="w-full max-w-[340px] md:max-w-[390px] flex flex-col items-center text-center">
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
              <div className="flex flex-col items-center px-2">
                <span className="text-[11px] sm:text-xs text-slate-400 whitespace-nowrap">
                  Final Score
                </span>
                <span className="mt-1 font-mono text-xl sm:text-2xl font-bold text-slate-50 tabular-nums">
                  {score}
                </span>
              </div>

              <div className="flex flex-col items-center px-2 border-x border-slate-800">
                <span className="text-[11px] sm:text-xs text-slate-400 whitespace-nowrap">
                  Top Level
                </span>
                <span className="mt-1 font-mono text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">
                  {highestLevel}
                </span>
              </div>

              <div className="flex flex-col items-center px-2">
                <span className="text-[11px] sm:text-xs text-slate-400 whitespace-nowrap">
                  High Score
                </span>
                <span className="mt-1 font-mono text-xl sm:text-2xl font-bold text-amber-400 tabular-nums">
                  {highScore}
                </span>
              </div>
            </div>

            {bestCombo > 1 && (
              <p className="mt-2.5 text-xs text-slate-400">
                Peak Combo Streak:{' '}
                <span className="font-mono font-semibold text-amber-300">x{bestCombo}</span>
              </p>
            )}

            <div className="mt-5 w-full flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={onStartNewGame}
                className="w-full h-12 px-6 py-2.5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-display font-bold text-base tracking-tight transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090D16]"
              >
                <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Play Again</span>
              </button>

              <button
                type="button"
                onClick={onReturnToMenu}
                className="px-5 py-2.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg"
              >
                Change Mode, Level or Theme
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
