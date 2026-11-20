import { X } from 'lucide-react';

interface GuideModalProps {
  open: boolean;
  onClose: () => void;
}

const POWER_UPS = [
  {
    name: 'Shrink Berry',
    swatch: 'bg-teal-400',
    desc: 'Removes 4 tail segments (min length 3) while keeping your score.',
  },
  {
    name: 'Timed Golden Apple',
    swatch: 'bg-yellow-400',
    desc: '5-second timer ring. Worth +50 base points multiplied by active combo.',
  },
  {
    name: 'Ghost Fruit',
    swatch: 'bg-sky-200',
    desc: '5s Phase-Shift: pass through body, walls, obstacles, and AI; wrap edges.',
  },
  {
    name: 'Chrono Crystal',
    swatch: 'bg-blue-400',
    desc: '6s Freeze: halves snake speed with a frosted border for tight precision.',
  },
  {
    name: 'Glitch Hazard',
    swatch: 'bg-purple-500',
    desc: 'Decoy hazard (10s). Eating it inverts directional controls for 5s!',
  },
];

export function GuideModal({ open, onClose }: GuideModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05080F]/85 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] max-h-[86dvh] overflow-y-auto rounded-2xl bg-[#111827] border border-slate-700/80 p-5 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <h2
            id="guide-modal-title"
            className="font-display text-lg sm:text-xl font-bold text-slate-50"
          >
            Power-Ups &amp; Arcade Guide
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-left">
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Special Foods &amp; Power-Ups
            </h3>
            <ul className="space-y-2">
              {POWER_UPS.map((item) => (
                <li
                  key={item.name}
                  className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300 leading-snug"
                >
                  <span
                    className={`mt-1 w-3 h-3 rounded-sm shrink-0 ${item.swatch}`}
                    aria-hidden="true"
                  />
                  <div>
                    <span className="font-semibold text-slate-100">{item.name}: </span>
                    <span>{item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="pt-3 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Active Skills &amp; Scoring
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300 leading-snug">
              <li>
                <span className="font-semibold text-slate-100">Combo Streak: </span>
                Eat within 4 seconds to stack multipliers up to 5x.
              </li>
              <li>
                <span className="font-semibold text-slate-100">Tail-Burn Boost: </span>
                Hold Shift (or BOOST on mobile) for 2x speed. Burns 1 tail segment per second (stops at length 3).
              </li>
              <li>
                <span className="font-semibold text-slate-100">Near-Miss Bonus: </span>
                Turn away at the final tile before a lethal crash for +5 Close Call points.
              </li>
            </ul>
          </section>

          <section className="pt-3 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Dynamic Arenas &amp; Modes
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300 leading-snug">
              <li>
                <span className="font-semibold text-slate-100">Portals &amp; Obstacles: </span>
                Level 2+ adds linked blue/orange portals and telegraphed walls (2s amber warning).
              </li>
              <li>
                <span className="font-semibold text-slate-100">Sudden Death (Lv 5+): </span>
                Outer rings electrify every 20s after a 3s warning, down to an 8×8 center.
              </li>
              <li>
                <span className="font-semibold text-slate-100">Duel AI Shatter: </span>
                Cut off the crimson rival AI to shatter it into +15 bonus mini-pellets.
              </li>
            </ul>
          </section>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full h-10 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );
}
