import React, { useEffect } from 'react';
import { Play, BookOpen, Volume2, VolumeX, Grid, Gamepad2 } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface TitleScreenProps {
  unlockedMaxLevel: number;
  muted: boolean;
  gamepadConnected: boolean;
  introState?: 'active' | 'exiting' | 'done';
  onToggleMute: () => void;
  onPlayHighest: () => void;
  onOpenLevels: () => void;
  onStartTutorial: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  unlockedMaxLevel,
  muted,
  gamepadConnected,
  introState = 'done',
  onToggleMute,
  onPlayHighest,
  onOpenLevels,
  onStartTutorial,
}) => {
  useEffect(() => {
    if (introState !== 'done') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter') {
        e.preventDefault();
        onPlayHighest();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [introState, onPlayHighest]);

  const isRevealed = introState === 'exiting' || introState === 'done';

  return (
    <div
      className={`absolute inset-0 z-20 grid grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center justify-items-center p-2.5 @[640px]:p-4 group-data-[compact=false]/root:@[768px]:p-10 bg-gradient-to-b from-[#0d1117]/88 via-[#0d1117]/60 to-[#0d1117]/92 overflow-hidden transition-[opacity,transform] duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isRevealed ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97] pointer-events-none'
      }`}
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.625rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Top bar */}
      <div className="self-start w-full max-w-4xl flex items-center justify-end gap-2 shrink-0">
        <div className="flex items-center gap-1.5 @[640px]:gap-2 shrink-0">
          {gamepadConnected && (
            <span className="inline-flex items-center gap-1 text-[11px] @[640px]:text-xs font-medium text-emerald-400 whitespace-nowrap">
              <Gamepad2 className="w-3.5 h-3.5" />
              <span className="hidden @[640px]:inline">Controller Ready</span>
            </span>
          )}
          <PWAInstallButton />
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center gap-1.5 px-2.5 @[640px]:px-3 py-1.5 min-h-[34px] @[640px]:min-h-[36px] rounded-lg border border-slate-800/80 bg-[#0d1117]/80 text-[11px] @[640px]:text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{muted ? 'Muted' : 'Sound On'}</span>
          </button>
        </div>
      </div>

      {/* Center Lockup - mathematically centered across desktop & mobile landscape viewports */}
      <div className="self-center justify-self-center w-full max-w-2xl flex flex-col items-center justify-center text-center mx-auto my-auto px-2 py-1 group-data-[compact=false]/root:@[768px]:py-6">
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 group-data-[compact=false]/root:@[640px]:w-14 group-data-[compact=false]/root:@[640px]:h-14 group-data-[compact=false]/root:@[768px]:w-20 group-data-[compact=false]/root:@[768px]:h-20 mb-2 group-data-[compact=false]/root:@[768px]:mb-5 shrink-0"
          aria-hidden="true"
        >
          <circle cx="40" cy="40" r="34" stroke="#A855F7" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="6 4" />
          <circle cx="40" cy="40" r="24" stroke="#38BDF8" strokeOpacity="0.6" strokeWidth="1.5" />
          <rect x="24" y="27" width="8" height="26" rx="2" fill="#334155" />
          <rect x="48" y="27" width="8" height="26" rx="2" fill="#334155" />
          <rect x="30" y="30" width="20" height="22" rx="2" fill="#EAB308" />
          <rect x="37.5" y="15" width="5" height="19" rx="1.5" fill="#FDE047" />
          <circle cx="40" cy="41" r="6.5" fill="#CA8A04" stroke="#FEF08A" strokeWidth="1.5" />
        </svg>

        <h1 className="font-display text-2xl @[640px]:text-3xl group-data-[compact=false]/root:@[640px]:text-4xl group-data-[compact=false]/root:@[768px]:text-6xl font-bold tracking-tight text-white uppercase leading-none">
          Tank Spartan: Portal Siege
        </h1>
        <p className="mt-1.5 group-data-[compact=false]/root:@[640px]:mt-2.5 group-data-[compact=false]/root:@[768px]:mt-3 text-xs group-data-[compact=false]/root:@[640px]:text-sm group-data-[compact=false]/root:@[768px]:text-base text-slate-300 max-w-md leading-snug">
          Fight monster waves, grab Gold to upgrade your tank, and beat big Bosses across 100 levels.
        </p>

        <div className="mt-3 @[640px]:mt-4 group-data-[compact=false]/root:@[768px]:mt-8 flex flex-wrap items-center justify-center gap-2 @[640px]:gap-3">
          <button
            type="button"
            onClick={onPlayHighest}
            className="inline-flex items-center gap-2 px-5 py-2 group-data-[compact=false]/root:@[768px]:px-7 group-data-[compact=false]/root:@[768px]:py-3 min-h-[38px] group-data-[compact=false]/root:@[640px]:min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs @[640px]:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{unlockedMaxLevel > 1 ? `Play Level ${unlockedMaxLevel}` : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenLevels}
            className="inline-flex items-center gap-2 px-4 py-2 group-data-[compact=false]/root:@[768px]:px-5 group-data-[compact=false]/root:@[768px]:py-3 min-h-[38px] group-data-[compact=false]/root:@[640px]:min-h-[44px] rounded-lg border border-slate-700/90 bg-[#0d1117]/85 hover:bg-slate-800/90 text-slate-100 font-medium text-xs @[640px]:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Grid className="w-4 h-4 text-sky-400" />
            <span>Levels (1–100)</span>
          </button>

          <button
            type="button"
            onClick={onStartTutorial}
            className="inline-flex items-center gap-2 px-4 py-2 group-data-[compact=false]/root:@[768px]:px-5 group-data-[compact=false]/root:@[768px]:py-3 min-h-[38px] group-data-[compact=false]/root:@[640px]:min-h-[44px] rounded-lg border border-slate-700/90 bg-[#0d1117]/85 hover:bg-slate-800/90 text-slate-100 font-medium text-xs @[640px]:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>How to Play</span>
          </button>
        </div>
      </div>

      {/* Control Hint */}
      <div className="self-end text-[10px] @[640px]:text-xs text-slate-400 text-center font-mono-tabular shrink-0 truncate max-w-full">
        Dual-Stick Touch · Gamepad · WASD + Mouse · Esc Pause
      </div>
    </div>
  );
};
