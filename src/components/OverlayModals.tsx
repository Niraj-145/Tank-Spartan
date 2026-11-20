import React from 'react';
import { Play, RotateCcw, ShoppingBag, Home } from 'lucide-react';
import { MAX_GAME_LEVEL, getPowerTankForm, getPowerTankTier } from '../game/data';
import { HudSnapshot } from '../game/types';

interface OverlayModalsProps {
  hud: HudSnapshot;
  onResume: () => void;
  onOpenStoreAfterLevel: () => void;
  onNextLevel: () => void;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export const OverlayModals: React.FC<OverlayModalsProps> = ({
  hud,
  onResume,
  onOpenStoreAfterLevel,
  onNextLevel,
  onPlayAgain,
  onMainMenu,
}) => {
  if (hud.phase !== 'PAUSED' && hud.phase !== 'LEVEL_COMPLETE' && hud.phase !== 'GAME_OVER') {
    return null;
  }

  const nextLv = Math.min(MAX_GAME_LEVEL, hud.level + 1);
  const nextIsPowerUp = nextLv % 5 === 0 && hud.level < MAX_GAME_LEVEL;
  const nextIsMegaBoss = nextLv % 10 === 0 && hud.level < MAX_GAME_LEVEL;
  const nextForm = getPowerTankForm(getPowerTankTier(nextLv));

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-[#0d1117]/85"
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-md max-h-[92%] overflow-y-auto bg-[#151c26] border border-slate-700 rounded-xl p-4 sm:p-6 text-center">
        {hud.phase === 'PAUSED' && (
          <>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white uppercase leading-none">
              Paused
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
              {hud.isTutorial
                ? 'How to Play'
                : `Level ${hud.level} · Wave ${hud.wave} of ${hud.totalWaves}`}
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResume}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume</span>
              </button>
              <button
                type="button"
                onClick={onMainMenu}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>
            </div>
          </>
        )}

        {hud.phase === 'LEVEL_COMPLETE' && (
          <>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-emerald-400 uppercase leading-none">
              {hud.level >= MAX_GAME_LEVEL ? 'All 100 Levels Won!' : `Level ${hud.level} Win!`}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-snug">
              {nextIsPowerUp
                ? `Next: Level ${nextLv} gives ${nextForm.name}${
                    nextLv <= 20 ? ' + New Stronger Gun in Shop' : ''
                  }!`
                : `Tank auto-upgrades (+HP, +Speed, +Power) and Shop Level ${nextLv} is open.`}
              {nextIsMegaBoss ? ' Next is a 5-Wave Super Boss level!' : ''}
            </p>

            <div className="mt-4 grid grid-cols-2 @[420px]:grid-cols-4 gap-y-2.5 py-2.5 border-y border-slate-800 text-center">
              <div className="px-2">
                <div className="text-[11px] text-slate-400">Score</div>
                <div className="text-sm sm:text-base font-bold text-sky-300 font-mono-tabular">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div className="px-2">
                <div className="text-[11px] text-slate-400">Best Combo</div>
                <div className="text-sm sm:text-base font-bold text-orange-400 font-mono-tabular">
                  {hud.bestCombo}x
                </div>
              </div>
              <div className="px-2">
                <div className="text-[11px] text-slate-400">Kills</div>
                <div className="text-sm sm:text-base font-bold text-white font-mono-tabular">
                  {hud.levelKills}
                </div>
              </div>
              <div className="px-2">
                <div className="text-[11px] text-slate-400">Gold</div>
                <div className="text-sm sm:text-base font-bold text-amber-400 font-mono-tabular">
                  {hud.gold}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {hud.level < MAX_GAME_LEVEL ? (
                <>
                  <button
                    type="button"
                    onClick={onOpenStoreAfterLevel}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Open Shop</span>
                  </button>
                  <button
                    type="button"
                    onClick={onNextLevel}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Next Level ({nextLv})</span>
                  </button>
                  <button
                    type="button"
                    onClick={onMainMenu}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-sm transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Home className="w-4 h-4" />
                    <span>Home</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onMainMenu}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </button>
              )}
            </div>
          </>
        )}

        {hud.phase === 'GAME_OVER' && (
          <>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-rose-500 uppercase leading-none">
              You Lost
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
              Level {hud.level} · Wave {hud.wave} of {hud.totalWaves}
            </p>

            <div className="mt-4 grid grid-cols-2 @[420px]:grid-cols-4 gap-y-2.5 py-2.5 border-y border-slate-800 text-center">
              <div className="px-2">
                <div className="text-[11px] text-slate-400">Score</div>
                <div className="text-sm sm:text-base font-bold text-sky-300 font-mono-tabular">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div className="px-2">
                <div className="text-[11px] text-slate-400">Best Combo</div>
                <div className="text-sm sm:text-base font-bold text-orange-400 font-mono-tabular">
                  {hud.bestCombo}x
                </div>
              </div>
              <div className="px-2">
                <div className="text-[11px] text-slate-400">Kills</div>
                <div className="text-sm sm:text-base font-bold text-white font-mono-tabular">
                  {hud.totalKills}
                </div>
              </div>
              <div className="px-2">
                <div className="text-[11px] text-slate-400">High Score</div>
                <div className="text-sm sm:text-base font-bold text-amber-400 font-mono-tabular">
                  {hud.highScore.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={onPlayAgain}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={onMainMenu}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
