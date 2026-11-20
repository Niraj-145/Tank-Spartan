import React from 'react';
import { Pause, ShoppingBag, Volume2, VolumeX, Play, SkipForward, Gamepad2 } from 'lucide-react';
import { HudSnapshot, TutorialStepId } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  radarCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  muted: boolean;
  storeMinimized: boolean;
  touchControlsEnabled: boolean;
  onToggleMute: () => void;
  onToggleTouchControls: () => void;
  onPause: () => void;
  onReopenStore: () => void;
  onLaunchNextWave: () => void;
  onSkipTutorial: () => void;
}

const TUTORIAL_STEPS: { id: TutorialStepId; label: string }[] = [
  { id: 'MOVE', label: '1 · Drive' },
  { id: 'SHOOT', label: '2 · Aim & Shoot' },
  { id: 'COLLECT', label: '3 · Gold & XP' },
  { id: 'RADAR', label: '4 · Mini Map' },
  { id: 'STORE', label: '5 · Shop' },
];

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  radarCanvasRef,
  muted,
  storeMinimized,
  touchControlsEnabled,
  onToggleMute,
  onToggleTouchControls,
  onPause,
  onReopenStore,
  onLaunchNextWave,
  onSkipTutorial,
}) => {
  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const expPct = Math.max(0, Math.min(100, (hud.exp / Math.max(1, hud.expToNext)) * 100));
  const activeStepIdx = TUTORIAL_STEPS.findIndex((s) => s.id === hud.tutorialStep);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-2 sm:p-3 md:p-4"
      style={{
        paddingLeft: 'max(0.625rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.625rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
      }}
    >
      {/* Top Perimeter HUD */}
      <div className="w-full flex flex-wrap sm:flex-nowrap items-start justify-between gap-1.5 sm:gap-3 md:gap-4">
        {/* Top-Left: Tank HP, Level/XP, Gold */}
        <div className="order-1 w-[148px] sm:w-[190px] md:w-[220px] shrink-0 bg-[#0d1117]/88 border border-slate-800/90 rounded-lg px-2.5 py-2 md:px-3.5 md:py-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-1.5 text-[11px] md:text-xs">
            <span className="font-semibold text-slate-200 truncate">{hud.tankFormName}</span>
            <span className="font-mono-tabular text-slate-100 shrink-0">
              {hud.hp}/{hud.maxHp}
            </span>
          </div>
          <div className="h-1.5 md:h-2 w-full rounded bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${hpPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] md:text-xs">
            <span className="text-emerald-400 font-medium font-mono-tabular">
              Lv.{hud.rpgLevel}
            </span>
            <span className="text-amber-400 font-semibold font-mono-tabular">
              {hud.gold} Gold
            </span>
          </div>
          <div className="h-1.5 w-full rounded bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-150"
              style={{ width: `${expPct}%` }}
            />
          </div>
        </div>

        {/* Top-Center: Level, Wave, Monsters Left / Boss HP / Tutorial */}
        <div className="order-3 sm:order-2 w-full sm:w-auto sm:flex-1 min-w-0 flex flex-col items-center gap-1.5 md:gap-2">
          <div className="max-w-full bg-[#0d1117]/88 border border-slate-800/90 rounded-lg px-2.5 py-1.5 sm:px-4 sm:py-2 flex items-center justify-center gap-1.5 sm:gap-3 text-[11px] sm:text-xs md:text-sm whitespace-nowrap">
            {hud.isTutorial ? (
              <span className="font-semibold text-emerald-400">How to Play</span>
            ) : (
              <>
                <span className="font-semibold text-white font-mono-tabular">
                  Lv.{hud.level}
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-amber-400 font-medium font-mono-tabular">
                  Wave {hud.wave}/{hud.totalWaves}
                  {hud.wave === hud.totalWaves ? ' (Boss)' : ''}
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-300 font-mono-tabular">
                  Left: {hud.monstersRemaining}
                </span>
              </>
            )}
          </div>

          {hud.bossActive && (
            <div className="w-full max-w-[240px] sm:max-w-[320px] md:max-w-[384px] bg-[#0d1117]/90 border border-rose-500/50 rounded-lg px-3 py-1.5 md:px-3.5 md:py-2">
              <div className="flex items-center justify-between gap-2 text-[11px] md:text-xs mb-1">
                <span className="font-semibold text-rose-400 truncate">{hud.bossActive.name}</span>
                <span className="font-mono-tabular text-slate-200 shrink-0">
                  {hud.bossActive.hp} / {hud.bossActive.maxHp}
                </span>
              </div>
              <div className="h-2 md:h-2.5 w-full rounded bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-100"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, (hud.bossActive.hp / Math.max(1, hud.bossActive.maxHp)) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {hud.phase === 'INTER_WAVE_STORE' && storeMinimized && (
            <div className="pointer-events-auto bg-[#0d1117]/95 border border-amber-500/60 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <span className="text-xs font-medium text-amber-300 font-mono-tabular whitespace-nowrap">
                {hud.wave < hud.totalWaves
                  ? `Wave ${hud.wave + 1} in ${hud.interWaveTimer}s`
                  : `Level ${hud.level} Done`}
              </span>
              <button
                type="button"
                onClick={onReopenStore}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Shop</span>
              </button>
              <button
                type="button"
                onClick={onLaunchNextWave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{hud.wave < hud.totalWaves ? 'Next Wave' : `Level ${hud.level + 1}`}</span>
              </button>
            </div>
          )}

          {hud.isTutorial && hud.phase === 'PLAYING' && hud.tutorialProgressText && (
            <div className="pointer-events-auto bg-[#0d1117]/92 border border-emerald-500/45 rounded-lg px-2.5 py-1.5 sm:px-4 sm:py-2.5 w-full max-w-md md:max-w-xl space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1 min-w-0">
                  {TUTORIAL_STEPS.map((step, i) => {
                    const done = activeStepIdx > i;
                    const current = activeStepIdx === i;
                    return (
                      <span
                        key={step.id}
                        className={`text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
                          current
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : done
                            ? 'text-emerald-500'
                            : 'text-slate-500'
                        }`}
                      >
                        {step.label}
                      </span>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={onSkipTutorial}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Skip</span>
                  <SkipForward className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[11px] sm:text-xs md:text-sm text-slate-100 font-medium text-center leading-snug">
                {hud.tutorialProgressText}
              </p>
            </div>
          )}
        </div>

        {/* Top-Right: Aligned Controls Column + Circular Mini Map */}
        <div className="order-2 sm:order-3 shrink-0 flex items-start gap-1.5 sm:gap-2.5">
          <div className="pointer-events-auto flex flex-col gap-1 md:gap-1.5">
            <button
              type="button"
              onClick={onPause}
              className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg bg-[#0d1117]/88 border border-slate-800/90 text-slate-300 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
              aria-label="Pause game"
              title="Pause (Esc)"
            >
              <Pause className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg bg-[#0d1117]/88 border border-slate-800/90 text-slate-300 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              title={muted ? 'Sound Off' : 'Sound On'}
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 md:w-4 md:h-4" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onToggleTouchControls}
              className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                touchControlsEnabled
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-[#0d1117]/88 border-slate-800/90 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
              aria-label={touchControlsEnabled ? 'Hide on-screen controller' : 'Show on-screen controller'}
              title={touchControlsEnabled ? 'On-Screen Controller: On' : 'On-Screen Controller: Off'}
            >
              <Gamepad2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          </div>

          <div className="flex flex-col items-center">
            <canvas
              ref={radarCanvasRef}
              width={148}
              height={148}
              className="w-[84px] h-[84px] sm:w-[104px] sm:h-[104px] md:w-[144px] md:h-[144px] rounded-full"
            />
            <span className="mt-0.5 md:mt-1 text-[10px] md:text-[11px] font-medium text-slate-400">
              Mini Map
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
