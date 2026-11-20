import React, { useState } from 'react';
import { ArrowLeft, Lock, Shield, Skull } from 'lucide-react';
import { MAX_GAME_LEVEL, getPowerTankForm, getPowerTankTier } from '../game/data';

interface LevelsScreenProps {
  unlockedMaxLevel: number;
  onSelectLevel: (level: number) => void;
  onBack: () => void;
}

const RANGES = [
  { label: '1 – 20', start: 1, end: 20 },
  { label: '21 – 40', start: 21, end: 40 },
  { label: '41 – 60', start: 41, end: 60 },
  { label: '61 – 80', start: 61, end: 80 },
  { label: '81 – 100', start: 81, end: 100 },
];

export const LevelsScreen: React.FC<LevelsScreenProps> = ({
  unlockedMaxLevel,
  onSelectLevel,
  onBack,
}) => {
  const initialRange = Math.min(4, Math.floor((unlockedMaxLevel - 1) / 20));
  const [rangeIndex, setRangeIndex] = useState(initialRange);
  const currentRange = RANGES[rangeIndex];

  const levels = Array.from(
    { length: currentRange.end - currentRange.start + 1 },
    (_, i) => currentRange.start + i
  );

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-between p-2.5 @[640px]:p-4 group-data-[compact=false]/root:@[768px]:p-8 bg-gradient-to-b from-[#0d1117]/92 via-[#0d1117]/82 to-[#0d1117]/94 overflow-hidden"
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.625rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Aligned Header + Range Tabs */}
      <div className="w-full max-w-5xl flex flex-col gap-2 group-data-[compact=false]/root:@[768px]:gap-3 shrink-0">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 @[768px]:gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg border border-slate-700 bg-[#151c26] hover:bg-slate-800 text-xs @[768px]:text-sm font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="text-center min-w-0">
            <h2 className="font-display text-xl @[640px]:text-2xl group-data-[compact=false]/root:@[768px]:text-3xl font-bold text-white uppercase tracking-tight leading-none">
              Select Level
            </h2>
            <p className="text-[10px] @[640px]:text-xs text-slate-400 mt-1 font-mono-tabular truncate">
              Unlocked {unlockedMaxLevel}/{MAX_GAME_LEVEL} · Every 5 Lv = Power Tank · Every 10 Lv = 5-Wave Boss
            </p>
          </div>

          <div className="hidden @[640px]:flex items-center justify-end min-w-[78px] text-xs font-mono-tabular text-amber-400 font-semibold whitespace-nowrap">
            Lv.{unlockedMaxLevel} / {MAX_GAME_LEVEL}
          </div>
          <div className="@[640px]:hidden w-[66px]" aria-hidden="true" />
        </div>

        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#151c26] border border-slate-800 max-w-full overflow-x-auto">
            {RANGES.map((r, idx) => (
              <button
                key={r.label}
                type="button"
                onClick={() => setRangeIndex(idx)}
                className={`px-2.5 @[640px]:px-3 py-1.5 min-h-[32px] rounded-md text-[11px] @[640px]:text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer font-mono-tabular ${
                  rangeIndex === idx
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 20-Level Responsive Grid */}
      <div className="w-full max-w-5xl flex-1 min-h-0 overflow-y-auto py-2 group-data-[compact=false]/root:@[768px]:py-4 grid grid-cols-2 @[600px]:grid-cols-4 @[768px]:grid-cols-5 gap-2 group-data-[compact=false]/root:@[768px]:gap-3 content-start">
        {levels.map((lv) => {
          const unlocked = lv <= unlockedMaxLevel;
          const isMegaBoss = lv % 10 === 0;
          const isPowerUp = lv % 5 === 0;
          const form = getPowerTankForm(getPowerTankTier(lv));

          return (
            <button
              key={lv}
              type="button"
              disabled={!unlocked}
              onClick={() => unlocked && onSelectLevel(lv)}
              className={`group flex flex-col justify-between p-2 group-data-[compact=false]/root:@[768px]:p-3.5 min-h-[56px] group-data-[compact=false]/root:@[768px]:min-h-[82px] rounded-lg border text-left transition-colors ${
                unlocked
                  ? isMegaBoss
                    ? 'bg-[#1a1520] border-rose-500/50 hover:border-rose-400 hover:bg-[#23192a] cursor-pointer'
                    : isPowerUp
                    ? 'bg-[#141f28] border-sky-500/45 hover:border-sky-400 hover:bg-[#192834] cursor-pointer'
                    : 'bg-[#151c26] border-slate-700/80 hover:border-amber-500 hover:bg-[#1b2431] cursor-pointer'
                  : 'bg-[#11161d] border-slate-800/70 opacity-55 cursor-not-allowed'
              }`}
            >
              <div className="w-full flex items-center justify-between gap-2">
                <span className="font-display text-xl md:text-2xl font-bold text-white font-mono-tabular leading-none">
                  {lv}
                </span>
                {!unlocked ? (
                  <Lock className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500 shrink-0" />
                ) : isMegaBoss ? (
                  <Skull className="w-3.5 h-3.5 md:w-4 md:h-4 text-rose-400 shrink-0" />
                ) : isPowerUp ? (
                  <Shield className="w-3.5 h-3.5 md:w-4 md:h-4 text-sky-400 shrink-0" />
                ) : null}
              </div>

              <div className="mt-2 md:mt-3 w-full">
                <div
                  className={`text-[11px] md:text-xs font-medium truncate ${
                    isMegaBoss
                      ? 'text-rose-300'
                      : isPowerUp
                      ? 'text-sky-300'
                      : unlocked
                      ? 'text-slate-300'
                      : 'text-slate-500'
                  }`}
                >
                  {isMegaBoss
                    ? '5-Wave Boss'
                    : isPowerUp
                    ? form.name
                    : '3 Waves'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-[11px] sm:text-xs text-slate-400 text-center shrink-0 pt-1">
        Win a level to unlock the next one
      </div>
    </div>
  );
};
