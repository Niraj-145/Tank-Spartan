import React from 'react';
import { Minimize2, Play, Heart, Shield, Zap, Crosshair, Magnet, CheckCircle2 } from 'lucide-react';
import {
  MAX_GAME_LEVEL,
  WEAPON_ORDER,
  WEAPONS,
  getChassisUpgradeCost,
  getMaxUpgradeCap,
  getWeaponUpgradeCost,
} from '../game/data';
import { HudSnapshot, WeaponId } from '../game/types';

interface StoreModalProps {
  hud: HudSnapshot;
  onSelectWeapon: (id: WeaponId) => void;
  onBuyWeaponUnlock: (id: WeaponId) => void;
  onUpgradeWeaponStat: (id: WeaponId, stat: 'damageLv' | 'rateLv') => void;
  onUpgradeChassis: (kind: 'armor' | 'engine' | 'firepower' | 'magnet') => void;
  onBuyRepair: () => void;
  onLaunchNextWave: () => void;
  onProceedNextLevel: () => void;
  onMinimize: () => void;
}

export const StoreModal: React.FC<StoreModalProps> = ({
  hud,
  onSelectWeapon,
  onBuyWeaponUnlock,
  onUpgradeWeaponStat,
  onUpgradeChassis,
  onBuyRepair,
  onLaunchNextWave,
  onProceedNextLevel,
  onMinimize,
}) => {
  const isPostLevel = !hud.isTutorial && hud.wave >= hud.totalWaves;
  const maxCap = getMaxUpgradeCap(hud.storeTier);
  const repairCost = 40 + (hud.level - 1) * 10;
  const canRepair = hud.hp < hud.maxHp && hud.gold >= repairCost;
  const nextLv = Math.min(MAX_GAME_LEVEL, hud.level + 1);

  const chassisItems: {
    kind: 'armor' | 'engine' | 'firepower' | 'magnet';
    label: string;
    effect: string;
    lv: number;
    icon: React.ReactNode;
  }[] = [
    {
      kind: 'armor',
      label: 'More HP',
      effect: `+${25 + (hud.level - 1) * 5} Max HP & tougher armor`,
      lv: hud.chassis.armorLv,
      icon: <Shield className="w-4 h-4 text-sky-400" />,
    },
    {
      kind: 'firepower',
      label: 'More Power',
      effect: '+12% damage for all guns',
      lv: hud.chassis.firepowerLv,
      icon: <Crosshair className="w-4 h-4 text-amber-400" />,
    },
    {
      kind: 'engine',
      label: 'More Speed',
      effect: '+8% faster tank speed',
      lv: hud.chassis.engineLv,
      icon: <Zap className="w-4 h-4 text-emerald-400" />,
    },
    {
      kind: 'magnet',
      label: 'Coin Magnet',
      effect: 'Pull Gold & XP from farther away',
      lv: hud.chassis.magnetLv,
      icon: <Magnet className="w-4 h-4 text-purple-400" />,
    },
  ];

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-2 sm:p-4 bg-[#0d1117]/88"
      style={{
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-4xl max-h-[94%] flex flex-col bg-[#151c26] border border-slate-700/90 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 px-4 py-2.5 sm:px-5 sm:py-3.5 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white uppercase leading-tight truncate">
              {hud.isTutorial
                ? 'Shop Tutorial · All 5 Guns & Upgrades'
                : isPostLevel
                ? `Level ${hud.level} Done · Upgrade Shop`
                : `Upgrade Shop · Wave ${hud.wave}/${hud.totalWaves} Done`}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
              Shop Level {hud.storeTier} · Max Upgrade Lv.{maxCap} · {hud.tankFormName}
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="text-right">
              <div className="text-[10px] sm:text-xs text-slate-400">Your Gold</div>
              <div className="text-sm sm:text-base font-bold text-amber-400 font-mono-tabular">
                {hud.gold} Gold
              </div>
            </div>

            {!isPostLevel && !hud.isTutorial && (
              <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-[#0d1117] border border-amber-500/40 text-center">
                <div className="text-[10px] sm:text-[11px] text-slate-400">Next Wave</div>
                <div className="text-xs sm:text-sm font-bold text-amber-400 font-mono-tabular">
                  {hud.interWaveTimer}s
                </div>
              </div>
            )}

            {!hud.isTutorial && !isPostLevel && (
              <button
                type="button"
                onClick={onMinimize}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Hide Shop"
                aria-label="Hide Shop"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Store Content (includes Tutorial strip on small phone landscape heights) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {hud.isTutorial && (
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-[#0f1c1a] border-b border-emerald-800/60 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-emerald-300">
                  Shop Tutorial (Step 5/5): Between waves you get 30s to buy Guns &amp; Tank Upgrades. Tap Use here (or press 1–5) to switch guns.
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-200">
                  {hud.tutorialBoughtUpgrade ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Great! Tap Start Level 1 below</span>
                    </>
                  ) : (
                    <span className="text-amber-300">
                      Try upgrading Cannon Power (65G) or More Speed (70G) — new Guns unlock every 5 levels!
                    </span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-1 @[520px]:grid-cols-2 @[768px]:grid-cols-5 gap-2 text-[11px] text-slate-300">
                {WEAPON_ORDER.map((id, idx) => {
                  const w = WEAPONS[id];
                  return (
                    <div key={id} className="bg-[#0d1117]/85 border border-slate-800 rounded px-2.5 py-2">
                      <div className="font-semibold text-white flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="font-mono-tabular text-amber-400">{idx + 1}.</span>
                          <span className="truncate">{w.name}</span>
                        </span>
                        <span className="font-mono-tabular text-[10px] text-slate-400 shrink-0">
                          {w.baseCost === 0 ? 'Free' : `Lv.${w.unlockLevel}`}
                        </span>
                      </div>
                      <div className="text-slate-400 mt-0.5 leading-snug">{w.description}</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-slate-400">
                Tip: Tank Upgrades side boosts your tank permanently — <span className="text-slate-200">More HP</span>, <span className="text-slate-200">More Power</span>, <span className="text-slate-200">More Speed</span>, <span className="text-slate-200">Coin Magnet</span>, and <span className="text-slate-200">Heal Tank</span>.
              </div>
            </div>
          )}

          {/* Store Two-Column Body */}
          <div className="grid grid-cols-1 @[700px]:grid-cols-2 divide-y @[700px]:divide-y-0 @[700px]:divide-x divide-slate-800">
            <div className="p-4 sm:p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Guns
              </h3>

              <div className="divide-y divide-slate-800/80">
                {WEAPON_ORDER.map((id) => {
                  const def = WEAPONS[id];
                  const unlocked = hud.unlockedWeapons.includes(id);
                  const levelLocked = hud.storeTier < def.unlockLevel;
                  const wLv = hud.weaponLevels[id];
                  const dmgCost = getWeaponUpgradeCost(65, wLv.damageLv);
                  const rateCost = getWeaponUpgradeCost(60, wLv.rateLv);

                  return (
                    <div key={id} className="py-3 first:pt-1 last:pb-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: def.color }}
                            />
                            <span className="text-sm font-semibold text-white truncate">{def.name}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 leading-snug">{def.description}</p>
                        </div>

                        {!unlocked ? (
                          <button
                            type="button"
                            disabled={levelLocked || hud.gold < def.baseCost}
                            onClick={() => onBuyWeaponUnlock(id)}
                            className={`px-3 py-1.5 min-h-[36px] rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors font-mono-tabular ${
                              levelLocked
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : hud.gold >= def.baseCost
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                                : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {levelLocked ? `Need Lv.${def.unlockLevel}` : `Buy ${def.baseCost}G`}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={hud.activeWeapon === id}
                            onClick={() => onSelectWeapon(id)}
                            className={`px-3 py-1.5 min-h-[36px] rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                              hud.activeWeapon === id
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer'
                            }`}
                          >
                            {hud.activeWeapon === id ? 'Using' : 'Use'}
                          </button>
                        )}
                      </div>

                      {unlocked && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={wLv.damageLv >= maxCap || hud.gold < dmgCost}
                            onClick={() => onUpgradeWeaponStat(id, 'damageLv')}
                            className={`px-3 py-1.5 min-h-[36px] rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors font-mono-tabular ${
                              wLv.damageLv >= maxCap
                                ? 'bg-slate-800 text-emerald-400 cursor-default'
                                : hud.gold >= dmgCost
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 cursor-pointer'
                                : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            {wLv.damageLv >= maxCap
                              ? `Power Lv.${wLv.damageLv} MAX`
                              : `Power Lv.${wLv.damageLv} -> ${dmgCost}G`}
                          </button>

                          <button
                            type="button"
                            disabled={wLv.rateLv >= maxCap || hud.gold < rateCost}
                            onClick={() => onUpgradeWeaponStat(id, 'rateLv')}
                            className={`px-3 py-1.5 min-h-[36px] rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors font-mono-tabular ${
                              wLv.rateLv >= maxCap
                                ? 'bg-slate-800 text-emerald-400 cursor-default'
                                : hud.gold >= rateCost
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 cursor-pointer'
                                : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            {wLv.rateLv >= maxCap
                              ? `Speed Lv.${wLv.rateLv} MAX`
                              : `Speed Lv.${wLv.rateLv} -> ${rateCost}G`}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Tank Upgrades
              </h3>

              <div className="pb-3 border-b border-slate-800/80 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Heart className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">Heal Tank</div>
                    <div className="text-xs text-slate-400 font-mono-tabular">
                      HP: {hud.hp}/{hud.maxHp} · Restores 45% HP
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canRepair}
                  onClick={onBuyRepair}
                  className={`px-3 py-1.5 min-h-[38px] rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors font-mono-tabular ${
                    hud.hp >= hud.maxHp
                      ? 'bg-slate-800 text-emerald-400 cursor-default'
                      : canRepair
                      ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                      : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  {hud.hp >= hud.maxHp ? 'Full HP' : `Heal ${repairCost}G`}
                </button>
              </div>

              <div className="divide-y divide-slate-800/80">
                {chassisItems.map((item) => {
                  const cost = getChassisUpgradeCost(item.kind, item.lv);
                  const maxed = item.lv >= maxCap;
                  const affordable = hud.gold >= cost;

                  return (
                    <div key={item.kind} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="mt-0.5 shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">
                            {item.label}{' '}
                            <span className="text-xs text-slate-400 font-mono-tabular">
                              Lv.{item.lv}/{maxCap}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 leading-snug">{item.effect}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={maxed || !affordable}
                        onClick={() => onUpgradeChassis(item.kind)}
                        className={`px-3 py-1.5 min-h-[38px] rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors font-mono-tabular ${
                          maxed
                            ? 'bg-slate-800 text-emerald-400 cursor-default'
                            : affordable
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                            : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                        }`}
                      >
                        {maxed ? 'MAX' : `${cost}G`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-4 py-2.5 sm:px-5 sm:py-3.5 border-t border-slate-800 bg-[#10161e] flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] sm:text-xs text-slate-400 font-mono-tabular truncate">
            Tank Level {hud.rpgLevel} · +{Math.round((hud.rpgLevel - 1) * 5)}% Bonus Power
          </span>

          <button
            type="button"
            onClick={isPostLevel ? onProceedNextLevel : onLaunchNextWave}
            className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 min-h-[42px] rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>
              {hud.isTutorial
                ? 'Start Level 1'
                : isPostLevel
                ? `Start Level ${nextLv}`
                : `Start Wave ${hud.wave + 1}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
